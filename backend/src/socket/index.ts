import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { config } from "../config";
import { logger } from "../utils/logger";
import { MatchmakingQueue } from "../services/matchmaking";
import { RoomService } from "../services/rooms";
import { TokenBucketLimiter } from "../utils/TokenBucketLimiter";
import { AbuseService, ReportType } from "../services/abuse";
import { getSocketAccount } from "../services/socketAccount";
import { PublicChannelRuntime } from "./channels";

const sendMessageSchema = z.object({
  text: z.string(),
  device: z.enum(["desktop", "mobile"])
});

function sanitizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyBannedWords(text: string) {
  if (!config.bannedWords.length) return text;
  let out = text;
  for (const word of config.bannedWords) {
    const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    out = out.replace(re, "***");
  }
  return out;
}

function normalizeMessage(value: string) {
  let text = sanitizeText(value);
  if (!text) return "";
  if (text.length > config.maxMessageLength) text = text.slice(0, config.maxMessageLength);
  return applyBannedWords(text);
}

const REMATCH_COOLDOWN_MS = 30 * 60 * 1000;

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function normalizeIp(ip: string) {
  const value = (ip || "").trim();
  if (!value) return "";
  if (value.startsWith("::ffff:")) return value.slice(7);
  return value;
}

function clientIdOf(socket: Socket): string | null {
  const auth = socket.handshake.auth as Record<string, unknown>;
  const clientId =
    (typeof auth?.clientId === "string" && auth.clientId.trim()) ||
    (typeof socket.handshake.query?.clientId === "string" &&
      socket.handshake.query.clientId.trim());

  if (!clientId || clientId.length > 100) return null;
  return clientId;
}

function ipOf(socket: Socket) {
  const xReal = socket.handshake.headers["x-real-ip"];
  if (typeof xReal === "string" && xReal.trim()) return normalizeIp(xReal);

  const forwarded = socket.handshake.headers["x-forwarded-for"];
  const raw =
    typeof forwarded === "string" ? forwarded : Array.isArray(forwarded) ? forwarded[0] : "";
  if (raw?.trim()) return normalizeIp(raw.split(",")[0]!.trim());

  const address = socket.handshake.address;
  if (typeof address === "string" && address.trim()) return normalizeIp(address);
  return "unknown";
}

