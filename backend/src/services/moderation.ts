import type { Prisma } from "@prisma/client";
import { prisma } from "../db";

export type ReportTarget = "CHANNEL" | "CHANNEL_MESSAGE" | "DIRECT_MESSAGE" | "USER";
export type ReportReasonValue =
  | "SPAM"
  | "HARASSMENT"
  | "HATE"
  | "SEXUAL"
  | "VIOLENCE"
  | "IMPERSONATION"
  | "ILLEGAL"
  | "OTHER";

export class ModerationError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code);
    this.name = "ModerationError";
  }
}

const moderatorRoles = new Set(["OWNER", "MODERATOR"]);

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function getChannelRole(channelId: string, userId: string) {
  const membership = await prisma.channelMembership.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { role: true }
  });
  return membership?.role ?? null;
}

export async function getChannelAccess(channelId: string, userId: string) {
  const [role, restriction] = await Promise.all([
    getChannelRole(channelId, userId),
    prisma.channelRestriction.findUnique({
      where: { channelId_userId: { channelId, userId } }
    })
  ]);

  const now = new Date();
  if (restriction?.mutedUntil && restriction.mutedUntil <= now) {
    await prisma.channelRestriction.update({
      where: { id: restriction.id },
      data: { mutedUntil: null }
    });
    restriction.mutedUntil = null;
  }

  return { role, restriction };
}

export async function requireChannelModerator(channelId: string, userId: string) {
  const role = await getChannelRole(channelId, userId);
  if (!role || !moderatorRoles.has(role)) {
    throw new ModerationError("CHANNEL_MODERATOR_REQUIRED", 403);
  }
  return role;
}

async function channelBySlug(slug: string) {
  const channel = await prisma.channel.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      topic: true,
      isOfficial: true,
      isLocked: true,
      allowGuests: true,
      slowModeSeconds: true,
      status: true,
      createdByUserId: true
    }
  });
  if (!channel || channel.status !== "ACTIVE") {
    throw new ModerationError("CHANNEL_NOT_FOUND", 404);
  }
  return channel;
}

async function snapshotForReport(input: {
  reporterUserId?: string | null;
  targetType: ReportTarget;
  targetId: string;
}) {
  if (input.targetType === "CHANNEL") {
    const channel = await prisma.channel.findFirst({
      where: { OR: [{ id: input.targetId }, { slug: input.targetId }] },
      select: {
        id: true,
        slug: true,
        name: true,
        topic: true,
        status: true,
        createdByUserId: true,
        createdAt: true
      }
    });
    if (!channel) throw new ModerationError("REPORT_TARGET_NOT_FOUND", 404);
    return { channelId: channel.id, snapshot: { channel } };
  }

  if (input.targetType === "CHANNEL_MESSAGE") {
    const message = await prisma.channelMessage.findUnique({
      where: { id: input.targetId },
      select: {
        id: true,
        channelId: true,
        senderUserId: true,
        senderNickname: true,
        text: true,
        createdAt: true,
        deletedAt: true,
        channel: { select: { slug: true, name: true } }
      }
    });
    if (!message) throw new ModerationError("REPORT_TARGET_NOT_FOUND", 404);
    return { channelId: message.channelId, snapshot: { message } };
  }

  if (input.targetType === "USER") {
    const user = await prisma.user.findUnique({
      where: { id: input.targetId },
      select: { id: true, nickname: true, status: true, createdAt: true }
    });
    if (!user) throw new ModerationError("REPORT_TARGET_NOT_FOUND", 404);
    return { channelId: null, snapshot: { user } };
  }

  if (!input.reporterUserId) throw new ModerationError("AUTH_REQUIRED", 401);
  const message = await prisma.directMessage.findUnique({
    where: { id: input.targetId },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      recipientId: true,
      text: true,
      createdAt: true,
      deletedAt: true,
      sender: { select: { nickname: true } },
      recipient: { select: { nickname: true } }
    }
  });
  if (!message) throw new ModerationError("REPORT_TARGET_NOT_FOUND", 404);
  if (message.senderId !== input.reporterUserId && message.recipientId !== input.reporterUserId) {
    throw new ModerationError("REPORT_TARGET_FORBIDDEN", 403);
  }
  return { channelId: null, snapshot: { message } };
}

