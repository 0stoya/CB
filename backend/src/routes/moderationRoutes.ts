import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { getCurrentUser, requireVerifiedUser } from "../services/accountAuth";
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

type AccountRequest = Request & { accountUser: { id: string } };

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

function userId(req: Request) {
  return (req as AccountRequest).accountUser.id;
}

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

export function createModerationRoutes(runtime: ModerationRuntime) {
  const router = Router();

  router.post(
    "/reports",
    asyncRoute(async (req, res) => {
      const parsed = reportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: "INVALID_REPORT", fields: parsed.error.flatten().fieldErrors });
      }
      const account = await getCurrentUser(req);
      if (!account && !parsed.data.reporterClientId) {
        return res.status(400).json({ ok: false, error: "REPORTER_ID_REQUIRED" });
      }
      const report = await createReport({
        reporterUserId: account?.id ?? null,
        reporterClientId: account ? null : parsed.data.reporterClientId,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        reason: parsed.data.reason,
        details: parsed.data.details
      });
      res.status(201).json({ ok: true, reportId: report.id });
    })
  );

  router.use(requireVerifiedUser);

  router.patch(
    "/channels/:slug/settings",
    asyncRoute(async (req, res) => {
      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_ROOM_SETTINGS" });
      const channel = await updateChannelByModerator(userId(req), req.params.slug, parsed.data);
      runtime.updatePublicChannelLive(channel);
      res.json({ ok: true, channel });
    })
  );

  router.post(
    "/channels/:slug/members/:memberId/kick",
    asyncRoute(async (req, res) => {
      const parsed = reasonSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_REASON" });
      const member = runtime.getPublicChannelMember(req.params.slug, req.params.memberId);
      if (!member) return res.status(404).json({ ok: false, error: "CHANNEL_MEMBER_NOT_FOUND" });
      await recordKick(userId(req), req.params.slug, member.userId, parsed.data.reason);
      await runtime.kickPublicChannelMember(req.params.slug, req.params.memberId, parsed.data.reason);
      res.json({ ok: true });
    })
  );

  router.post(
    "/channels/:slug/users/:targetUserId/mute",
    asyncRoute(async (req, res) => {
      const parsed = muteSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_MUTE" });
      const restriction = await muteChannelUser(
        userId(req),
        req.params.slug,
        req.params.targetUserId,
        parsed.data.minutes,
        parsed.data.reason
      );
      res.json({ ok: true, mutedUntil: restriction.mutedUntil });
    })
  );

  router.delete(
    "/channels/:slug/users/:targetUserId/mute",
    asyncRoute(async (req, res) => {
      await unmuteChannelUser(userId(req), req.params.slug, req.params.targetUserId);
      res.json({ ok: true });
    })
  );

  router.post(
    "/channels/:slug/users/:targetUserId/ban",
    asyncRoute(async (req, res) => {
      const parsed = reasonSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_REASON" });
      await banChannelUser(userId(req), req.params.slug, req.params.targetUserId, parsed.data.reason);
      await runtime.kickPublicChannelUser(req.params.slug, req.params.targetUserId, parsed.data.reason);
      res.json({ ok: true });
    })
  );

  router.delete(
    "/channels/:slug/users/:targetUserId/ban",
    asyncRoute(async (req, res) => {
      await unbanChannelUser(userId(req), req.params.slug, req.params.targetUserId);
      res.json({ ok: true });
    })
  );

  router.put(
    "/channels/:slug/users/:targetUserId/moderator",
    asyncRoute(async (req, res) => {
      await setChannelModerator(userId(req), req.params.slug, req.params.targetUserId, true);
      res.json({ ok: true });
    })
  );

  router.delete(
    "/channels/:slug/users/:targetUserId/moderator",
    asyncRoute(async (req, res) => {
      await setChannelModerator(userId(req), req.params.slug, req.params.targetUserId, false);
      res.json({ ok: true });
    })
  );

  router.delete(
    "/channels/:slug/messages/:messageId",
    asyncRoute(async (req, res) => {
      const parsed = reasonSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_REASON" });
      const result = await deleteChannelMessageByModerator(
        userId(req),
        req.params.slug,
        req.params.messageId,
        parsed.data.reason
      );
      runtime.emitPublicChannelMessageDeleted(result.channel.slug, result.messageId);
      res.json({ ok: true });
    })
  );

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof ModerationError) {
      return res.status(error.status).json({ ok: false, error: error.code });
    }
    next(error);
  });

  return router;
}
