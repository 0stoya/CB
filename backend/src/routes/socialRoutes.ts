import { Router, type Request } from "express";
import { z } from "zod";
import { requireVerifiedUser } from "../services/accountAuth";
import {
  SocialError,
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  getConversationMessages,
  getSocialOverview,
  markConversationRead,
  removeFriend,
  searchPeople,
  sendFriendRequest,
  unblockUser,
  updateSocialSettings
} from "../services/social";

const requestSchema = z.object({ nickname: z.string().trim().min(3).max(24) });
const settingsSchema = z.object({
  friendRequestPolicy: z.enum(["EVERYONE", "SHARED_CHANNELS", "NOBODY"]),
  allowDirectMessages: z.boolean(),
  showOnline: z.boolean(),
  showLastSeen: z.boolean()
});

function accountUserId(req: Request) {
  return (req as Request & { accountUser: { id: string } }).accountUser.id;
}

function statusForSocialError(code: string) {
  if (code === "USER_NOT_FOUND" || code === "REQUEST_NOT_FOUND" || code === "FRIENDSHIP_NOT_FOUND") return 404;
  if (code === "RELATIONSHIP_BLOCKED" || code === "FRIEND_REQUESTS_DISABLED" || code === "SHARED_CHANNEL_REQUIRED" || code === "DIRECT_MESSAGES_DISABLED") return 403;
  if (code === "REQUEST_ALREADY_PENDING" || code === "ALREADY_FRIENDS") return 409;
  return 400;
}

export function createSocialRoutes(socketApi: {
  getOnlineAccountIds: () => string[];
  notifySocialChanged: (userIds: string[], reason: string) => void;
}) {
  const router = Router();
  router.use(requireVerifiedUser);

  router.get("/overview", async (req, res, next) => {
    try {
      const userId = accountUserId(req);
      const overview = await getSocialOverview(userId, new Set(socketApi.getOnlineAccountIds()));
      res.json({ ok: true, ...overview });
    } catch (error) {
      next(error);
    }
  });

  router.get("/search", async (req, res, next) => {
    try {
      const userId = accountUserId(req);
      const query = typeof req.query.q === "string" ? req.query.q : "";
      const users = await searchPeople(userId, query, new Set(socketApi.getOnlineAccountIds()));
      res.json({ ok: true, users });
    } catch (error) {
      next(error);
    }
  });

  router.post("/requests", async (req, res, next) => {
    try {
      const input = requestSchema.parse(req.body);
      const userId = accountUserId(req);
      const result = await sendFriendRequest(userId, input.nickname);
      socketApi.notifySocialChanged([userId, result.target.id], "friend-request");
      res.status(201).json({ ok: true, requestId: result.relationship.id });
    } catch (error) {
      if (error instanceof SocialError) {
        res.status(statusForSocialError(error.code)).json({ ok: false, error: error.code });
        return;
      }
      if (error instanceof z.ZodError) {
        res.status(400).json({ ok: false, error: "VALIDATION_ERROR", fields: error.flatten().fieldErrors });
        return;
      }
      next(error);
    }
  });

  router.post("/requests/:id/accept", async (req, res, next) => {
    try {
      const userId = accountUserId(req);
      const relationship = await acceptFriendRequest(userId, req.params.id);
      socketApi.notifySocialChanged([relationship.requesterId, relationship.recipientId], "friend-accepted");
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof SocialError) {
        res.status(statusForSocialError(error.code)).json({ ok: false, error: error.code });
        return;
      }
      next(error);
    }
  });

  router.post("/requests/:id/decline", async (req, res, next) => {
    try {
      const userId = accountUserId(req);
      const relationship = await declineFriendRequest(userId, req.params.id);
      socketApi.notifySocialChanged([relationship.requesterId, relationship.recipientId], "friend-declined");
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof SocialError) {
        res.status(statusForSocialError(error.code)).json({ ok: false, error: error.code });
        return;
      }
      next(error);
    }
  });

  router.post("/requests/:id/cancel", async (req, res, next) => {
    try {
      const userId = accountUserId(req);
      const relationship = await cancelFriendRequest(userId, req.params.id);
      socketApi.notifySocialChanged([relationship.requesterId, relationship.recipientId], "friend-cancelled");
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof SocialError) {
        res.status(statusForSocialError(error.code)).json({ ok: false, error: error.code });
        return;
      }
      next(error);
    }
  });

  router.post("/friends/:friendId/remove", async (req, res, next) => {
    try {
      const userId = accountUserId(req);
      const relationship = await removeFriend(userId, req.params.friendId);
      socketApi.notifySocialChanged([relationship.requesterId, relationship.recipientId], "friend-removed");
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof SocialError) {
        res.status(statusForSocialError(error.code)).json({ ok: false, error: error.code });
        return;
      }
      next(error);
    }
  });

  router.post("/users/:targetId/block", async (req, res, next) => {
    try {
      const userId = accountUserId(req);
      const relationship = await blockUser(userId, req.params.targetId);
      socketApi.notifySocialChanged([relationship.requesterId, relationship.recipientId], "user-blocked");
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof SocialError) {
        res.status(statusForSocialError(error.code)).json({ ok: false, error: error.code });
        return;
      }
      next(error);
    }
  });

  router.post("/users/:targetId/unblock", async (req, res, next) => {
    try {
      const userId = accountUserId(req);
      const relationship = await unblockUser(userId, req.params.targetId);
      socketApi.notifySocialChanged([relationship.requesterId, relationship.recipientId], "user-unblocked");
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof SocialError) {
        res.status(statusForSocialError(error.code)).json({ ok: false, error: error.code });
        return;
      }
      next(error);
    }
  });

  router.patch("/settings", async (req, res, next) => {
    try {
      const input = settingsSchema.parse(req.body);
      const userId = accountUserId(req);
      const settings = await updateSocialSettings(userId, input);
      socketApi.notifySocialChanged([userId], "settings-updated");
      res.json({ ok: true, settings });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ ok: false, error: "VALIDATION_ERROR", fields: error.flatten().fieldErrors });
        return;
      }
      next(error);
    }
  });

  router.get("/conversations/:friendId/messages", async (req, res, next) => {
    try {
      const userId = accountUserId(req);
      const beforeValue = typeof req.query.before === "string" ? new Date(req.query.before) : undefined;
      const before = beforeValue && !Number.isNaN(beforeValue.getTime()) ? beforeValue : undefined;
      const result = await getConversationMessages(userId, req.params.friendId, before);
      res.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof SocialError) {
        res.status(statusForSocialError(error.code)).json({ ok: false, error: error.code });
        return;
      }
      next(error);
    }
  });

  router.post("/conversations/:friendId/read", async (req, res, next) => {
    try {
      const userId = accountUserId(req);
      const readAt = await markConversationRead(userId, req.params.friendId);
      socketApi.notifySocialChanged([userId, req.params.friendId], "messages-read");
      res.json({ ok: true, readAt });
    } catch (error) {
      if (error instanceof SocialError) {
        res.status(statusForSocialError(error.code)).json({ ok: false, error: error.code });
        return;
      }
      next(error);
    }
  });

  return router;
}