export async function createReport(input: {
  reporterUserId?: string | null;
  reporterClientId?: string | null;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReasonValue;
  details?: string | null;
}) {
  const reporterKey = input.reporterUserId || input.reporterClientId;
  if (!reporterKey) throw new ModerationError("REPORTER_ID_REQUIRED");

  const { channelId, snapshot } = await snapshotForReport(input);
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const existing = await prisma.report.findFirst({
    where: {
      targetType: input.targetType,
      targetId: input.targetId,
      createdAt: { gte: since },
      ...(input.reporterUserId
        ? { reporterUserId: input.reporterUserId }
        : { reporterClientId: input.reporterClientId })
    },
    orderBy: { createdAt: "desc" }
  });
  if (existing) return existing;

  if (input.targetType === "CHANNEL_MESSAGE") {
    await prisma.channelMessage.updateMany({
      where: { id: input.targetId },
      data: { reportedAt: new Date() }
    });
  }

  return prisma.report.create({
    data: {
      reporterUserId: input.reporterUserId || null,
      reporterClientId: input.reporterClientId || null,
      targetType: input.targetType,
      targetId: input.targetId,
      channelId,
      reason: input.reason,
      details: input.details?.trim().slice(0, 1000) || null,
      snapshot: jsonValue(snapshot)
    }
  });
}

export async function updateChannelByModerator(
  userId: string,
  slug: string,
  input: { topic?: string | null; allowGuests?: boolean; slowModeSeconds?: number; isLocked?: boolean }
) {
  const channel = await channelBySlug(slug);
  await requireChannelModerator(channel.id, userId);
  const updated = await prisma.channel.update({
    where: { id: channel.id },
    data: {
      ...(input.topic !== undefined ? { topic: input.topic?.trim().slice(0, 240) || null } : {}),
      ...(input.allowGuests !== undefined ? { allowGuests: input.allowGuests } : {}),
      ...(input.slowModeSeconds !== undefined
        ? { slowModeSeconds: Math.min(300, Math.max(0, input.slowModeSeconds)) }
        : {}),
      ...(input.isLocked !== undefined ? { isLocked: input.isLocked } : {})
    },
    select: {
      id: true,
      slug: true,
      topic: true,
      allowGuests: true,
      slowModeSeconds: true,
      isLocked: true
    }
  });

  await prisma.moderationAction.create({
    data: {
      channelId: channel.id,
      actorUserId: userId,
      action:
        input.isLocked === true
          ? "LOCK_ROOM"
          : input.isLocked === false
            ? "UNLOCK_ROOM"
            : "UPDATE_ROOM",
      metadata: jsonValue(input)
    }
  });
  return updated;
}

export async function setChannelModerator(
  actorUserId: string,
  slug: string,
  targetUserId: string,
  enabled: boolean
) {
  const channel = await channelBySlug(slug);
  const actorRole = await requireChannelModerator(channel.id, actorUserId);
  if (actorRole !== "OWNER") throw new ModerationError("CHANNEL_OWNER_REQUIRED", 403);
  if (targetUserId === actorUserId) throw new ModerationError("CANNOT_MODERATE_SELF");

  const membership = await prisma.channelMembership.findUnique({
    where: { channelId_userId: { channelId: channel.id, userId: targetUserId } }
  });
  if (!membership) throw new ModerationError("CHANNEL_MEMBER_NOT_FOUND", 404);
  if (membership.role === "OWNER") throw new ModerationError("CANNOT_CHANGE_OWNER", 409);

  const updated = await prisma.channelMembership.update({
    where: { id: membership.id },
    data: { role: enabled ? "MODERATOR" : "MEMBER" }
  });
  await prisma.moderationAction.create({
    data: {
      channelId: channel.id,
      actorUserId,
      targetUserId,
      action: enabled ? "SET_MODERATOR" : "REMOVE_MODERATOR"
    }
  });
  return updated;
}

