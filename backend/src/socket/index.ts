import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { config } from "../config";
import { logger } from "../utils/logger";
import { MatchmakingQueue } from "../services/matchmaking";
import { RoomService } from "../services/rooms";
import { TokenBucketLimiter } from "../utils/TokenBucketLimiter";
import { AbuseService, ReportType } from "../services/abuse";

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
  for (const w of config.bannedWords) {
    const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
    out = out.replace(re, "***");
  }
  return out;
}

// -------------------- clientId + rematch cooldown --------------------
const REMATCH_COOLDOWN_MS = 30 * 60 * 1000;

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function normalizeIp(ip: string) {
  const s = (ip || "").trim();
  if (!s) return "";
  if (s.startsWith("::ffff:")) return s.slice(7);
  return s;
}

function clientIdOf(socket: Socket): string | null {
  const auth = socket.handshake.auth as any;
  const cid =
    (typeof auth?.clientId === "string" && auth.clientId.trim()) ||
    (typeof socket.handshake.query?.clientId === "string" &&
      (socket.handshake.query.clientId as string).trim());

  if (!cid) return null;
  if (cid.length > 100) return null; // safety cap
  return cid;
}

function ipOf(socket: Socket) {
  const xReal = socket.handshake.headers["x-real-ip"];
  if (typeof xReal === "string" && xReal.trim()) return normalizeIp(xReal);

  const xfwd = socket.handshake.headers["x-forwarded-for"];
  const raw = typeof xfwd === "string" ? xfwd : Array.isArray(xfwd) ? xfwd[0] : "";
  if (raw && raw.trim()) return normalizeIp(raw.split(",")[0]!.trim());

  const addr = socket.handshake.address;
  if (typeof addr === "string" && addr.trim()) return normalizeIp(addr);

  return "unknown";
}
// --------------------------------------------------------------------

