import fs from "fs";
import path from "path";
import { config } from "../config";
import { logger } from "../utils/logger";

export type ReportType = "bot" | "abuse";

export type BanSource = "auto" | "manual";

export type BanRecord = {
  ip: string;
  until: number;
  flagged: boolean;
  reasons: Record<ReportType, number>;
  createdAt: number;
  updatedAt: number;
  note?: string;
  source: BanSource;
};

export class AbuseService {
  private socketIdToIp = new Map<string, string>();
  private ipToSocketCount = new Map<string, number>();

  private reports = new Map<string, { bot: number[]; abuse: number[] }>();
  private bans = new Map<string, BanRecord>();

  constructor() {
    this.loadBans();
    setInterval(() => this.cleanup(), 30_000).unref();
  }

  registerSocket(socketId: string, ip: string) {
    this.socketIdToIp.set(socketId, ip);
    this.ipToSocketCount.set(ip, (this.ipToSocketCount.get(ip) ?? 0) + 1);
  }

  unregisterSocket(socketId: string) {
    const ip = this.socketIdToIp.get(socketId);
    if (!ip) return;

    this.socketIdToIp.delete(socketId);

    const next = (this.ipToSocketCount.get(ip) ?? 1) - 1;
    if (next <= 0) this.ipToSocketCount.delete(ip);
    else this.ipToSocketCount.set(ip, next);
  }

  getIpBySocketId(socketId: string) {
    return this.socketIdToIp.get(socketId);
  }

  socketsForIp(ip: string) {
    return this.ipToSocketCount.get(ip) ?? 0;
  }

  isWhitelisted(ip: string) {
    return config.ipWhitelist.includes(ip);
  }

  isBanned(ip: string) {
    const ban = this.bans.get(ip);
    if (!ban) return false;

    if (Date.now() >= ban.until) {
      this.bans.delete(ip);
      this.persistBans();
      return false;
    }
    return true;
  }

  getBan(ip: string) {
    return this.bans.get(ip);
  }

  activeBansCount() {
    const now = Date.now();
    let n = 0;
    for (const b of this.bans.values()) {
      if (b.until > now) n++;
    }
    return n;
  }

  listBans() {
    const now = Date.now();
    const out = [...this.bans.values()].filter((b) => b.until > now);
    out.sort((a, b) => b.updatedAt - a.updatedAt);
    return out;
  }

  unbanIp(ip: string) {
    const existed = this.bans.delete(ip);
    if (existed) this.persistBans();
    return existed;
  }

  // automatic ban (reports)
  banIpAuto(ip: string, reason: ReportType) {
    return this.upsertBan({
      ip,
      durationMs: config.banDurationMs,
      source: "auto",
      reason,
      note: undefined
    });
  }

  // manual ban (admin page)
  banIpManual(ip: string, durationMs: number, reason: ReportType, note?: string) {
    const safeDuration = Math.max(60_000, Math.min(durationMs, 30 * 24 * 60 * 60 * 1000)); // 1m..30d
    return this.upsertBan({
      ip,
      durationMs: safeDuration,
      source: "manual",
      reason,
      note
    });
  }

  private upsertBan(input: {
    ip: string;
    durationMs: number;
    source: BanSource;
    reason: ReportType;
    note?: string;
  }) {
    const now = Date.now();
    const existing = this.bans.get(input.ip);
    const until = now + input.durationMs;

    const record: BanRecord = existing
      ? {
          ...existing,
          until: Math.max(existing.until, until), // extend if needed
          flagged: true,
          source: input.source,
          note: input.note ?? existing.note,
          reasons: {
            ...existing.reasons,
            [input.reason]: (existing.reasons[input.reason] ?? 0) + 1
          },
          updatedAt: now
        }
      : {
          ip: input.ip,
          until,
          flagged: true,
          source: input.source,
          note: input.note,
          reasons: { bot: 0, abuse: 0, [input.reason]: 1 } as Record<ReportType, number>,
          createdAt: now,
          updatedAt: now
        };

    this.bans.set(input.ip, record);
    this.persistBans();

    logger.warn("IP banned", {
      ip: input.ip,
      until: record.until,
      reason: input.reason,
      source: input.source
    });

    return record;
  }

  addReport(targetIp: string, type: ReportType) {
    const now = Date.now();
    const bucket = this.reports.get(targetIp) ?? { bot: [], abuse: [] };
    bucket[type].push(now);
    this.reports.set(targetIp, bucket);

    this.prune(targetIp);

    const botCount = bucket.bot.length;
    const abuseCount = bucket.abuse.length;

    const shouldBan =
      (type === "bot" && botCount >= config.reportBotThreshold) ||
      (type === "abuse" && abuseCount >= config.reportAbuseThreshold);

    return { botCount, abuseCount, shouldBan };
  }

  reportsInWindow() {
    const cutoff = Date.now() - config.reportWindowMs;
    let bot = 0;
    let abuse = 0;

    for (const v of this.reports.values()) {
      bot += v.bot.filter((t) => t >= cutoff).length;
      abuse += v.abuse.filter((t) => t >= cutoff).length;
    }

    return { bot, abuse, windowMs: config.reportWindowMs };
  }

  private prune(ip: string) {
    const bucket = this.reports.get(ip);
    if (!bucket) return;
    const cutoff = Date.now() - config.reportWindowMs;
    bucket.bot = bucket.bot.filter((t) => t >= cutoff);
    bucket.abuse = bucket.abuse.filter((t) => t >= cutoff);
  }

  private cleanup() {
    // prune reports
    for (const ip of this.reports.keys()) {
      this.prune(ip);
      const b = this.reports.get(ip)!;
      if (!b.bot.length && !b.abuse.length) this.reports.delete(ip);
    }

    // expire bans
    let changed = false;
    for (const [ip, ban] of this.bans.entries()) {
      if (Date.now() >= ban.until) {
        this.bans.delete(ip);
        changed = true;
      }
    }
    if (changed) this.persistBans();
  }

  private loadBans() {
    try {
      const p = path.resolve(config.banPersistPath);
      if (!fs.existsSync(p)) return;

      const raw = fs.readFileSync(p, "utf-8");
      const arr: BanRecord[] = JSON.parse(raw);

      for (const r of arr) {
        if (r?.ip && r?.until) this.bans.set(r.ip, r);
      }
      logger.info("Loaded bans", { count: this.bans.size });
    } catch (e) {
      logger.error("Failed to load bans", { error: String(e) });
    }
  }

  private persistBans() {
    try {
      const p = path.resolve(config.banPersistPath);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify([...this.bans.values()], null, 2));
    } catch (e) {
      logger.error("Failed to persist bans", { error: String(e) });
    }
  }
}