export async function muteChannelUser(
  actorUserId: string,
  slug: string,
  targetUserId: string,
  minutes: number,
  reason?: string
) {
  const channel = await channelBySlug(slug);
  await requireChannelModerator(channel.id, actorUserId);
  const targetRole = await getChannelRole(channel.id, targetUserId);
  if (targetRole === "OWNER") throw new ModerationError("CANNOT_MODERATE_OWNER", 403);
  const mutedUntil = new Date(Date.now() + Math.min(24 * 60, Math.max(1, minutes)) * 60 * 1000);
  const restriction = await prisma.channelRestriction.upsert({
    where: { channelId_userId: { channelId: channel.id, userId: targetUserId } },
    create: {
      channelId: channel.id,
      userId: targetUserId,
      mutedUntil,
      reason: reason?.trim().slice(0, 500) || null,
      createdByUserId: actorUserId
    },
    update: {
      mutedUntil,
      reason: reason?.trim().slice(0, 500) || null,
      createdByUserId: actorUserId
    }
  });
  await prisma.moderationAction.create({
    data: {
      channelId: channel.id,
      actorUserId,
      targetUserId,
      action: "MUTE",
      reason: restriction.reason,
      expiresAt: mutedUntil
    }
  });
  return restriction;
}

export async function unmuteChannelUser(actorUserId: string, slug: string, targetUserId: string) {
  const channel = await channelBySlug(slug);
  await requireChannelModerator(channel.id, actorUserId);
  await prisma.channelRestriction.updateMany({
    where: { channelId: channel.id, userId: targetUserId },
    data: { mutedUntil: null }
  });
  await prisma.moderationAction.create({
    data: { channelId: channel.id, actorUserId, targetUserId, action: "UNMUTE" }
  });
}

export async function banChannelUser(
  actorUserId: string,
  slug: string,
  targetUserId: string,
  reason?: string
) {
  const channel = await channelBySlug(slug);
  await requireChannelModerator(channel.id, actorUserId);
  const targetRole = await getChannelRole(channel.id, targetUserId);
  if (targetRole === "OWNER") throw new ModerationError("CANNOT_MODERATE_OWNER", 403);
  const bannedAt = new Date();
  const restriction = await prisma.channelRestriction.upsert({
    where: { channelId_userId: { channelId: channel.id, userId: targetUserId } },
    create: {
      channelId: channel.id,
      userId: targetUserId,
      bannedAt,
      reason: reason?.trim().slice(0, 500) || null,
      createdByUserId: actorUserId
    },
    update: {
      bannedAt,
      reason: reason?.trim().slice(0, 500) || null,
      createdByUserId: actorUserId
    }
  });
  await prisma.moderationAction.create({
    data: {
      channelId: channel.id,
      actorUserId,
      targetUserId,
      action: "BAN",
      reason: restriction.reason
    }
  });
  return restriction;
}

export async function unbanChannelUser(actorUserId: string, slug: string, targetUserId: string) {
  const channel = await channelBySlug(slug);
  await requireChannelModerator(channel.id, actorUserId);
  await prisma.channelRestriction.updateMany({
    where: { channelId: channel.id, userId: targetUserId },
    data: { bannedAt: null }
  });
  await prisma.moderationAction.create({
    data: { channelId: channel.id, actorUserId, targetUserId, action: "UNBAN" }
  });
}

export async function recordKick(
  actorUserId: string,
  slug: string,
  targetUserId: string | null,
  reason?: string
) {
  const channel = await channelBySlug(slug);
  await requireChannelModerator(channel.id, actorUserId);
  if (targetUserId && (await getChannelRole(channel.id, targetUserId)) === "OWNER") {
    throw new ModerationError("CANNOT_MODERATE_OWNER", 403);
  }
  return prisma.moderationAction.create({
    data: {
      channelId: channel.id,
      actorUserId,
      targetUserId,
      action: "KICK",
      reason: reason?.trim().slice(0, 500) || null
    }
  });
}

export async function deleteChannelMessageByModerator(
  actorUserId: string,
  slug: string,
  messageId: string,
  reason?: string
) {
  const channel = await channelBySlug(slug);
  await requireChannelModerator(channel.id, actorUserId);
  const message = await prisma.channelMessage.findFirst({
    where: { id: messageId, channelId: channel.id },
    select: { id: true, senderUserId: true }
  });
  if (!message) throw new ModerationError("MESSAGE_NOT_FOUND", 404);
  await prisma.channelMessage.update({
    where: { id: message.id },
    data: { deletedAt: new Date() }
  });
  await prisma.moderationAction.create({
    data: {
      channelId: channel.id,
      actorUserId,
      targetUserId: message.senderUserId,
      targetMessageId: message.id,
      action: "DELETE_MESSAGE",
      reason: reason?.trim().slice(0, 500) || null
    }
  });
  return { channel, messageId: message.id };
}

