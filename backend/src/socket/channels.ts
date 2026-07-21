import { randomUUID } from "crypto";
import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { config } from "../config";
import { prisma } from "../db";
import { logger } from "../utils/logger";
import {
  ChannelError,
  cleanupInactiveChannels,
  createChannelMessage,
  ensureChannelMembership,
  getActiveChannelBySlug,
  getRecentChannelMessages,
  listAutoJoinChannels
} from "../services/channels";
import { getChannelAccess } from "../services/moderation";

type SocketAccount = {
  id: string;
  nickname: string;
  emailVerifiedAt: Date;
};

type ChannelMember = {
  socketId: string;
  memberId: string;
  userId: string | null;
  nickname: string;
  role: "OWNER" | "MODERATOR" | "MEMBER" | null;
};

type JoinedChannel = {
  id: string;
  slug: string;
  name: string;
  topic: string | null;
  allowGuests: boolean;
  isLocked: boolean;
  maxMembers: number;
  slowModeSeconds: number;
  isOfficial: boolean;
  role: "OWNER" | "MODERATOR" | "MEMBER" | null;
};

const joinSchema = z.object({
  slug: z.string().trim().min(1).max(60),
  nickname: z.string().trim().min(3).max(24).optional()
});
const leaveSchema = z.object({ slug: z.string().trim().min(1).max(60) });
const messageSchema = z.object({
  slug: z.string().trim().min(1).max(60),
  text: z.string().max(2000)
});

function roomName(channelId: string) {
  return `public-channel:${channelId}`;
}

function sanitizeNickname(value: string) {
  return value.replace(/\s+/g, " ").replace(/[<>]/g, "").trim().slice(0, 24);
}

function canModerate(role: JoinedChannel["role"]) {
  return role === "OWNER" || role === "MODERATOR";
}

export class PublicChannelRuntime {
  private membersByChannel = new Map<string, Map<string, ChannelMember>>();
  private joinedBySocket = new Map<string, Map<string, JoinedChannel>>();
  private lastMessageAt = new Map<string, number>();
  private publicMessagesTotal = 0;

  constructor(private io: Server) {
    setInterval(() => {
      void this.cleanup();
    }, config.channelCleanupIntervalMs).unref();
  }

  private account(socket: Socket) {
    return ((socket.data as Record<string, unknown>).accountUser ?? null) as SocketAccount | null;
  }

  private joined(socketId: string) {
    let joined = this.joinedBySocket.get(socketId);
    if (!joined) {
      joined = new Map();
      this.joinedBySocket.set(socketId, joined);
    }
    return joined;
  }

  private memberMap(channelId: string) {
    let members = this.membersByChannel.get(channelId);
    if (!members) {
      members = new Map();
      this.membersByChannel.set(channelId, members);
    }
    return members;
  }

  private publicChannel(
    channel: NonNullable<Awaited<ReturnType<typeof getActiveChannelBySlug>>>,
    joined: JoinedChannel
  ) {
    return {
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
      topic: joined.topic,
      language: channel.language,
      isOfficial: channel.isOfficial,
      allowGuests: joined.allowGuests,
      isLocked: joined.isLocked,
      maxMembers: channel.maxMembers,
      slowModeSeconds: joined.slowModeSeconds,
      lastActivityAt: channel.lastActivityAt,
      creator: channel.creator,
      currentUserRole: joined.role
    };
  }

  private memberList(channelId: string) {
    return [...(this.membersByChannel.get(channelId)?.values() ?? [])]
      .map((member) => ({
        memberId: member.memberId,
        userId: member.userId,
        nickname: member.nickname,
        role: member.role
      }))
      .sort((a, b) => {
        const weight = (role: ChannelMember["role"]) => (role === "OWNER" ? 0 : role === "MODERATOR" ? 1 : 2);
        return weight(a.role) - weight(b.role) || a.nickname.localeCompare(b.nickname, "pl");
      })
      .slice(0, 250);
  }

  private joinedChannelBySlug(slug: string) {
    for (const joined of this.joinedBySocket.values()) {
      const channel = joined.get(slug);
      if (channel) return channel;
    }
    return null;
  }

  private emitPresence(channel: JoinedChannel) {
    const payload = {
      slug: channel.slug,
      online: this.membersByChannel.get(channel.id)?.size ?? 0,
      members: this.memberList(channel.id)
    };
    this.io.to(roomName(channel.id)).emit("channel.presence", payload);
    this.io.emit("channels.presence.changed", { slug: channel.slug, online: payload.online });
  }

