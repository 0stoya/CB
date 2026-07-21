import { prisma } from "../db";

export type NotificationTypeValue =
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPTED"
  | "DIRECT_MESSAGE"
  | "CHANNEL_MENTION"
  | "MODERATOR_PROMOTED"
  | "ROOM_MUTED"
  | "ROOM_KICKED"
  | "ROOM_BANNED"
  | "SYSTEM";

function safeJson(value: unknown) {
  return value == null ? undefined : JSON.parse(JSON.stringify(value));
}

export function publicNotification(notification: {
  id: string;
  userId: string;
  type: NotificationTypeValue;
  title: string;
  body: string;
  link: string | null;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    metadata: notification.metadata,
    readAt: notification.readAt,
    createdAt: notification.createdAt
  };
}

export async function createNotification(input: {
  userId: string;
  type: NotificationTypeValue;
  title: string;
  body: string;
  link?: string | null;
  metadata?: unknown;
}) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title.trim().slice(0, 120),
      body: input.body.trim().slice(0, 500),
      link: input.link?.trim().slice(0, 500) || null,
      metadata: safeJson(input.metadata)
    }
  });
}

export async function listNotifications(userId: string, limit = 50) {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit))
    }),
    prisma.notification.count({ where: { userId, readAt: null } })
  ]);
  return { items: items.map(publicNotification), unread };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const readAt = new Date();
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt }
  });
  return { changed: result.count > 0, readAt };
}

export async function markAllNotificationsRead(userId: string) {
  const readAt = new Date();
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt }
  });
  return readAt;
}

export async function markDirectMessageNotificationsRead(userId: string, friendId: string) {
  const readAt = new Date();
  await prisma.notification.updateMany({
    where: {
      userId,
      type: "DIRECT_MESSAGE",
      readAt: null,
      metadata: { path: ["friendId"], equals: friendId }
    },
    data: { readAt }
  });
  return readAt;
}

export async function markLinkNotificationsRead(userId: string, link: string) {
  const readAt = new Date();
  await prisma.notification.updateMany({
    where: { userId, link, readAt: null },
    data: { readAt }
  });
  return readAt;
}
