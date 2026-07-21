import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { config } from "../config";
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

type SocketAccount = {
  id: string;
  nickname: string;
  emailVerifiedAt: Date;
};

type ChannelMember = {
  socketId: string;
  userId: string | null;
  nickname: string;
};

type JoinedChannel = {
  id: string;
  slug: string;
  name: string;
  topic: string | null;
  allowGuests: boolean;
  maxMembers: number;
  slowModeSeconds: number;
  isOfficial: boolean;
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

  private publicChannel(channel: Awaited<ReturnType<typeof getActiveChannelBySlug>>) {
    if (!channel) return null;
    return {
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
      topic: channel.topic,
      language: channel.language,
      isOfficial: channel.isOfficial,
      allowGuests: channel.allowGuests,
      maxMembers: channel.maxMembers,
      slowModeSeconds: channel.slowModeSeconds,
      lastActivityAt: channel.lastActivityAt,
      creator: channel.creator
    };
  }

  private memberList(channelId: string) {
    return [...(this.membersByChannel.get(channelId)?.values() ?? [])]
      .map((member) => ({ userId: member.userId, nickname: member.nickname }))
      .sort((a, b) => a.nickname.localeCompare(b.nickname, "pl"))
      .slice(0, 250);
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

  private emitError(socket: Socket, code: string, slug?: string) {
    socket.emit("channel.error", { code, slug: slug ?? null });
  }

  async join(
    socket: Socket,
    payload: unknown,
    beforeJoin?: () => void
  ) {
    const parsed = joinSchema.safeParse(payload);
    if (!parsed.success) return this.emitError(socket, "INVALID_CHANNEL_JOIN");

    const account = this.account(socket);
    const channel = await getActiveChannelBySlug(parsed.data.slug);
    if (!channel) return this.emitError(socket, "CHANNEL_NOT_FOUND", parsed.data.slug);
    if (!account && !channel.allowGuests) {
      return this.emitError(socket, "ACCOUNT_REQUIRED", channel.slug);
    }

    const joined = this.joined(socket.id);
    if (joined.has(channel.slug)) {
      const history = await getRecentChannelMessages(channel.slug);
      socket.emit("channel.joined", {
        channel: this.publicChannel(channel),
        history,
        members: this.memberList(channel.id)
      });
      return;
    }
    if (joined.size >= config.channelMaxJoined) {
      return this.emitError(socket, "TOO_MANY_JOINED_CHANNELS", channel.slug);
    }

    const memberMap = this.memberMap(channel.id);
    if (memberMap.size >= channel.maxMembers) {
      return this.emitError(socket, "CHANNEL_FULL", channel.slug);
    }

    const nickname = account?.nickname ?? sanitizeNickname(parsed.data.nickname ?? "");
    if (!nickname || nickname.length < 3) {
      return this.emitError(socket, "GUEST_NICKNAME_REQUIRED", channel.slug);
    }

    beforeJoin?.();
    if (account) await ensureChannelMembership(channel.id, account.id);

    const joinedChannel: JoinedChannel = {
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
      topic: channel.topic,
      allowGuests: channel.allowGuests,
      maxMembers: channel.maxMembers,
      slowModeSeconds: channel.slowModeSeconds,
      isOfficial: channel.isOfficial
    };

    joined.set(channel.slug, joinedChannel);
    memberMap.set(socket.id, {
      socketId: socket.id,
      userId: account?.id ?? null,
      nickname
    });
    await socket.join(roomName(channel.id));

    const history = await getRecentChannelMessages(channel.slug);
    socket.emit("channel.joined", {
      channel: this.publicChannel(channel),
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

    const now = Date.now();
    const slowModeKey = `${channel.id}:${socket.id}`;
    const lastMessageAt = this.lastMessageAt.get(slowModeKey) ?? 0;
    const remainingMs = channel.slowModeSeconds * 1000 - (now - lastMessageAt);
    if (remainingMs > 0) {
      socket.emit("channel.error", {
        code: "SLOW_MODE",
        slug: channel.slug,
        retryAfterMs: remainingMs
      });
      return;
    }

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
        for (const channel of channels) {
          await this.join(socket, { slug: channel.slug }, options.beforeChannelJoin);
        }
        socket.emit("channels.autojoined", { slugs: channels.map((channel) => channel.slug) });
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
      void this.sendMessage(socket, payload, options.allowMessage, options.normalizeMessage).catch(
        (error) => {
          logger.error("Channel message failed", { socketId: socket.id, error: String(error) });
          this.emitError(socket, "CHANNEL_MESSAGE_FAILED");
        }
      );
    });

    socket.on("disconnect", () => {
      void this.leaveAll(socket, false).catch((error) => {
        logger.error("Channel disconnect cleanup failed", {
          socketId: socket.id,
          error: String(error)
        });
      });
    });
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
    return new Set(
      [...this.membersByChannel.values()].flatMap((members) => [...members.keys()])
    ).size;
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