  private emitError(socket: Socket, code: string, slug?: string, retryAfterMs?: number) {
    socket.emit("channel.error", { code, slug: slug ?? null, ...(retryAfterMs ? { retryAfterMs } : {}) });
  }

  async join(socket: Socket, payload: unknown, beforeJoin?: () => void) {
    const parsed = joinSchema.safeParse(payload);
    if (!parsed.success) return this.emitError(socket, "INVALID_CHANNEL_JOIN");

    const account = this.account(socket);
    const channel = await getActiveChannelBySlug(parsed.data.slug);
    if (!channel) return this.emitError(socket, "CHANNEL_NOT_FOUND", parsed.data.slug);
    if (!account && !channel.allowGuests) return this.emitError(socket, "ACCOUNT_REQUIRED", channel.slug);

    const fresh = await prisma.channel.findUnique({
      where: { id: channel.id },
      select: { isLocked: true, topic: true, allowGuests: true, slowModeSeconds: true }
    });
    if (!fresh) return this.emitError(socket, "CHANNEL_NOT_FOUND", channel.slug);

    let role: JoinedChannel["role"] = null;
    if (account) {
      const access = await getChannelAccess(channel.id, account.id);
      if (access.restriction?.bannedAt) return this.emitError(socket, "CHANNEL_BANNED", channel.slug);
      const membership = await ensureChannelMembership(channel.id, account.id);
      role = membership.role;
    }
    if (fresh.isLocked && !canModerate(role)) return this.emitError(socket, "CHANNEL_LOCKED", channel.slug);

    const joined = this.joined(socket.id);
    if (joined.has(channel.slug)) {
      const joinedChannel = joined.get(channel.slug)!;
      const history = await getRecentChannelMessages(channel.slug);
      socket.emit("channel.joined", {
        channel: this.publicChannel(channel, joinedChannel),
        history,
        members: this.memberList(channel.id)
      });
      return;
    }
    if (joined.size >= config.channelMaxJoined) {
      return this.emitError(socket, "TOO_MANY_JOINED_CHANNELS", channel.slug);
    }

    const memberMap = this.memberMap(channel.id);
    if (memberMap.size >= channel.maxMembers) return this.emitError(socket, "CHANNEL_FULL", channel.slug);

    const nickname = account?.nickname ?? sanitizeNickname(parsed.data.nickname ?? "");
    if (!nickname || nickname.length < 3) return this.emitError(socket, "GUEST_NICKNAME_REQUIRED", channel.slug);

    beforeJoin?.();
    const joinedChannel: JoinedChannel = {
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
      topic: fresh.topic,
      allowGuests: fresh.allowGuests,
      isLocked: fresh.isLocked,
      maxMembers: channel.maxMembers,
      slowModeSeconds: fresh.slowModeSeconds,
      isOfficial: channel.isOfficial,
      role
    };

    joined.set(channel.slug, joinedChannel);
    memberMap.set(socket.id, {
      socketId: socket.id,
      memberId: randomUUID(),
      userId: account?.id ?? null,
      nickname,
      role
    });
    await socket.join(roomName(channel.id));

    const history = await getRecentChannelMessages(channel.slug);
    socket.emit("channel.joined", {
      channel: this.publicChannel(channel, joinedChannel),
      history,
      members: this.memberList(channel.id)
    });
    socket.to(roomName(channel.id)).emit("channel.system", {
      slug: channel.slug,
      type: "join",
      nickname,
      createdAt: new Date().toISOString()
    });
    this.emitPresence(joinedChannel);
  }

  async leave(socket: Socket, slug: string, announce = true) {
    const joined = this.joinedBySocket.get(socket.id);
    const channel = joined?.get(slug);
    if (!channel) return;

    const member = this.membersByChannel.get(channel.id)?.get(socket.id);
    joined?.delete(slug);
    if (joined && joined.size === 0) this.joinedBySocket.delete(socket.id);

    const members = this.membersByChannel.get(channel.id);
    members?.delete(socket.id);
    if (members && members.size === 0) this.membersByChannel.delete(channel.id);

    await socket.leave(roomName(channel.id));
    if (announce && member) {
      socket.to(roomName(channel.id)).emit("channel.system", {
        slug: channel.slug,
        type: "leave",
        nickname: member.nickname,
        createdAt: new Date().toISOString()
      });
    }
    this.emitPresence(channel);
  }