export async function listReports(status?: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED") {
  return prisma.report.findMany({
    where: status ? { status } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 300
  });
}

export async function listModerationActions() {
  return prisma.moderationAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 300
  });
}

function stringFromSnapshot(snapshot: unknown, path: string[]) {
  let value: unknown = snapshot;
  for (const key of path) {
    if (!value || typeof value !== "object") return null;
    value = (value as Record<string, unknown>)[key];
  }
  return typeof value === "string" ? value : null;
}

export async function reviewReport(input: {
  reportId: string;
  adminUsername: string;
  status: "REVIEWING" | "RESOLVED" | "DISMISSED";
  action?: "NONE" | "DELETE_CONTENT" | "SUSPEND_USER" | "ARCHIVE_ROOM";
  resolutionNote?: string | null;
}) {
  const report = await prisma.report.findUnique({ where: { id: input.reportId } });
  if (!report) throw new ModerationError("REPORT_NOT_FOUND", 404);

  let liveEffect:
    | { type: "CHANNEL_MESSAGE_DELETED"; channelId: string; slug: string; messageId: string }
    | { type: "ROOM_ARCHIVED"; channelId: string; slug: string }
    | { type: "USER_SUSPENDED"; userId: string }
    | null = null;

  if (input.action === "DELETE_CONTENT") {
    if (report.targetType === "CHANNEL_MESSAGE") {
      const message = await prisma.channelMessage.findUnique({
        where: { id: report.targetId },
        include: { channel: { select: { slug: true } } }
      });
      if (message) {
        await prisma.channelMessage.update({ where: { id: message.id }, data: { deletedAt: new Date() } });
        liveEffect = {
          type: "CHANNEL_MESSAGE_DELETED",
          channelId: message.channelId,
          slug: message.channel.slug,
          messageId: message.id
        };
      }
    } else if (report.targetType === "DIRECT_MESSAGE") {
      await prisma.directMessage.updateMany({
        where: { id: report.targetId },
        data: { deletedAt: new Date() }
      });
    } else if (report.targetType === "CHANNEL") {
      const channel = await prisma.channel.findFirst({
        where: { OR: [{ id: report.targetId }, { slug: report.targetId }] }
      });
      if (channel) {
        await prisma.channel.update({
          where: { id: channel.id },
          data: { status: "ARCHIVED", archivedAt: new Date() }
        });
        liveEffect = { type: "ROOM_ARCHIVED", channelId: channel.id, slug: channel.slug };
      }
    }
  }

  if (input.action === "SUSPEND_USER") {
    const userId =
      report.targetType === "USER"
        ? report.targetId
        : stringFromSnapshot(report.snapshot, ["message", "senderUserId"]) ||
          stringFromSnapshot(report.snapshot, ["message", "senderId"]);
    if (!userId) throw new ModerationError("REPORT_HAS_NO_USER_TARGET", 409);
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } }),
      prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);
    liveEffect = { type: "USER_SUSPENDED", userId };
  }

  if (input.action === "ARCHIVE_ROOM") {
    const channelId = report.channelId || stringFromSnapshot(report.snapshot, ["channel", "id"]);
    if (!channelId) throw new ModerationError("REPORT_HAS_NO_CHANNEL_TARGET", 409);
    const channel = await prisma.channel.update({
      where: { id: channelId },
      data: { status: "ARCHIVED", archivedAt: new Date() }
    });
    liveEffect = { type: "ROOM_ARCHIVED", channelId: channel.id, slug: channel.slug };
  }

  const reviewedAt = new Date();
  const updated = await prisma.report.update({
    where: { id: report.id },
    data: {
      status: input.status,
      resolutionNote: input.resolutionNote?.trim().slice(0, 1000) || null,
      reviewedBy: input.adminUsername,
      reviewedAt
    }
  });
  await prisma.moderationAction.create({
    data: {
      channelId: report.channelId,
      actorAdmin: input.adminUsername,
      reportId: report.id,
      action: input.status === "DISMISSED" ? "DISMISS_REPORT" : "RESOLVE_REPORT",
      reason: updated.resolutionNote,
      metadata: jsonValue({
        action: input.action || "NONE",
        targetType: report.targetType,
        targetId: report.targetId
      })
    }
  });
  return { report: updated, liveEffect };
}