export function registerSocketHandlers(io: Server) {
  const queue = new MatchmakingQueue();
  const rooms = new RoomService();
  const abuse = new AbuseService();

  let matchesTotal = 0;
  let messagesTotal = 0;

  const matchTs: number[] = [];
  const msgTs: number[] = [];

  function prune60s(now = Date.now()) {
    const cutoff = now - 60_000;
    while (matchTs.length && matchTs[0] < cutoff) matchTs.shift();
    while (msgTs.length && msgTs[0] < cutoff) msgTs.shift();
  }

  const msgLimiterSocket = new TokenBucketLimiter(
    config.msgRateLimitPerSec,
    config.msgRateBurst
  );
  const msgLimiterIp = new TokenBucketLimiter(
    config.msgRateLimitPerSec,
    config.msgRateBurst
  );

  const lastTypingAt = new Map<string, { start: number; stop: number }>();

  // ✅ last match time per (clientIdA, clientIdB)
  const lastMatchedByPair = new Map<string, number>();

  function isPairOnCooldown(cidA: string, cidB: string, now: number) {
    const last = lastMatchedByPair.get(pairKey(cidA, cidB)) ?? 0;
    return now - last < REMATCH_COOLDOWN_MS;
  }

  function markMatched(cidA: string, cidB: string, now: number) {
    lastMatchedByPair.set(pairKey(cidA, cidB), now);
  }

  function prunePairCooldown(now = Date.now()) {
    const cutoff = now - REMATCH_COOLDOWN_MS;
    for (const [k, ts] of lastMatchedByPair.entries()) {
      if (ts < cutoff) lastMatchedByPair.delete(k);
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
    let aId: string | undefined;
    let a: Socket | undefined; 

    
    while (true) {
      aId = queue.popNextValid();
      if (!aId) return; 
      
      a = io.sockets.sockets.get(aId);
      if (a && !rooms.isInRoom(aId)) {
        break; 
      }
    }

    const aCid = (a.data as any).clientId as string | undefined;
    if (!aCid) {
      queue.add(aId);
      return;
    }

    const now = Date.now();
    const tried: string[] = [];
    let bId: string | null = null;

    const MAX_TRIES = 60;

    for (let i = 0; i < MAX_TRIES; i++) {
      const candidate = queue.popNextValid();
      if (!candidate) break;

      if (candidate === aId) {
        tried.push(candidate);
        continue;
      }

      const b = io.sockets.sockets.get(candidate);
      if (!b || rooms.isInRoom(candidate)) {
        tried.push(candidate);
        continue;
      }

      const bCid = (b.data as any).clientId as string | undefined;
      if (!bCid) {
        tried.push(candidate);
        continue;
      }

      if (isPairOnCooldown(aCid, bCid, now)) {
        tried.push(candidate);
        continue;
      }

      bId = candidate;
      break;
    }

    for (const id of tried) queue.add(id);

    if (!bId) {
      queue.add(aId);
      return;
    }

    const b = io.sockets.sockets.get(bId);
    if (!b) {
      queue.add(aId);
      return;
    }

    rooms.createRoom(a, b);

    a.emit("user.connected");
    b.emit("user.connected");

    const bCid = (b.data as any).clientId as string;
    markMatched(aCid, bCid, now);

    matchesTotal += 1;
    matchTs.push(now);

    broadcastOnline();
    logger.info("Matched users", { a: aId, b: bId });
  }

  // ✅ auto start new chat for remaining user after partner disconnect/leave
  function disconnectPartner(socket: Socket) {
    const partnerId = rooms.getPartner(socket.id);
    const roomId = rooms.getRoom(socket.id);

    rooms.clear(socket.id);
    if (roomId) socket.leave(roomId);

    if (partnerId) {
      const partner = io.sockets.sockets.get(partnerId);
      if (partner) {
        rooms.clear(partnerId);
        if (roomId) partner.leave(roomId);
        partner.emit("user.disconnected");

        // ✅ Auto requeue partner (the one who did NOT initiate leave/disconnect)
        if (!rooms.isInRoom(partnerId)) {
          queue.add(partnerId);
          tryMatch();
        }
      }
    }
  }

  io.on("connection", (socket) => {
    // ✅ Require stable anonymous identity (not IP-based)
    const clientId = clientIdOf(socket);
    if (!clientId) {
      socket.disconnect(true);
      return;
    }
    (socket.data as any).clientId = clientId;

    const ip = ipOf(socket);

    // keep your existing ban/whitelist & per-ip socket cap logic (still needed for abuse control)
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

    socket.on("join", () => {
      if (rooms.isInRoom(socket.id)) return;
      queue.add(socket.id);
      tryMatch();
    });

    socket.on("leave.chat", () => {
      queue.remove(socket.id);

      // If user leaves while in a room, partner should get requeued automatically
      if (rooms.isInRoom(socket.id)) disconnectPartner(socket);
    });

    socket.on("send.message", (payload) => {
      const parsed = sendMessageSchema.safeParse(payload);
      if (!parsed.success) return;
      if (!rooms.isInRoom(socket.id)) return;

      const now = Date.now();
      if (!msgLimiterSocket.allow(`s:${socket.id}`, now)) return;
      if (!msgLimiterIp.allow(`ip:${ip}`, now)) return;

      let text = sanitizeText(parsed.data.text);
      if (!text) return;

      if (text.length > config.maxMessageLength) text = text.slice(0, config.maxMessageLength);
      text = applyBannedWords(text);

      const partnerId = rooms.getPartner(socket.id);
      if (!partnerId) return;

      const partner = io.sockets.sockets.get(partnerId);
      if (!partner) return;

      partner.emit("receive_message", { text });

      messagesTotal += 1;
      msgTs.push(now);
    });

    socket.on("user.start_writing", () => {
      if (!rooms.isInRoom(socket.id)) return;

      const last = lastTypingAt.get(socket.id) ?? { start: 0, stop: 0 };
      const now = Date.now();
      if (now - last.start < config.typingThrottleMs) return;
      last.start = now;
      lastTypingAt.set(socket.id, last);

      const partnerId = rooms.getPartner(socket.id);
      const partner = partnerId ? io.sockets.sockets.get(partnerId) : undefined;
      if (partner) partner.emit("user.start_writing");
    });

    socket.on("user.stop_writing", () => {
      if (!rooms.isInRoom(socket.id)) return;

      const last = lastTypingAt.get(socket.id) ?? { start: 0, stop: 0 };
      const now = Date.now();
      if (now - last.stop < config.typingThrottleMs) return;
      last.stop = now;
      lastTypingAt.set(socket.id, last);

      const partnerId = rooms.getPartner(socket.id);
      const partner = partnerId ? io.sockets.sockets.get(partnerId) : undefined;
      if (partner) partner.emit("user.stop_writing");
    });

    socket.on("disconnect", (reason) => {
      queue.remove(socket.id);

      // if socket disconnects while in a room, partner gets auto-requeued
      if (rooms.isInRoom(socket.id)) disconnectPartner(socket);

      abuse.unregisterSocket(socket.id);
      broadcastOnline();

      logger.info("Socket disconnected", { id: socket.id, ip, reason });
    });
  });

  function getStats() {
    const now = Date.now();
    prune60s(now);
    const reports = abuse.reportsInWindow();
    return {
      now,
      online: onlineCount(),
      queueSize: queue.size(),
      activeRooms: rooms.activeRoomsCount(),
      totals: { matches: matchesTotal, messages: messagesTotal },
      last60s: { matches: matchTs.length, messages: msgTs.length },
      reports,
      bansActive: abuse.activeBansCount()
    };
  }

  return {
    getPartnerSocketId: (socketId: string) => rooms.getPartner(socketId),
    getIpBySocketId: (socketId: string) => abuse.getIpBySocketId(socketId),

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