  async leaveAll(socket: Socket, announce = true) {
    const slugs = [...(this.joinedBySocket.get(socket.id)?.keys() ?? [])];
    await Promise.all(slugs.map((slug) => this.leave(socket, slug, announce)));
  }

  async sendMessage(
    socket: Socket,
    payload: unknown,
    allowMessage: () => boolean,
    normalizeMessage: (value: string) => string
  ) {
    const parsed = messageSchema.safeParse(payload);
    if (!parsed.success) return this.emitError(socket, "INVALID_CHANNEL_MESSAGE");

    const channel = this.joinedBySocket.get(socket.id)?.get(parsed.data.slug);
    if (!channel) return this.emitError(socket, "CHANNEL_NOT_JOINED", parsed.data.slug);
    if (!allowMessage()) return this.emitError(socket, "MESSAGE_RATE_LIMITED", channel.slug);

    const member = this.membersByChannel.get(channel.id)?.get(socket.id);
    if (!member) return this.emitError(socket, "CHANNEL_NOT_JOINED", channel.slug);
    if (channel.isLocked && !canModerate(member.role)) return this.emitError(socket, "CHANNEL_LOCKED", channel.slug);

    if (member.userId) {
      const access = await getChannelAccess(channel.id, member.userId);
      if (access.restriction?.bannedAt) {
        this.emitError(socket, "CHANNEL_BANNED", channel.slug);
        await this.leave(socket, channel.slug, false);
        return;
      }
      if (access.restriction?.mutedUntil) {
        const remainingMs = access.restriction.mutedUntil.getTime() - Date.now();
        if (remainingMs > 0) return this.emitError(socket, "CHANNEL_MUTED", channel.slug, remainingMs);
      }
    }

    const now = Date.now();
    const slowModeKey = `${channel.id}:${socket.id}`;
    const lastMessageAt = this.lastMessageAt.get(slowModeKey) ?? 0;
    const remainingMs = channel.slowModeSeconds * 1000 - (now - lastMessageAt);
    if (remainingMs > 0) return this.emitError(socket, "SLOW_MODE", channel.slug, remainingMs);

    const text = normalizeMessage(parsed.data.text);
    if (!text) return;

    const message = await createChannelMessage({
      channelId: channel.id,
      senderUserId: member.userId,
      senderNickname: member.nickname,
      text
    });
    this.lastMessageAt.set(slowModeKey, now);
    this.publicMessagesTotal += 1;
    this.io.to(roomName(channel.id)).emit("channel.message", {
      ...message,
      slug: channel.slug,
      createdAt: message.createdAt.toISOString()
    });
  }

  register(
    socket: Socket,
    options: {
      beforeChannelJoin: () => void;
      allowMessage: () => boolean;
      normalizeMessage: (value: string) => string;
    }
  ) {
    socket.on("channel.join", (payload) => {
      void this.join(socket, payload, options.beforeChannelJoin).catch((error) => {
        logger.error("Channel join failed", { socketId: socket.id, error: String(error) });
        this.emitError(socket, error instanceof ChannelError ? error.code : "CHANNEL_JOIN_FAILED");
      });
    });

    socket.on("channels.autojoin", () => {
      void (async () => {
        const account = this.account(socket);
        if (!account) return this.emitError(socket, "ACCOUNT_REQUIRED");
        const channels = await listAutoJoinChannels(account.id);
        const joined: string[] = [];
        for (const channel of channels) {
          await this.join(socket, { slug: channel.slug }, options.beforeChannelJoin);
          if (this.joinedBySocket.get(socket.id)?.has(channel.slug)) joined.push(channel.slug);
        }
        socket.emit("channels.autojoined", { slugs: joined });
      })().catch((error) => {
        logger.error("Channel auto-join failed", { socketId: socket.id, error: String(error) });
        this.emitError(socket, "CHANNEL_AUTOJOIN_FAILED");
      });
    });

    socket.on("channel.leave", (payload) => {
      const parsed = leaveSchema.safeParse(payload);
      if (!parsed.success) return;
      void this.leave(socket, parsed.data.slug).catch((error) => {
        logger.error("Channel leave failed", { socketId: socket.id, error: String(error) });
      });
    });

    socket.on("channel.message.send", (payload) => {
      void this.sendMessage(socket, payload, options.allowMessage, options.normalizeMessage).catch((error) => {
        logger.error("Channel message failed", { socketId: socket.id, error: String(error) });
        this.emitError(socket, "CHANNEL_MESSAGE_FAILED");
      });
    });

    socket.on("disconnect", () => {
      void this.leaveAll(socket, false).catch((error) => {
        logger.error("Channel disconnect cleanup failed", { socketId: socket.id, error: String(error) });
      });
    });
  }

