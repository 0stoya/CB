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
import {
  AdminUserError,
  getAdminUser,
  listAdminUsers,
  revokeAdminUserSessions,
  setAdminUserStatus
} from "../services/adminUsers";
import {
  getOperationsOverview,
  listDailyMetrics,
  rebuildDailyMetrics,
  runMaintenance
} from "../services/operations";

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

const adminUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  reason: z.string().trim().max(500).optional()
});

const adminReasonSchema = z.object({ reason: z.string().trim().max(500).optional() });

function adminUsername(req: Request) {
  return (req as Request & { session?: { username?: string } }).session?.username || "admin";
}

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

  router.get("/operations", requireAdminIp, requireAdminSession, asyncRoute(async (_req, res) => {
    res.json({ ok: true, operations: await getOperationsOverview() });
  }));

  router.post("/operations/smtp-check", requireAdminIp, requireAdminSession, asyncRoute(async (_req, res) => {
    res.json({ ok: true, operations: await getOperationsOverview({ verifySmtp: true }) });
  }));

  router.post("/operations/maintenance", requireAdminIp, requireAdminSession, asyncRoute(async (_req, res) => {
    res.json({ ok: true, result: await runMaintenance() });
  }));

  router.get("/analytics", requireAdminIp, requireAdminSession, asyncRoute(async (req, res) => {
    const rawDays = Number(req.query.days || 30);
    const days = Math.min(90, Math.max(1, Number.isFinite(rawDays) ? Math.floor(rawDays) : 30));
    res.json({ ok: true, days, metrics: await listDailyMetrics(days) });
  }));

  router.post("/analytics/rebuild", requireAdminIp, requireAdminSession, asyncRoute(async (req, res) => {
    const parsed = z.object({ days: z.number().int().min(1).max(90).default(30) }).safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_ANALYTICS_RANGE" });
    res.json({ ok: true, metrics: await rebuildDailyMetrics(parsed.data.days) });
  }));

  router.get("/users", requireAdminIp, requireAdminSession, asyncRoute(async (req, res) => {
    const rawStatus = typeof req.query.status === "string" ? req.query.status : "";
    const status = ["ACTIVE", "SUSPENDED", "DELETED"].includes(rawStatus)
      ? (rawStatus as "ACTIVE" | "SUSPENDED" | "DELETED")
      : undefined;
    const result = await listAdminUsers({
      query: typeof req.query.q === "string" ? req.query.q : undefined,
      status,
      page: Number(req.query.page || 1),
      pageSize: Number(req.query.pageSize || 25)
    });
    res.json({ ok: true, ...result });
  }));

  router.get("/users/:id", requireAdminIp, requireAdminSession, asyncRoute(async (req, res) => {
    res.json({ ok: true, user: await getAdminUser(req.params.id) });
  }));

  router.patch("/users/:id/status", requireAdminIp, requireAdminSession, asyncRoute(async (req, res) => {
    const parsed = adminUserStatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_USER_STATUS" });
    const user = await setAdminUserStatus({
      userId: req.params.id,
      status: parsed.data.status,
      reason: parsed.data.reason,
      adminUsername: adminUsername(req)
    });
    if (parsed.data.status === "SUSPENDED") await socketApi.disconnectAccount(req.params.id);
    res.json({ ok: true, user });
  }));

  router.post("/users/:id/revoke-sessions", requireAdminIp, requireAdminSession, asyncRoute(async (req, res) => {
    const parsed = adminReasonSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_REASON" });
    const revoked = await revokeAdminUserSessions({
      userId: req.params.id,
      reason: parsed.data.reason,
      adminUsername: adminUsername(req)
    });
    await socketApi.disconnectAccount(req.params.id);
    res.json({ ok: true, revoked });
  }));

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
      const result = await reviewReport({
        reportId: req.params.id,
        adminUsername: adminUsername(req),
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
    if (error instanceof ChannelError || error instanceof ModerationError || error instanceof AdminUserError) {
      return res.status(error.status).json({ ok: false, error: error.code });
    }
    next(error);
  });

  return router;
}
