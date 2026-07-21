import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { config } from "../config";
import { prisma } from "../db";
import { TokenBucketLimiter } from "../utils/TokenBucketLimiter";
import { logger } from "../utils/logger";
import {
  SocialError,
  createDirectMessage,
  getAcceptedFriendIds,
  markConversationRead,
  markMessageDelivered,
  requireAcceptedFriendship,
  syncUndeliveredMessages,
  touchLastSeen
} from "../services/social";

const sendSchema = z.object({ recipientId: z.string().min(1), text: z.string() });
const friendSchema = z.object({ friendId: z.string().min(1) });

type SocketAccount = {
  id: string;
  nickname: string;
  showOnline: boolean;
  showLastSeen: boolean;
  allowDirectMessages: boolean;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeMessage(value: string) {
  let text = value.replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length > config.maxMessageLength) text = text.slice(0, config.maxMessageLength);
  for (const word of config.bannedWords) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi"), "***");
  }
  return text;
}

function publicMessage(message: {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: Date;
  deliveredAt: Date | null;
  readAt: Date | null;
}) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    recipientId: message.recipientId,
    text: message.text,
    createdAt: message.createdAt,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt
  };
}

export class DirectMessageRuntime {
  private readonly socketsByUser = new Map<string, Set<string>>();
  private readonly typingAt = new Map<string, number>();
  private readonly socketLimiter = new TokenBucketLimiter(
    config.msgRateLimitPerSec,
    config.msgRateBurst
  );
  private readonly accountLimiter = new TokenBucketLimiter(
    config.msgRateLimitPerSec,
    config.msgRateBurst
  );
  private sentTotal = 0;

  constructor(private readonly io: Server) {}

  attach() {
    this.io.on("connection", (socket) => {
      this.register(socket);
      socket.on("disconnect", () => this.handleDisconnect(socket));
    });
    setInterval(() => {
      this.socketLimiter.cleanup();
      this.accountLimiter.cleanup();
    }, 10 * 60 * 1000).unref();
  }

  private userRoom(userId: string) {
    return `account:${userId}`;
  }

  getOnlineAccountIds() {
    return Array.from(this.socketsByUser.entries())
      .filter(([, sockets]) => sockets.size > 0)
      .map(([userId]) => userId);
  }

  isOnline(userId: string) {
    return (this.socketsByUser.get(userId)?.size ?? 0) > 0;
  }

  messagesTotal() {
    return this.sentTotal;
  }

  notifySocialChanged(userIds: string[], reason: string) {
    for (const userId of new Set(userIds)) {
      this.io.to(this.userRoom(userId)).emit("social.changed", { reason });
    }
  }

  private allowMessage(socketId: string, userId: string) {
    const now = Date.now();
    return (
      this.socketLimiter.allow(`dm:s:${socketId}`, now) &&
      this.accountLimiter.allow(`dm:u:${userId}`, now)
    );
  }