  getMember(slug: string, memberId: string) {
    const channel = this.joinedChannelBySlug(slug);
    if (!channel) return null;
    const member = [...(this.membersByChannel.get(channel.id)?.values() ?? [])].find(
      (item) => item.memberId === memberId
    );
    return member ? { userId: member.userId, nickname: member.nickname } : null;
  }

  async kickMember(slug: string, memberId: string, reason?: string) {
    const channel = this.joinedChannelBySlug(slug);
    if (!channel) return false;
    const member = [...(this.membersByChannel.get(channel.id)?.values() ?? [])].find(
      (item) => item.memberId === memberId
    );
    if (!member) return false;
    const socket = this.io.sockets.sockets.get(member.socketId);
    if (!socket) return false;
    socket.emit("channel.kicked", { slug, reason: reason || null });
    await this.leave(socket, slug, false);
    return true;
  }

  async kickUser(slug: string, userId: string, reason?: string) {
    const channel = this.joinedChannelBySlug(slug);
    if (!channel) return 0;
    const members = [...(this.membersByChannel.get(channel.id)?.values() ?? [])].filter(
      (item) => item.userId === userId
    );
    for (const member of members) {
      const socket = this.io.sockets.sockets.get(member.socketId);
      if (!socket) continue;
      socket.emit("channel.kicked", { slug, reason: reason || null });
      await this.leave(socket, slug, false);
    }
    return members.length;
  }

  emitMessageDeleted(slug: string, messageId: string) {
    const channel = this.joinedChannelBySlug(slug);
    if (!channel) return;
    this.io.to(roomName(channel.id)).emit("channel.message.deleted", { slug, messageId });
  }

  updateLiveChannel(input: {
    id: string;
    slug: string;
    topic: string | null;
    allowGuests: boolean;
    slowModeSeconds: number;
    isLocked: boolean;
  }) {
    for (const joined of this.joinedBySocket.values()) {
      const channel = joined.get(input.slug);
      if (!channel) continue;
      channel.topic = input.topic;
      channel.allowGuests = input.allowGuests;
      channel.slowModeSeconds = input.slowModeSeconds;
      channel.isLocked = input.isLocked;
    }
    this.io.to(roomName(input.id)).emit("channel.updated", {
      slug: input.slug,
      topic: input.topic,
      allowGuests: input.allowGuests,
      slowModeSeconds: input.slowModeSeconds,
      isLocked: input.isLocked
    });
  }

  async archiveChannel(slug: string) {
    const channel = this.joinedChannelBySlug(slug);
    if (!channel) return;
    const sockets = [...(this.membersByChannel.get(channel.id)?.values() ?? [])]
      .map((member) => this.io.sockets.sockets.get(member.socketId))
      .filter((socket): socket is Socket => Boolean(socket));
    this.io.to(roomName(channel.id)).emit("channel.closed", { slug });
    await Promise.all(sockets.map((socket) => this.leave(socket, slug, false)));
  }

  async disconnectUser(userId: string) {
    const sockets = [...this.io.sockets.sockets.values()].filter(
      (socket) => this.account(socket)?.id === userId
    );
    for (const socket of sockets) socket.disconnect(true);
    return sockets.length;
  }

  presenceCounts() {
    return new Map([...this.membersByChannel.entries()].map(([id, members]) => [id, members.size]));
  }

  activeChannelIds() {
    return new Set(this.membersByChannel.keys());
  }

  activeRoomsCount() {
    return this.membersByChannel.size;
  }

  activeUsersCount() {
    return new Set([...this.membersByChannel.values()].flatMap((members) => [...members.keys()])).size;
  }

  messagesTotal() {
    return this.publicMessagesTotal;
  }

  private async cleanup() {
    try {
      const deleted = await cleanupInactiveChannels(this.activeChannelIds());
      if (deleted.length) logger.info("Deleted inactive channels", { channels: deleted });
    } catch (error) {
      logger.error("Inactive channel cleanup failed", { error: String(error) });
    }
  }
}
