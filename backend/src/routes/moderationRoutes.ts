import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { getCurrentUser, requireVerifiedUser } from "../services/accountAuth";
import { createNotification } from "../services/notifications";
import {
  ModerationError,
  banChannelUser,
  createReport,
  deleteChannelMessageByModerator,
  muteChannelUser,
  recordKick,
  setChannelModerator,
  unbanChannelUser,
  unmuteChannelUser,
  updateChannelByModerator
} from "../services/moderation";
import type { NotificationRuntime } from "../socket/notifications";

const reportSchema = z.object({
  targetType: z.enum(["CHANNEL", "CHANNEL_MESSAGE", "DIRECT_MESSAGE", "USER"]),
  targetId: z.string().trim().min(1).max(200),
  reason: z.enum(["SPAM", "HARASSMENT", "HATE", "SEXUAL", "VIOLENCE", "IMPERSONATION", "ILLEGAL", "OTHER"]),
  details: z.string().trim().max(1000).optional(),
  reporterClientId: z.string().trim().min(8).max(100).optional()
});

const settingsSchema = z.object({
  topic: z.string().max(240).nullable().optional(),
  allowGuests: z.boolean().optional(),
  slowModeSeconds: z.number().int().min(0).max(300).optional(),
  isLocked: z.boolean().optional()
});

const reasonSchema = z.object({ reason: z.string().trim().max(500).optional() });
const muteSchema = reasonSchema.extend({ minutes: z.number().int().min(1).max(1440) });

type AccountRequest = Request & { accountUser: { id: string; nickname: string } };

type ModerationRuntime = {
  getPublicChannelMember: (slug: string, memberId: string) => { userId: string | null; nickname: string } | null;
  kickPublicChannelMember: (slug: string, memberId: string, reason?: string) => Promise<boolean>;
  kickPublicChannelUser: (slug: string, userId: string, reason?: string) => Promise<number>;
  emitPublicChannelMessageDeleted: (slug: string, messageId: string) => void;
  updatePublicChannelLive: (channel: {
    id: string;
    slug: string;
    topic: string | null;
    allowGuests: boolean;
    slowModeSeconds: number;
    isLocked: boolean;
  }) => void;
};

function account(req: Request) {
  return (req as AccountRequest).accountUser;
}

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

async function notify(notifications: NotificationRuntime, input: Parameters<typeof createNotification>[0]) {
  const notification = await createNotification(input);
  notifications.emitCreated(input.userId, notification);
}