  private async broadcastPresence(userId: string, online: boolean) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { showOnline: true, showLastSeen: true, lastSeenAt: true }
    });
    if (!user) return;

    const friendIds = await getAcceptedFriendIds(userId);
    const payload = {
      userId,
      online: user.showOnline ? online : false,
      lastSeenAt: !online && user.showLastSeen ? user.lastSeenAt : null
    };
    for (const friendId of friendIds) {
      this.io.to(this.userRoom(friendId)).emit("friend.presence", payload);
    }
  }

  private async deliverOfflineMessages(socket: Socket, account: SocketAccount) {
    const messages = await syncUndeliveredMessages(account.id);
    if (!messages.length) return;

    socket.emit("direct.messages.sync", { messages: messages.map(publicMessage) });
    const idsBySender = new Map<string, string[]>();
    for (const message of messages) {
      const ids = idsBySender.get(message.senderId) ?? [];
      ids.push(message.id);
      idsBySender.set(message.senderId, ids);
    }
    for (const [senderId, messageIds] of idsBySender) {
      this.io.to(this.userRoom(senderId)).emit("direct.messages.delivered", {
        recipientId: account.id,
        messageIds,
        deliveredAt: messages[0]!.deliveredAt
      });
    }
    this.notifySocialChanged([account.id, ...idsBySender.keys()], "offline-messages-delivered");
  }

  private register(socket: Socket) {
    const account = (socket.data as Record<string, unknown>).accountUser as SocketAccount | null;
    if (!account) return;

    const existing = this.socketsByUser.get(account.id) ?? new Set<string>();
    const firstConnection = existing.size === 0;
    existing.add(socket.id);
    this.socketsByUser.set(account.id, existing);
    void socket.join(this.userRoom(account.id));

    if (firstConnection) {
      void this.broadcastPresence(account.id, true).catch((error) =>
        logger.warn("Friend presence broadcast failed", { error: String(error) })
      );
    }
    void this.deliverOfflineMessages(socket, account).catch((error) =>
      logger.error("Offline message sync failed", { userId: account.id, error: String(error) })
    );

    socket.on("direct.message.send", (payload) => {
      void (async () => {
        const parsed = sendSchema.safeParse(payload);
        if (!parsed.success || !this.allowMessage(socket.id, account.id)) return;
        const text = normalizeMessage(parsed.data.text);
        if (!text) return;

        const stored = await createDirectMessage(account.id, parsed.data.recipientId, text);
        let deliveredAt: Date | null = null;
        if (this.isOnline(parsed.data.recipientId)) {
          deliveredAt = new Date();
          await markMessageDelivered(stored.id, parsed.data.recipientId);
        }
        const message = publicMessage({ ...stored, deliveredAt });

        this.io.to(this.userRoom(account.id)).emit("direct.message.sent", { message });
        if (deliveredAt) {
          this.io.to(this.userRoom(parsed.data.recipientId)).emit("direct.message.received", { message });
        }
        this.sentTotal += 1;
        this.notifySocialChanged([account.id, parsed.data.recipientId], "direct-message");
      })().catch((error) => {
        const code = error instanceof SocialError ? error.code : "DIRECT_MESSAGE_FAILED";
        const friendId =
          payload && typeof payload === "object" && "recipientId" in payload
            ? String((payload as { recipientId?: unknown }).recipientId ?? "") || null
            : null;
        socket.emit("direct.error", { code, friendId });
        if (!(error instanceof SocialError)) {
          logger.error("Direct message send failed", { userId: account.id, error: String(error) });
        }
      });
    });

    socket.on("direct.message.read", (payload) => {
      void (async () => {
        const parsed = friendSchema.safeParse(payload);
        if (!parsed.success) return;
        const readAt = await markConversationRead(account.id, parsed.data.friendId);
        const event = { readerId: account.id, friendId: parsed.data.friendId, readAt };
        this.io.to(this.userRoom(account.id)).emit("direct.messages.read", event);
        this.io.to(this.userRoom(parsed.data.friendId)).emit("direct.messages.read", event);
        this.notifySocialChanged([account.id, parsed.data.friendId], "messages-read");
      })().catch((error) => {
        socket.emit("direct.error", {
          code: error instanceof SocialError ? error.code : "READ_FAILED",
          friendId:
            payload && typeof payload === "object" && "friendId" in payload
              ? String((payload as { friendId?: unknown }).friendId ?? "") || null
              : null
        });
      });
    });

    socket.on("direct.typing.start", (payload) => {
      void (async () => {
        const parsed = friendSchema.safeParse(payload);
        if (!parsed.success) return;
        const key = `${account.id}:${parsed.data.friendId}`;
        const now = Date.now();
        if (now - (this.typingAt.get(key) ?? 0) < 500) return;
        this.typingAt.set(key, now);
        await requireAcceptedFriendship(account.id, parsed.data.friendId);
        this.io.to(this.userRoom(parsed.data.friendId)).emit("direct.typing", {
          friendId: account.id,
          typing: true
        });
      })().catch(() => undefined);
    });

    socket.on("direct.typing.stop", (payload) => {
      void (async () => {
        const parsed = friendSchema.safeParse(payload);
        if (!parsed.success) return;
        await requireAcceptedFriendship(account.id, parsed.data.friendId);
        this.io.to(this.userRoom(parsed.data.friendId)).emit("direct.typing", {
          friendId: account.id,
          typing: false
        });
      })().catch(() => undefined);
    });
  }

  private handleDisconnect(socket: Socket) {
    const account = (socket.data as Record<string, unknown>).accountUser as SocketAccount | null;
    if (!account) return;
    const sockets = this.socketsByUser.get(account.id);
    if (!sockets) return;
    sockets.delete(socket.id);
    if (sockets.size > 0) return;
    this.socketsByUser.delete(account.id);

    void (async () => {
      await touchLastSeen(account.id);
      await this.broadcastPresence(account.id, false);
    })().catch((error) => logger.warn("Friend offline presence failed", { error: String(error) }));
  }
}
