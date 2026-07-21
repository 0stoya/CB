import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { getCurrentUser, requireVerifiedUser } from "../services/accountAuth";
import {
  ChannelError,
  createChannel,
  getActiveChannelBySlug,
  getRecentChannelMessages,
  listChannels,
  listFavouriteChannels,
  removeChannelFavourite,
  setChannelFavourite
} from "../services/channels";

type PresenceApi = {
  getPublicChannelPresence: () => ReadonlyMap<string, number>;
};

type AccountRequest = Request & {
  accountUser?: { id: string };
};

const createSchema = z.object({
  name: z.string().trim().min(3).max(60),
  topic: z.string().trim().max(240).optional(),
  language: z.string().trim().min(2).max(10).optional(),
  isUnlisted: z.boolean().optional(),
  allowGuests: z.boolean().optional(),
  maxMembers: z.number().int().min(10).max(500).optional(),
  slowModeSeconds: z.number().int().min(0).max(300).optional()
});

const favouriteSchema = z.object({ autoJoin: z.boolean().optional() });

function userId(req: Request) {
  return (req as AccountRequest).accountUser?.id;
}

function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

export function createChannelRoutes(presenceApi: PresenceApi) {
  const router = Router();

  router.get(
    "/",
    asyncRoute(async (req, res) => {
      const currentUser = await getCurrentUser(req);
      const channels = await listChannels(
        presenceApi.getPublicChannelPresence(),
        currentUser?.id ?? null
      );
      res.json({ ok: true, channels });
    })
  );

  router.get(
    "/favourites",
    requireVerifiedUser,
    asyncRoute(async (req, res) => {
      const channels = await listFavouriteChannels(
        userId(req)!,
        presenceApi.getPublicChannelPresence()
      );
      res.json({ ok: true, channels });
    })
  );

  router.post(
    "/",
    requireVerifiedUser,
    asyncRoute(async (req, res) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: "INVALID_CHANNEL",
          fields: parsed.error.flatten().fieldErrors
        });
      }

      const channel = await createChannel(userId(req)!, parsed.data);
      res.status(201).json({ ok: true, channel });
    })
  );

  router.get(
    "/:slug/messages",
    asyncRoute(async (req, res) => {
      const messages = await getRecentChannelMessages(req.params.slug);
      res.json({ ok: true, messages });
    })
  );

  router.put(
    "/:slug/favourite",
    requireVerifiedUser,
    asyncRoute(async (req, res) => {
      const parsed = favouriteSchema.safeParse(req.body ?? {});
      if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_FAVOURITE" });

      const channel = await getActiveChannelBySlug(req.params.slug);
      if (!channel) return res.status(404).json({ ok: false, error: "CHANNEL_NOT_FOUND" });

      const favourite = await setChannelFavourite(userId(req)!, channel.id, parsed.data.autoJoin);
      res.json({ ok: true, favourite });
    })
  );

  router.patch(
    "/:slug/favourite",
    requireVerifiedUser,
    asyncRoute(async (req, res) => {
      const parsed = z.object({ autoJoin: z.boolean() }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_FAVOURITE" });

      const channel = await getActiveChannelBySlug(req.params.slug);
      if (!channel) return res.status(404).json({ ok: false, error: "CHANNEL_NOT_FOUND" });

      const favourite = await setChannelFavourite(userId(req)!, channel.id, parsed.data.autoJoin);
      res.json({ ok: true, favourite });
    })
  );

  router.delete(
    "/:slug/favourite",
    requireVerifiedUser,
    asyncRoute(async (req, res) => {
      const channel = await getActiveChannelBySlug(req.params.slug);
      if (!channel) return res.status(404).json({ ok: false, error: "CHANNEL_NOT_FOUND" });
      await removeChannelFavourite(userId(req)!, channel.id);
      res.json({ ok: true });
    })
  );

  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof ChannelError) {
      return res.status(error.status).json({ ok: false, error: error.code });
    }
    next(error);
  });

  return router;
}
