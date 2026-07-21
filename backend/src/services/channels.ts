import { prisma } from "../db";
import { config } from "../config";

const OFFICIAL_CHANNELS = [
  { slug: "general", name: "General", topic: "Luźne rozmowy o wszystkim", language: "pl" },
  { slug: "polska", name: "Polska", topic: "Rozmowy dla użytkowników z Polski", language: "pl" },
  { slug: "uk", name: "UK", topic: "Polacy i znajomi mieszkający w Wielkiej Brytanii", language: "pl" },
  { slug: "relacje", name: "Relacje", topic: "Przyjaźń, związki i codzienne sprawy", language: "pl" },
  { slug: "gaming", name: "Gaming", topic: "Gry, sprzęt i wspólne granie", language: "pl" }
] as const;

export class ChannelError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
    this.name = "ChannelError";
  }
}

export type ChannelPresenceCounts = ReadonlyMap<string, number>;

export function slugifyChannelName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function ensureOfficialChannels() {
  await prisma.$transaction(
    OFFICIAL_CHANNELS.map((channel) =>
      prisma.channel.upsert({
        where: { slug: channel.slug },
        create: {
          ...channel,
          isOfficial: true,
          protectedFromExpiry: true,
          allowGuests: true,
          maxMembers: 500
        },
        update: {
          name: channel.name,
          topic: channel.topic,
          language: channel.language,
          isOfficial: true,
          protectedFromExpiry: true,
          status: "ACTIVE"
        }
      })
    )
  );
}

function channelSelect() {
  return {
    id: true,
    slug: true,
    name: true,
    topic: true,
    language: true,
    isOfficial: true,
    isUnlisted: true,
    allowGuests: true,
    maxMembers: true,
    slowModeSeconds: true,
    protectedFromExpiry: true,
    status: true,
    lastActivityAt: true,
    createdAt: true,
    creator: { select: { id: true, nickname: true } },
    _count: { select: { favourites: true, messages: true } }
  } as const;
}

export async function listChannels(
  presence: ChannelPresenceCounts,
  userId?: string | null,
  options?: { includeUnlisted?: boolean; includeInactive?: boolean }
) {
  const channels = await prisma.channel.findMany({
    where: {
      ...(options?.includeInactive ? {} : { status: "ACTIVE" as const }),
      ...(options?.includeUnlisted ? {} : { isUnlisted: false })
    },
    select: channelSelect(),
    orderBy: [{ isOfficial: "desc" }, { lastActivityAt: "desc" }]
  });

  const favourites = userId
    ? await prisma.channelFavourite.findMany({ where: { userId } })
    : [];
  const favouriteByChannel = new Map(favourites.map((item) => [item.channelId, item]));

  return channels.map((channel) => {
    const favourite = favouriteByChannel.get(channel.id);
    return {
      ...channel,
      online: presence.get(channel.id) ?? 0,
      favourite: Boolean(favourite),
      autoJoin: favourite?.autoJoin ?? false
    };
  });
}

export async function createChannel(
  userId: string,
  input: {
    name: string;
    topic?: string;
    language?: string;
    isUnlisted?: boolean;
    allowGuests?: boolean;
    maxMembers?: number;
    slowModeSeconds?: number;
  }
) {
  const name = input.name.replace(/\s+/g, " ").trim();
  const slug = slugifyChannelName(name);
  if (name.length < 3 || name.length > 60 || slug.length < 3) {
    throw new ChannelError("INVALID_CHANNEL_NAME");
  }

  const existing = await prisma.channel.findUnique({ where: { slug }, select: { id: true } });
  if (existing) throw new ChannelError("CHANNEL_SLUG_TAKEN", 409);

  const topic = input.topic?.replace(/\s+/g, " ").trim().slice(0, 240) || null;
  const maxMembers = Math.min(500, Math.max(10, input.maxMembers ?? 200));
  const slowModeSeconds = Math.min(300, Math.max(0, input.slowModeSeconds ?? 0));

  return prisma.$transaction(async (tx) => {
    const channel = await tx.channel.create({
      data: {
        slug,
        name,
        topic,
        language: (input.language || "pl").trim().slice(0, 10),
        createdByUserId: userId,
        isUnlisted: Boolean(input.isUnlisted),
        allowGuests: input.allowGuests !== false,
        maxMembers,
        slowModeSeconds
      },
      select: channelSelect()
    });

    await tx.channelMembership.create({
      data: { channelId: channel.id, userId, role: "OWNER" }
    });

    return channel;
  });
}

export async function getActiveChannelBySlug(slug: string) {
  return prisma.channel.findFirst({
    where: { slug, status: "ACTIVE" },
    select: channelSelect()
  });
}

