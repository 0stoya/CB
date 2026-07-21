import { Router, type Request } from "express";
import { z } from "zod";
import { requireVerifiedUser } from "../services/accountAuth";
import {
  listNotifications,
  markAllNotificationsRead,
  markLinkNotificationsRead,
  markNotificationRead
} from "../services/notifications";
import type { NotificationRuntime } from "../socket/notifications";

type AccountRequest = Request & { accountUser: { id: string } };

function userId(req: Request) {
  return (req as AccountRequest).accountUser.id;
}

export function createNotificationRoutes(runtime: NotificationRuntime) {
  const router = Router();
  router.use(requireVerifiedUser);

  router.get("/", async (req, res, next) => {
    try {
      const limit = Number(req.query.limit || 50);
      const result = await listNotifications(userId(req), Number.isFinite(limit) ? limit : 50);
      res.json({ ok: true, notifications: result.items, unread: result.unread });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/read", async (req, res, next) => {
    try {
      const result = await markNotificationRead(userId(req), req.params.id);
      runtime.emitChanged(userId(req));
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  router.post("/read-all", async (req, res, next) => {
    try {
      const readAt = await markAllNotificationsRead(userId(req));
      runtime.emitChanged(userId(req));
      res.json({ ok: true, readAt });
    } catch (error) {
      next(error);
    }
  });

  router.post("/read-link", async (req, res, next) => {
    try {
      const parsed = z.object({ link: z.string().trim().min(1).max(500) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_LINK" });
      const readAt = await markLinkNotificationsRead(userId(req), parsed.data.link);
      runtime.emitChanged(userId(req));
      res.json({ ok: true, readAt });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
