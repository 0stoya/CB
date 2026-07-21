import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
  destroyUserSession,
  requireVerifiedUser,
  toPublicUser
} from "../services/accountAuth";
import {
  AccountDashboardError,
  changePassword,
  deleteAccount,
  exportAccountData,
  getAccountOverview,
  revokeOtherSessions,
  revokeSession,
  setRoomNotificationMute,
  updateNickname
} from "../services/accountDashboard";

const nicknameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[\p{L}\p{N}_-]+$/u);
const passwordSchema = z.string().min(10).max(128);

type AccountRequest = Request & { accountUser: { id: string } };
type AccountRuntime = { disconnectAccount: (userId: string) => Promise<number> };

function userId(req: Request) {
  return (req as AccountRequest).accountUser.id;
}

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

export function createAccountRoutes(runtime: AccountRuntime) {
  const router = Router();
  router.use(requireVerifiedUser);

  router.get(
    "/overview",
    asyncRoute(async (req, res) => {
      const overview = await getAccountOverview(req, userId(req));
      res.json({ ok: true, ...overview });
    })
  );

  router.patch(
    "/profile",
    asyncRoute(async (req, res) => {
      const parsed = z.object({ nickname: nicknameSchema }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ ok: false, error: "VALIDATION_ERROR" });
      const currentUserId = userId(req);
      const user = await updateNickname(currentUserId, parsed.data.nickname);
      await runtime.disconnectAccount(currentUserId);
      res.json({ ok: true, user: toPublicUser(user) });
    })
  );

  router.post(
    "/password",
    asyncRoute(async (req, res) => {
      const parsed = z
        .object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ ok: false, error: "VALIDATION_ERROR" });
      const currentUserId = userId(req);
      await changePassword(req, currentUserId, parsed.data.currentPassword, parsed.data.newPassword);
      await runtime.disconnectAccount(currentUserId);
      res.json({ ok: true });
    })
  );

  router.delete(
    "/sessions/:sessionId",
    asyncRoute(async (req, res) => {
      const currentUserId = userId(req);
      const result = await revokeSession(req, currentUserId, req.params.sessionId);
      if (result.current) await destroyUserSession(req, res);
      await runtime.disconnectAccount(currentUserId);
      res.json({ ok: true, currentSessionRevoked: result.current });
    })
  );

  router.post(
    "/sessions/revoke-others",
    asyncRoute(async (req, res) => {
      const currentUserId = userId(req);
      const revoked = await revokeOtherSessions(req, currentUserId);
      await runtime.disconnectAccount(currentUserId);
      res.json({ ok: true, revoked });
    })
  );

  router.patch(
    "/rooms/:channelId/notifications",
    asyncRoute(async (req, res) => {
      const parsed = z.object({ muted: z.boolean() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ ok: false, error: "VALIDATION_ERROR" });
      const membership = await setRoomNotificationMute(
        userId(req),
        req.params.channelId,
        parsed.data.muted
      );
      res.json({ ok: true, muteNotifications: membership.muteNotifications });
    })
  );

  router.get(
    "/export",
    asyncRoute(async (req, res) => {
      const data = await exportAccountData(userId(req));
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="chati-data-${new Date().toISOString().slice(0, 10)}.json"`
      );
      res.send(JSON.stringify(data, null, 2));
    })
  );

  router.post(
    "/delete",
    asyncRoute(async (req, res) => {
      const parsed = z
        .object({ password: z.string().min(1).max(128), confirmation: z.literal("USUŃ KONTO") })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_DELETE_CONFIRMATION" });
      const currentUserId = userId(req);
      await deleteAccount(currentUserId, parsed.data.password);
      await destroyUserSession(req, res);
      await runtime.disconnectAccount(currentUserId);
      res.json({ ok: true });
    })
  );

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof AccountDashboardError) {
      return res.status(error.status).json({ ok: false, error: error.code });
    }
    next(error);
  });

  return router;
}