export async function getRecentChannelMessages(slug: string, limit = config.channelHistoryLimit) {
  const channel = await prisma.channel.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { id: true }
  });
  if (!channel) throw new ChannelError("CHANNEL_NOT_FOUND", 404);

  const messages = await prisma.channelMessage.findMany({
    where: { channelId: channel.id, deletedAt: null },
    select: {
      id: true,
      channelId: true,
      senderUserId: true,
      senderNickname: true,
      text: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, limit))
  });

  return messages.reverse();
}

export async function ensureChannelMembership(channelId: string, userId: string) {
  return prisma.channelMembership.upsert({
    where: { channelId_userId: { channelId, userId } },
    create: { channelId, userId, role: "MEMBER" },
    update: {}
  });
}

export async function createChannelMessage(input: {
  channelId: string;
  senderUserId?: string | null;
  senderNickname: string;
  text: string;
}) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const message = await tx.channelMessage.create({
      data: {
        channelId: input.channelId,
        senderUserId: input.senderUserId || null,
        senderNickname: input.senderNickname,
        text: input.text
      },
      select: {
        id: true,
        channelId: true,
        senderUserId: true,
        senderNickname: true,
        text: true,
        createdAt: true
      }
    });

    await tx.channel.update({
      where: { id: input.channelId },
      data: { lastActivityAt: now }
    });

    return message;
  });
}

export async function listFavouriteChannels(userId: string, presence: ChannelPresenceCounts) {
  const favourites = await prisma.channelFavourite.findMany({
    where: { userId, channel: { status: "ACTIVE" } },
    include: { channel: { select: channelSelect() } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  });

  return favourites.map((item) => ({
    ...item.channel,
    online: presence.get(item.channelId) ?? 0,
    favourite: true,
    autoJoin: item.autoJoin,
    position: item.position
  }));
}

export async function setChannelFavourite(userId: string, channelId: string, autoJoin?: boolean) {
  return prisma.channelFavourite.upsert({
    where: { userId_channelId: { userId, channelId } },
    create: { userId, channelId, autoJoin: Boolean(autoJoin) },
    update: autoJoin == null ? {} : { autoJoin }
  });
}

export async function removeChannelFavourite(userId: string, channelId: string) {
  await prisma.channelFavourite.deleteMany({ where: { userId, channelId } });
}

export async function listAutoJoinChannels(userId: string) {
  const favourites = await prisma.channelFavourite.findMany({
    where: { userId, autoJoin: true, channel: { status: "ACTIVE" } },
    include: { channel: { select: channelSelect() } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    take: config.channelMaxAutoJoin
  });
  return favourites.map((item) => item.channel);
}

export async function cleanupInactiveChannels(activeChannelIds: Set<string>) {
  const cutoff = new Date(Date.now() - config.channelInactiveHours * 60 * 60 * 1000);
  const stale = await prisma.channel.findMany({
    where: {
      status: "ACTIVE",
      isOfficial: false,
      protectedFromExpiry: false,
      lastActivityAt: { lt: cutoff },
      ...(activeChannelIds.size ? { id: { notIn: [...activeChannelIds] } } : {})
    },
    select: { id: true, slug: true }
  });

  if (!stale.length) return [];
  await prisma.channel.deleteMany({ where: { id: { in: stale.map((item) => item.id) } } });
  return stale;
}

export async function adminUpdateChannel(
  id: string,
  input: {
    topic?: string | null;
    allowGuests?: boolean;
    slowModeSeconds?: number;
    protectedFromExpiry?: boolean;
    status?: "ACTIVE" | "ARCHIVED" | "DELETED";
  }
) {
  return prisma.channel.update({
    where: { id },
    data: {
      ...(input.topic !== undefined ? { topic: input.topic?.trim().slice(0, 240) || null } : {}),
      ...(input.allowGuests !== undefined ? { allowGuests: input.allowGuests } : {}),
      ...(input.protectedFromExpiry !== undefined
        ? { protectedFromExpiry: input.protectedFromExpiry }
        : {}),
      ...(input.slowModeSeconds !== undefined
        ? { slowModeSeconds: Math.min(300, Math.max(0, input.slowModeSeconds)) }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {})
    },
    select: channelSelect()
  });
}

export async function adminDeleteChannel(id: string) {
  const channel = await prisma.channel.findUnique({ where: { id }, select: { isOfficial: true } });
  if (!channel) throw new ChannelError("CHANNEL_NOT_FOUND", 404);
  if (channel.isOfficial) throw new ChannelError("OFFICIAL_CHANNEL_CANNOT_BE_DELETED", 409);
  await prisma.channel.delete({ where: { id } });
}
