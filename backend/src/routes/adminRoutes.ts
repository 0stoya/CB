import { Router } from "express";
import bcrypt from "bcryptjs";
import { config } from "../config";
import { requireAdminIp, requireAdminSession } from "../middleware/auth";
import { loginLimiter } from "../middleware/rateLimit";
import { contactService } from "../services/contact"; 
export function createAdminRoutes(socketApi: any) {
  const router = Router();

  // Dodajemy loginLimiter przeciwko atakom Brute-Force
  router.post("/login", requireAdminIp, loginLimiter, async (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!config.adminUsername || !config.adminPasswordHash) {
      return res.status(500).json({ ok: false, error: "ADMIN credentials not set" });
    }

    if (username !== config.adminUsername) return res.status(401).json({ ok: false, error: "invalid credentials" });

    const ok = await bcrypt.compare(password, config.adminPasswordHash);
    if (!ok) return res.status(401).json({ ok: false, error: "invalid credentials" });

    const sess = (req as any).session;
    sess.isAdmin = true;
    sess.username = username;

    return res.json({ ok: true });
  });

  router.post("/logout", requireAdminIp, (req, res) => {
    (req as any).session.destroy(() => {
      res.clearCookie("chati_admin");
      res.json({ ok: true });
    });
  });

  router.get("/me", requireAdminIp, (req, res) => {
    const sess = (req as any).session;
    res.json({ ok: true, isAdmin: sess?.isAdmin === true, username: sess?.username ?? null });
  });

  router.get("/stats", requireAdminIp, requireAdminSession, (_req, res) => {
    res.json({ ok: true, ...socketApi.getStats() });
  });

  router.get("/bans", requireAdminIp, requireAdminSession, (_req, res) => {
    res.json({ ok: true, bans: socketApi.listBans() });
  });

  router.post("/bans/ban", requireAdminIp, requireAdminSession, (req, res) => {
    const ip = typeof req.body?.ip === "string" ? req.body.ip.trim() : "";
    const reason = req.body?.reason === "bot" || req.body?.reason === "abuse" ? req.body.reason : null;
    const durationMs = Number(req.body?.durationMs);
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : undefined;

    if (!ip) return res.status(400).json({ ok: false, error: "ip required" });
    if (!reason) return res.status(400).json({ ok: false, error: "reason must be bot|abuse" });
    if (!Number.isFinite(durationMs) || durationMs <= 0) return res.status(400).json({ ok: false, error: "durationMs required" });

    if (socketApi.isWhitelistedIp(ip)) return res.status(400).json({ ok: false, error: "cannot ban whitelisted ip" });

    const ban = socketApi.banManual(ip, durationMs, reason, note);
    return res.json({ ok: true, ban });
  });

  router.post("/bans/unban", requireAdminIp, requireAdminSession, (req, res) => {
    const ip = typeof req.body?.ip === "string" ? req.body.ip.trim() : "";
    if (!ip) return res.status(400).json({ ok: false, error: "ip required" });

    const unbanned = socketApi.unbanIp(ip);
    return res.json({ ok: true, unbanned });
  });
router.get("/messages", requireAdminIp, requireAdminSession, (_req, res) => {
    res.json({ ok: true, messages: contactService.getMessages() });
  });

  router.post("/messages/delete", requireAdminIp, requireAdminSession, (req, res) => {
    const id = req.body?.id;
    if (id) contactService.deleteMessage(id);
    res.json({ ok: true });
  });
  return router;
}