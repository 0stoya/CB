"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdminRoutes = createAdminRoutes;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = require("../config");
const auth_1 = require("../middleware/auth");
const rateLimit_1 = require("../middleware/rateLimit");
const contact_1 = require("../services/contact");
function createAdminRoutes(socketApi) {
    const router = (0, express_1.Router)();
    // Dodajemy loginLimiter przeciwko atakom Brute-Force
    router.post("/login", auth_1.requireAdminIp, rateLimit_1.loginLimiter, async (req, res) => {
        const username = typeof req.body?.username === "string" ? req.body.username : "";
        const password = typeof req.body?.password === "string" ? req.body.password : "";
        if (!config_1.config.adminUsername || !config_1.config.adminPasswordHash) {
            return res.status(500).json({ ok: false, error: "ADMIN credentials not set" });
        }
        if (username !== config_1.config.adminUsername)
            return res.status(401).json({ ok: false, error: "invalid credentials" });
        const ok = await bcryptjs_1.default.compare(password, config_1.config.adminPasswordHash);
        if (!ok)
            return res.status(401).json({ ok: false, error: "invalid credentials" });
        const sess = req.session;
        sess.isAdmin = true;
        sess.username = username;
        return res.json({ ok: true });
    });
    router.post("/logout", auth_1.requireAdminIp, (req, res) => {
        req.session.destroy(() => {
            res.clearCookie("chati_admin");
            res.json({ ok: true });
        });
    });
    router.get("/me", auth_1.requireAdminIp, (req, res) => {
        const sess = req.session;
        res.json({ ok: true, isAdmin: sess?.isAdmin === true, username: sess?.username ?? null });
    });
    router.get("/stats", auth_1.requireAdminIp, auth_1.requireAdminSession, (_req, res) => {
        res.json({ ok: true, ...socketApi.getStats() });
    });
    router.get("/bans", auth_1.requireAdminIp, auth_1.requireAdminSession, (_req, res) => {
        res.json({ ok: true, bans: socketApi.listBans() });
    });
    router.post("/bans/ban", auth_1.requireAdminIp, auth_1.requireAdminSession, (req, res) => {
        const ip = typeof req.body?.ip === "string" ? req.body.ip.trim() : "";
        const reason = req.body?.reason === "bot" || req.body?.reason === "abuse" ? req.body.reason : null;
        const durationMs = Number(req.body?.durationMs);
        const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : undefined;
        if (!ip)
            return res.status(400).json({ ok: false, error: "ip required" });
        if (!reason)
            return res.status(400).json({ ok: false, error: "reason must be bot|abuse" });
        if (!Number.isFinite(durationMs) || durationMs <= 0)
            return res.status(400).json({ ok: false, error: "durationMs required" });
        if (socketApi.isWhitelistedIp(ip))
            return res.status(400).json({ ok: false, error: "cannot ban whitelisted ip" });
        const ban = socketApi.banManual(ip, durationMs, reason, note);
        return res.json({ ok: true, ban });
    });
    router.post("/bans/unban", auth_1.requireAdminIp, auth_1.requireAdminSession, (req, res) => {
        const ip = typeof req.body?.ip === "string" ? req.body.ip.trim() : "";
        if (!ip)
            return res.status(400).json({ ok: false, error: "ip required" });
        const unbanned = socketApi.unbanIp(ip);
        return res.json({ ok: true, unbanned });
    });
    router.get("/messages", auth_1.requireAdminIp, auth_1.requireAdminSession, (_req, res) => {
        res.json({ ok: true, messages: contact_1.contactService.getMessages() });
    });
    router.post("/messages/delete", auth_1.requireAdminIp, auth_1.requireAdminSession, (req, res) => {
        const id = req.body?.id;
        if (id)
            contact_1.contactService.deleteMessage(id);
        res.json({ ok: true });
    });
    return router;
}
