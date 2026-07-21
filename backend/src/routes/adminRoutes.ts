import { Router, type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { config } from "../config";
import { requireAdminIp, requireAdminSession } from "../middleware/auth";
import { loginLimiter } from "../middleware/rateLimit";
import { contactService } from "../services/contact";
import {
  ChannelError,
  adminDeleteChannel,
  adminUpdateChannel,
  listChannels
} from "../services/channels";
import {
  ModerationError,
  listModerationActions,
  listReports,
  reviewReport
} from "../services/moderation";

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

const channelUpdateSchema = z.object({
  topic: z.string().max(240).nullable().optional(),
  allowGuests: z.boolean().optional(),
  slowModeSeconds: z.number().int().min(0).max(300).optional(),
  protectedFromExpiry: z.boolean().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "DELETED"]).optional()
});

const reportReviewSchema = z.object({
  status: z.enum(["REVIEWING", "RESOLVED", "DISMISSED"]),
  action: z.enum(["NONE", "DELETE_CONTENT", "SUSPEND_USER", "ARCHIVE_ROOM"]).optional(),
  resolutionNote: z.string().trim().max(1000).optional()
});

export function createAdminRoutes(socketApi: any) {
  const router = Router();

  router.post("/login", requireAdminIp, loginLimiter, async (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!config.adminUsername || !config.adminPasswordHash) {
      return res.status(500).json({ ok: false, error: "ADMIN credentials not set" });
    }
    if (username !== config.adminUsername) return res.status(401).json({ ok: false, error: "invalid credentials" });
    const ok = await bcrypt.compare(password, config.adminPasswordHash);
    if (!ok) return res.status(401).json({ ok: false, error: "invalid credentials" });
    const session = (req as any).session;
    session.isAdmin = true;
    session.username = username;
    return res.json({ ok: true });
  });

  router.post("/logout", requireAdminIp, (req, res) => {
    (req as any).session.destroy(() => {
      res.clearCookie("chati_admin");
      res.json({ ok: true });
    });
  });

  router.get("/me", requireAdminIp, (req, res) => {
    const session = (req as any).session;
    res.json({ ok: true, isAdmin: session?.isAdmin === true, username: session?.username ?? null });
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
    return res.json({ ok: true, ban: socketApi.banManual(ip, durationMs, reason, note) });
  });

  router.post("/bans/unban", requireAdminIp, requireAdminSession, (req, res) => {
    const ip = typeof req.body?.ip === "string" ? req.body.ip.trim() : "";
    if (!ip) return res.status(400).json({ ok: false, error: "ip required" });
    return res.json({ ok: true, unbanned: socketApi.unbanIp(ip) });
  });

  router.get("/messages", requireAdminIp, requireAdminSession, (_req, res) => {
    res.json({ ok: true, messages: contactService.getMessages() });
  });

  router.post("/messages/delete", requireAdminIp, requireAdminSession, (req, res) => {
    const id = req.body?.id;
    if (id) contactService.deleteMessage(id);
    res.json({ ok: true });
  });

  router.get(
    "/channels",
    requireAdminIp,
    requireAdminSession,
    asyncRoute(async (_req, res) => {
      const channels = await listChannels(socketApi.getPublicChannelPresence(), null, {
        includeUnlisted: true,
        includeInactive: true
      });
      res.json({ ok: true, channels });
    })
  );

  router.patch(
    "/channels/:id",
    requireAdminIp,
    requireAdminSession,
    asyncRoute(async (req, res) => {
      const parsed = channelUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_CHANNEL_UPDATE" });
      const channel = await adminUpdateChannel(req.params.id, parsed.data);
      res.json({ ok: true, channel });
    })
  );

  router.delete(
    "/channels/:id",
    requireAdminIp,
    requireAdminSession,
    asyncRoute(async (req, res) => {
      await adminDeleteChannel(req.params.id);
      res.json({ ok: true });
    })
  );

  router.get(
    "/reports",
    requireAdminIp,
    requireAdminSession,
    asyncRoute(async (req, res) => {
      const raw = typeof req.query.status === "string" ? req.query.status : "";
      const status = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"].includes(raw)
        ? (raw as "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED")
        : undefined;
      res.json({ ok: true, reports: await listReports(status) });
    })
  );

  router.patch(
    "/reports/:id",
    requireAdminIp,
    requireAdminSession,
    asyncRoute(async (req, res) => {
      const parsed = reportReviewSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_REPORT_REVIEW" });
      const username = (req as any).session?.username || "admin";
      const result = await reviewReport({
        reportId: req.params.id,
        adminUsername: username,
        status: parsed.data.status,
        action: parsed.data.action,
        resolutionNote: parsed.data.resolutionNote
      });
      if (result.liveEffect?.type === "CHANNEL_MESSAGE_DELETED") {
        socketApi.emitPublicChannelMessageDeleted(result.liveEffect.slug, result.liveEffect.messageId);
      } else if (result.liveEffect?.type === "ROOM_ARCHIVED") {
        await socketApi.archivePublicChannelLive(result.liveEffect.slug);
      } else if (result.liveEffect?.type === "USER_SUSPENDED") {
        await socketApi.disconnectAccount(result.liveEffect.userId);
      }
      res.json({ ok: true, report: result.report });
    })
  );

  router.get(
    "/moderation-actions",
    requireAdminIp,
    requireAdminSession,
    asyncRoute(async (_req, res) => {
      res.json({ ok: true, actions: await listModerationActions() });
    })
  );

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof ChannelError || error instanceof ModerationError) {
      return res.status(error.status).json({ ok: false, error: error.code });
    }
    next(error);
  });

  return router;
}
