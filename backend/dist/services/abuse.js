"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbuseService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
class AbuseService {
    socketIdToIp = new Map();
    ipToSocketCount = new Map();
    reports = new Map();
    bans = new Map();
    constructor() {
        this.loadBans();
        setInterval(() => this.cleanup(), 30_000).unref();
    }
    registerSocket(socketId, ip) {
        this.socketIdToIp.set(socketId, ip);
        this.ipToSocketCount.set(ip, (this.ipToSocketCount.get(ip) ?? 0) + 1);
    }
    unregisterSocket(socketId) {
        const ip = this.socketIdToIp.get(socketId);
        if (!ip)
            return;
        this.socketIdToIp.delete(socketId);
        const next = (this.ipToSocketCount.get(ip) ?? 1) - 1;
        if (next <= 0)
            this.ipToSocketCount.delete(ip);
        else
            this.ipToSocketCount.set(ip, next);
    }
    getIpBySocketId(socketId) {
        return this.socketIdToIp.get(socketId);
    }
    socketsForIp(ip) {
        return this.ipToSocketCount.get(ip) ?? 0;
    }
    isWhitelisted(ip) {
        return config_1.config.ipWhitelist.includes(ip);
    }
    isBanned(ip) {
        const ban = this.bans.get(ip);
        if (!ban)
            return false;
        if (Date.now() >= ban.until) {
            this.bans.delete(ip);
            this.persistBans();
            return false;
        }
        return true;
    }
    getBan(ip) {
        return this.bans.get(ip);
    }
    activeBansCount() {
        const now = Date.now();
        let n = 0;
        for (const b of this.bans.values()) {
            if (b.until > now)
                n++;
        }
        return n;
    }
    listBans() {
        const now = Date.now();
        const out = [...this.bans.values()].filter((b) => b.until > now);
        out.sort((a, b) => b.updatedAt - a.updatedAt);
        return out;
    }
    unbanIp(ip) {
        const existed = this.bans.delete(ip);
        if (existed)
            this.persistBans();
        return existed;
    }
    // automatic ban (reports)
    banIpAuto(ip, reason) {
        return this.upsertBan({
            ip,
            durationMs: config_1.config.banDurationMs,
            source: "auto",
            reason,
            note: undefined
        });
    }
    // manual ban (admin page)
    banIpManual(ip, durationMs, reason, note) {
        const safeDuration = Math.max(60_000, Math.min(durationMs, 30 * 24 * 60 * 60 * 1000)); // 1m..30d
        return this.upsertBan({
            ip,
            durationMs: safeDuration,
            source: "manual",
            reason,
            note
        });
    }
    upsertBan(input) {
        const now = Date.now();
        const existing = this.bans.get(input.ip);
        const until = now + input.durationMs;
        const record = existing
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
                reasons: { bot: 0, abuse: 0, [input.reason]: 1 },
                createdAt: now,
                updatedAt: now
            };
        this.bans.set(input.ip, record);
        this.persistBans();
        logger_1.logger.warn("IP banned", {
            ip: input.ip,
            until: record.until,
            reason: input.reason,
            source: input.source
        });
        return record;
    }
    addReport(targetIp, type) {
        const now = Date.now();
        const bucket = this.reports.get(targetIp) ?? { bot: [], abuse: [] };
        bucket[type].push(now);
        this.reports.set(targetIp, bucket);
        this.prune(targetIp);
        const botCount = bucket.bot.length;
        const abuseCount = bucket.abuse.length;
        const shouldBan = (type === "bot" && botCount >= config_1.config.reportBotThreshold) ||
            (type === "abuse" && abuseCount >= config_1.config.reportAbuseThreshold);
        return { botCount, abuseCount, shouldBan };
    }
    reportsInWindow() {
        const cutoff = Date.now() - config_1.config.reportWindowMs;
        let bot = 0;
        let abuse = 0;
        for (const v of this.reports.values()) {
            bot += v.bot.filter((t) => t >= cutoff).length;
            abuse += v.abuse.filter((t) => t >= cutoff).length;
        }
        return { bot, abuse, windowMs: config_1.config.reportWindowMs };
    }
    prune(ip) {
        const bucket = this.reports.get(ip);
        if (!bucket)
            return;
        const cutoff = Date.now() - config_1.config.reportWindowMs;
        bucket.bot = bucket.bot.filter((t) => t >= cutoff);
        bucket.abuse = bucket.abuse.filter((t) => t >= cutoff);
    }
    cleanup() {
        // prune reports
        for (const ip of this.reports.keys()) {
            this.prune(ip);
            const b = this.reports.get(ip);
            if (!b.bot.length && !b.abuse.length)
                this.reports.delete(ip);
        }
        // expire bans
        let changed = false;
        for (const [ip, ban] of this.bans.entries()) {
            if (Date.now() >= ban.until) {
                this.bans.delete(ip);
                changed = true;
            }
        }
        if (changed)
            this.persistBans();
    }
    loadBans() {
        try {
            const p = path_1.default.resolve(config_1.config.banPersistPath);
            if (!fs_1.default.existsSync(p))
                return;
            const raw = fs_1.default.readFileSync(p, "utf-8");
            const arr = JSON.parse(raw);
            for (const r of arr) {
                if (r?.ip && r?.until)
                    this.bans.set(r.ip, r);
            }
            logger_1.logger.info("Loaded bans", { count: this.bans.size });
        }
        catch (e) {
            logger_1.logger.error("Failed to load bans", { error: String(e) });
        }
    }
    persistBans() {
        try {
            const p = path_1.default.resolve(config_1.config.banPersistPath);
            fs_1.default.mkdirSync(path_1.default.dirname(p), { recursive: true });
            fs_1.default.writeFileSync(p, JSON.stringify([...this.bans.values()], null, 2));
        }
        catch (e) {
            logger_1.logger.error("Failed to persist bans", { error: String(e) });
        }
    }
}
exports.AbuseService = AbuseService;