export function registerSocketHandlers(io: Server) {
  const queue = new MatchmakingQueue();
  const privateRooms = new RoomService();
  const abuse = new AbuseService();
  const publicChannels = new PublicChannelRuntime(io);

  let matchesTotal = 0;
  let messagesTotal = 0;
  const matchTs: number[] = [];
  const msgTs: number[] = [];

  const msgLimiterSocket = new TokenBucketLimiter(
    config.msgRateLimitPerSec,
    config.msgRateBurst
  );
  const msgLimiterIp = new TokenBucketLimiter(
    config.msgRateLimitPerSec,
    config.msgRateBurst
  );
  const lastTypingAt = new Map<string, { start: number; stop: number }>();
  const lastMatchedByPair = new Map<string, number>();

  function prune60s(now = Date.now()) {
    const cutoff = now - 60_000;
    while (matchTs.length && matchTs[0] < cutoff) matchTs.shift();
    while (msgTs.length && msgTs[0] < cutoff) msgTs.shift();
  }

  function isPairOnCooldown(clientA: string, clientB: string, now: number) {
    const last = lastMatchedByPair.get(pairKey(clientA, clientB)) ?? 0;
    return now - last < REMATCH_COOLDOWN_MS;
  }

  function markMatched(clientA: string, clientB: string, now: number) {
    lastMatchedByPair.set(pairKey(clientA, clientB), now);
  }

  function prunePairCooldown(now = Date.now()) {
    const cutoff = now - REMATCH_COOLDOWN_MS;
    for (const [key, timestamp] of lastMatchedByPair.entries()) {
      if (timestamp < cutoff) lastMatchedByPair.delete(key);
    }
  }

  function onlineCount() {
    return io.engine.clientsCount;
  }

  function broadcastOnline() {
    io.emit("users.online", onlineCount());
  }

  setInterval(() => {
    broadcastOnline();
    msgLimiterSocket.cleanup();
    msgLimiterIp.cleanup();
    prune60s();
    prunePairCooldown();
  }, config.onlineBroadcastIntervalMs).unref();

  function tryMatch() {
    let firstId: string | undefined;
    let first: Socket | undefined;

    while (true) {
      firstId = queue.popNextValid();
      if (!firstId) return;
      first = io.sockets.sockets.get(firstId);
      if (first && !privateRooms.isInRoom(firstId)) break;
    }

    const firstClientId = (first.data as Record<string, unknown>).clientId as string | undefined;
    if (!firstClientId) {
      queue.add(firstId);
      return;
    }

    const now = Date.now();
    const tried: string[] = [];
    let secondId: string | null = null;

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const candidate = queue.popNextValid();
      if (!candidate) break;
      if (candidate === firstId) {
        tried.push(candidate);
        continue;
      }

      const second = io.sockets.sockets.get(candidate);
      if (!second || privateRooms.isInRoom(candidate)) {
        tried.push(candidate);
        continue;
      }

      const secondClientId = (second.data as Record<string, unknown>).clientId as
        | string
        | undefined;
      if (!secondClientId || isPairOnCooldown(firstClientId, secondClientId, now)) {
        tried.push(candidate);
        continue;
      }

      secondId = candidate;
      break;
    }

    for (const id of tried) queue.add(id);
    if (!secondId) {
      queue.add(firstId);
      return;
    }

    const second = io.sockets.sockets.get(secondId);
    if (!second) {
      queue.add(firstId);
      return;
    }

    privateRooms.createRoom(first, second);
    first.emit("user.connected");
    second.emit("user.connected");

    const secondClientId = (second.data as Record<string, unknown>).clientId as string;
    markMatched(firstClientId, secondClientId, now);
    matchesTotal += 1;
    matchTs.push(now);
    broadcastOnline();
    logger.info("Matched users", { first: firstId, second: secondId });
  }

  function disconnectPartner(socket: Socket) {
    const partnerId = privateRooms.getPartner(socket.id);
    const roomId = privateRooms.getRoom(socket.id);

    privateRooms.clear(socket.id);
    if (roomId) void socket.leave(roomId);

    if (!partnerId) return;
    const partner = io.sockets.sockets.get(partnerId);
    if (!partner) return;

    privateRooms.clear(partnerId);
    if (roomId) void partner.leave(roomId);
    partner.emit("user.disconnected");
    if (!privateRooms.isInRoom(partnerId)) {
      queue.add(partnerId);
      tryMatch();
    }
  }

  io.use((socket, next) => {
    void getSocketAccount(socket.handshake.headers.cookie)
      .then((accountUser) => {
        (socket.data as Record<string, unknown>).accountUser = accountUser;
        next();
      })
      .catch((error) => {
        logger.warn("Unable to resolve socket account", { error: String(error) });
        (socket.data as Record<string, unknown>).accountUser = null;
        next();
      });
  });

  io.on("connection", (socket) => {
    const clientId = clientIdOf(socket);
    if (!clientId) {
      socket.disconnect(true);
      return;
    }
    (socket.data as Record<string, unknown>).clientId = clientId;

    const ip = ipOf(socket);
    if (!abuse.isWhitelisted(ip) && abuse.isBanned(ip)) {
      socket.disconnect(true);
      return;
    }
    if (!abuse.isWhitelisted(ip) && abuse.socketsForIp(ip) >= config.maxSocketsPerIp) {
      socket.disconnect(true);
      return;
    }

    abuse.registerSocket(socket.id, ip);
    broadcastOnline();

    const allowMessage = () => {
      const now = Date.now();
      return (
        msgLimiterSocket.allow(`s:${socket.id}`, now) &&
        msgLimiterIp.allow(`ip:${ip}`, now)
      );
    };

    publicChannels.register(socket, {
      beforeChannelJoin: () => {
        queue.remove(socket.id);
        if (privateRooms.isInRoom(socket.id)) disconnectPartner(socket);
      },
      allowMessage,
      normalizeMessage
    });

    socket.on("join", () => {
      void (async () => {
        await publicChannels.leaveAll(socket);
        if (privateRooms.isInRoom(socket.id)) return;
        queue.add(socket.id);
        tryMatch();
      })().catch((error) => logger.error("Random chat join failed", { error: String(error) }));
    });

    socket.on("leave.chat", () => {
      queue.remove(socket.id);
      if (privateRooms.isInRoom(socket.id)) disconnectPartner(socket);
    });

    socket.on("send.message", (payload) => {
      const parsed = sendMessageSchema.safeParse(payload);
      if (!parsed.success || !privateRooms.isInRoom(socket.id) || !allowMessage()) return;

      const text = normalizeMessage(parsed.data.text);
      if (!text) return;

      const partnerId = privateRooms.getPartner(socket.id);
      const partner = partnerId ? io.sockets.sockets.get(partnerId) : undefined;
      if (!partner) return;

      partner.emit("receive_message", { text });
      messagesTotal += 1;
      msgTs.push(Date.now());
    });

    socket.on("user.start_writing", () => {
      if (!privateRooms.isInRoom(socket.id)) return;
      const last = lastTypingAt.get(socket.id) ?? { start: 0, stop: 0 };
      const now = Date.now();
      if (now - last.start < config.typingThrottleMs) return;
      last.start = now;
      lastTypingAt.set(socket.id, last);

      const partnerId = privateRooms.getPartner(socket.id);
      const partner = partnerId ? io.sockets.sockets.get(partnerId) : undefined;
      partner?.emit("user.start_writing");
    });

    socket.on("user.stop_writing", () => {
      if (!privateRooms.isInRoom(socket.id)) return;
      const last = lastTypingAt.get(socket.id) ?? { start: 0, stop: 0 };
      const now = Date.now();
      if (now - last.stop < config.typingThrottleMs) return;
      last.stop = now;
      lastTypingAt.set(socket.id, last);

      const partnerId = privateRooms.getPartner(socket.id);
      const partner = partnerId ? io.sockets.sockets.get(partnerId) : undefined;
      partner?.emit("user.stop_writing");
    });

    socket.on("disconnect", (reason) => {
      queue.remove(socket.id);
      if (privateRooms.isInRoom(socket.id)) disconnectPartner(socket);
      abuse.unregisterSocket(socket.id);
      broadcastOnline();
      logger.info("Socket disconnected", { id: socket.id, ip, reason });
    });
  });

  function getStats() {
    const now = Date.now();
    prune60s(now);
    return {
      now,
      online: onlineCount(),
      queueSize: queue.size(),
      activeRooms: privateRooms.activeRoomsCount(),
      publicRoomsActive: publicChannels.activeRoomsCount(),
      publicRoomUsers: publicChannels.activeUsersCount(),
      publicMessages: publicChannels.messagesTotal(),
      totals: { matches: matchesTotal, messages: messagesTotal },
      last60s: { matches: matchTs.length, messages: msgTs.length },
      reports: abuse.reportsInWindow(),
      bansActive: abuse.activeBansCount()
    };
  }

  return {
    getPartnerSocketId: (socketId: string) => privateRooms.getPartner(socketId),
    getIpBySocketId: (socketId: string) => abuse.getIpBySocketId(socketId),
    getPublicChannelPresence: () => publicChannels.presenceCounts(),

    reportIp: (targetIp: string, type: ReportType) => abuse.addReport(targetIp, type),
    banIpAuto: (ip: string, type: ReportType) => abuse.banIpAuto(ip, type),
    isWhitelistedIp: (ip: string) => abuse.isWhitelisted(ip),
    listBans: () => abuse.listBans(),
    unbanIp: (ip: string) => abuse.unbanIp(ip),
    banManual: (ip: string, durationMs: number, reason: ReportType, note?: string) =>
      abuse.banIpManual(ip, durationMs, reason, note),
    getStats
  };
}