export function createModerationRoutes(runtime: ModerationRuntime, notifications: NotificationRuntime) {
  const router = Router();

  router.post("/reports", asyncRoute(async (req, res) => {
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_REPORT", fields: parsed.error.flatten().fieldErrors });
    const current = await getCurrentUser(req);
    if (!current && !parsed.data.reporterClientId) return res.status(400).json({ ok: false, error: "REPORTER_ID_REQUIRED" });
    const report = await createReport({
      reporterUserId: current?.id ?? null,
      reporterClientId: current ? null : parsed.data.reporterClientId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      details: parsed.data.details
    });
    res.status(201).json({ ok: true, reportId: report.id });
  }));

  router.use(requireVerifiedUser);

  router.patch("/channels/:slug/settings", asyncRoute(async (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_ROOM_SETTINGS" });
    const channel = await updateChannelByModerator(account(req).id, req.params.slug, parsed.data);
    runtime.updatePublicChannelLive(channel);
    res.json({ ok: true, channel });
  }));

  router.post("/channels/:slug/members/:memberId/kick", asyncRoute(async (req, res) => {
    const parsed = reasonSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_REASON" });
    const member = runtime.getPublicChannelMember(req.params.slug, req.params.memberId);
    if (!member) return res.status(404).json({ ok: false, error: "CHANNEL_MEMBER_NOT_FOUND" });
    await recordKick(account(req).id, req.params.slug, member.userId, parsed.data.reason);
    await runtime.kickPublicChannelMember(req.params.slug, req.params.memberId, parsed.data.reason);
    if (member.userId) {
      await notify(notifications, {
        userId: member.userId,
        type: "ROOM_KICKED",
        title: `Usunięto Cię z #${req.params.slug}`,
        body: parsed.data.reason || `Moderator ${account(req).nickname} usunął Cię z pokoju.`,
        link: "/pokoje",
        metadata: { slug: req.params.slug, actorUserId: account(req).id }
      });
    }
    res.json({ ok: true });
  }));

  router.post("/channels/:slug/users/:targetUserId/mute", asyncRoute(async (req, res) => {
    const parsed = muteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_MUTE" });
    const restriction = await muteChannelUser(account(req).id, req.params.slug, req.params.targetUserId, parsed.data.minutes, parsed.data.reason);
    await notify(notifications, {
      userId: req.params.targetUserId,
      type: "ROOM_MUTED",
      title: `Wyciszono Cię w #${req.params.slug}`,
      body: parsed.data.reason || `Nie możesz pisać przez ${parsed.data.minutes} min.`,
      link: `/pokoje?room=${encodeURIComponent(req.params.slug)}`,
      metadata: { slug: req.params.slug, mutedUntil: restriction.mutedUntil }
    });
    res.json({ ok: true, mutedUntil: restriction.mutedUntil });
  }));

  router.delete("/channels/:slug/users/:targetUserId/mute", asyncRoute(async (req, res) => {
    await unmuteChannelUser(account(req).id, req.params.slug, req.params.targetUserId);
    res.json({ ok: true });
  }));

  router.post("/channels/:slug/users/:targetUserId/ban", asyncRoute(async (req, res) => {
    const parsed = reasonSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_REASON" });
    await banChannelUser(account(req).id, req.params.slug, req.params.targetUserId, parsed.data.reason);
    await runtime.kickPublicChannelUser(req.params.slug, req.params.targetUserId, parsed.data.reason);
    await notify(notifications, {
      userId: req.params.targetUserId,
      type: "ROOM_BANNED",
      title: `Zablokowano Cię w #${req.params.slug}`,
      body: parsed.data.reason || "Nie możesz ponownie dołączyć do tego pokoju.",
      link: "/pokoje",
      metadata: { slug: req.params.slug, actorUserId: account(req).id }
    });
    res.json({ ok: true });
  }));

  router.delete("/channels/:slug/users/:targetUserId/ban", asyncRoute(async (req, res) => {
    await unbanChannelUser(account(req).id, req.params.slug, req.params.targetUserId);
    res.json({ ok: true });
  }));

  router.put("/channels/:slug/users/:targetUserId/moderator", asyncRoute(async (req, res) => {
    await setChannelModerator(account(req).id, req.params.slug, req.params.targetUserId, true);
    await notify(notifications, {
      userId: req.params.targetUserId,
      type: "MODERATOR_PROMOTED",
      title: `Jesteś moderatorem #${req.params.slug}`,
      body: `${account(req).nickname} nadał(a) Ci uprawnienia moderatora.`,
      link: `/pokoje?room=${encodeURIComponent(req.params.slug)}`,
      metadata: { slug: req.params.slug, actorUserId: account(req).id }
    });
    res.json({ ok: true });
  }));

  router.delete("/channels/:slug/users/:targetUserId/moderator", asyncRoute(async (req, res) => {
    await setChannelModerator(account(req).id, req.params.slug, req.params.targetUserId, false);
    res.json({ ok: true });
  }));

  router.delete("/channels/:slug/messages/:messageId", asyncRoute(async (req, res) => {
    const parsed = reasonSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_REASON" });
    const result = await deleteChannelMessageByModerator(account(req).id, req.params.slug, req.params.messageId, parsed.data.reason);
    runtime.emitPublicChannelMessageDeleted(result.channel.slug, result.messageId);
    res.json({ ok: true });
  }));

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof ModerationError) return res.status(error.status).json({ ok: false, error: error.code });
    next(error);
  });

  return router;
}
