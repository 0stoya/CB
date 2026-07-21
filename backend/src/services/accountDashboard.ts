import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { Request } from "express";
import { config } from "../config";
import { prisma } from "../db";
import {
  USER_SESSION_COOKIE,
  hashOpaqueToken,
  normalizeNickname,
  toPublicUser
} from "./accountAuth";

export class AccountDashboardError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code);
    this.name = "AccountDashboardError";
  }
}

function readCookie(req: Request, name: string) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function sessionTokenHash(req: Request) {
  const token = readCookie(req, USER_SESSION_COOKIE);
  return token ? hashOpaqueToken(token) : null;
}

function deviceLabel(userAgent: string | null) {
  if (!userAgent) return "Nieznane urządzenie";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Przeglądarka";
  const device = /iPhone|iPad|Android|Mobile/i.test(userAgent) ? "telefon / tablet" : "komputer";
  return `${browser} · ${device}`;
}

export async function getAccountOverview(req: Request, userId: string) {
  const currentTokenHash = sessionTokenHash(req);
  const [user, sessions, favourites, memberships, blocked] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" }
    }),
    prisma.channelFavourite.findMany({
      where: { userId, channel: { status: "ACTIVE" } },
      include: { channel: { select: { id: true, slug: true, name: true, topic: true } } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }]
    }),
    prisma.channelMembership.findMany({
      where: { userId, channel: { status: "ACTIVE" } },
      include: { channel: { select: { id: true, slug: true, name: true, isOfficial: true } } },
      orderBy: { joinedAt: "desc" }
    }),
    prisma.friendship.findMany({
      where: { requesterId: userId, status: "BLOCKED" },
      include: { recipient: { select: { id: true, nickname: true } } },
      orderBy: { updatedAt: "desc" }
    })
  ]);
  if (!user || user.status !== "ACTIVE") throw new AccountDashboardError("ACCOUNT_UNAVAILABLE", 404);

  return {
    user: toPublicUser(user),
    sessions: sessions.map((session) => ({
      id: session.id,
      device: deviceLabel(session.userAgent),
      location: session.locationLabel || "Lokalizacja niedostępna",
      lastSeenAt: session.lastSeenAt,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      current: currentTokenHash === session.tokenHash
    })),
    favourites: favourites.map((item) => ({
      channel: item.channel,
      autoJoin: item.autoJoin,
      position: item.position
    })),
    memberships: memberships.map((item) => ({
      channel: item.channel,
      role: item.role,
      muteNotifications: item.muteNotifications,
      joinedAt: item.joinedAt
    })),
    blocked: blocked.map((item) => ({ id: item.recipient.id, nickname: item.recipient.nickname }))
  };
}

export async function updateNickname(userId: string, nickname: string) {
  const normalized = normalizeNickname(nickname);
  const existing = await prisma.user.findFirst({
    where: { nicknameNormalized: normalized, id: { not: userId } },
    select: { id: true }
  });
  if (existing) throw new AccountDashboardError("NICKNAME_ALREADY_USED", 409);
  return prisma.user.update({
    where: { id: userId },
    data: { nickname: nickname.trim(), nicknameNormalized: normalized }
  });
}

export async function changePassword(req: Request, userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AccountDashboardError("INVALID_CURRENT_PASSWORD", 403);
  }
  const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
  const currentTokenHash = sessionTokenHash(req);
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {})
      },
      data: { revokedAt: now }
    })
  ]);
}

export async function revokeSession(req: Request, userId: string, sessionId: string) {
  const currentTokenHash = sessionTokenHash(req);
  const session = await prisma.authSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new AccountDashboardError("SESSION_NOT_FOUND", 404);
  await prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  return { current: currentTokenHash === session.tokenHash };
}

export async function revokeOtherSessions(req: Request, userId: string) {
  const currentTokenHash = sessionTokenHash(req);
  const result = await prisma.authSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {})
    },
    data: { revokedAt: new Date() }
  });
  return result.count;
}

export async function setRoomNotificationMute(userId: string, channelId: string, muted: boolean) {
  const membership = await prisma.channelMembership.findUnique({
    where: { channelId_userId: { channelId, userId } }
  });
  if (!membership) throw new AccountDashboardError("CHANNEL_MEMBERSHIP_NOT_FOUND", 404);
  return prisma.channelMembership.update({
    where: { id: membership.id },
    data: { muteNotifications: muted }
  });
}

export async function exportAccountData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      nickname: true,
      emailVerifiedAt: true,
      status: true,
      friendRequestPolicy: true,
      allowDirectMessages: true,
      showOnline: true,
      showLastSeen: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true
    }
  });
  if (!user) throw new AccountDashboardError("ACCOUNT_UNAVAILABLE", 404);

  const [favourites, memberships, friendships, directMessages, channelMessages, notifications, reports] =
    await Promise.all([
      prisma.channelFavourite.findMany({ where: { userId }, include: { channel: true } }),
      prisma.channelMembership.findMany({ where: { userId }, include: { channel: true } }),
      prisma.friendship.findMany({
        where: { OR: [{ requesterId: userId }, { recipientId: userId }] }
      }),
      prisma.directMessage.findMany({
        where: { OR: [{ senderId: userId }, { recipientId: userId }] },
        orderBy: { createdAt: "asc" }
      }),
      prisma.channelMessage.findMany({ where: { senderUserId: userId }, orderBy: { createdAt: "asc" } }),
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      prisma.report.findMany({ where: { reporterUserId: userId }, orderBy: { createdAt: "asc" } })
    ]);

  return {
    exportedAt: new Date(),
    profile: user,
    favourites,
    memberships,
    friendships,
    directMessages,
    channelMessages,
    notifications,
    reports
  };
}

export async function deleteAccount(userId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AccountDashboardError("INVALID_CURRENT_PASSWORD", 403);
  }

  const now = new Date();
  const suffix = `${user.id.slice(-8)}-${Date.now()}`;
  const anonymousNickname = `Usuniety_${user.id.slice(-6)}`;
  const randomPasswordHash = await bcrypt.hash(randomBytes(32).toString("hex"), config.bcryptRounds);

  await prisma.$transaction(async (tx) => {
    await tx.channel.updateMany({
      where: { createdByUserId: userId, isOfficial: false, status: "ACTIVE" },
      data: { status: "ARCHIVED", archivedAt: now }
    });
    await tx.channelMessage.updateMany({
      where: { senderUserId: userId },
      data: { senderUserId: null, senderNickname: "Usunięty użytkownik" }
    });
    await tx.directMessage.updateMany({
      where: { OR: [{ senderId: userId }, { recipientId: userId }], deletedAt: null },
      data: { text: "[wiadomość usunięta]", deletedAt: now }
    });
    await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.emailVerificationToken.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.channelFavourite.deleteMany({ where: { userId } });
    await tx.channelMembership.deleteMany({ where: { userId } });
    await tx.friendship.deleteMany({ where: { OR: [{ requesterId: userId }, { recipientId: userId }] } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${suffix}@deleted.invalid`,
        emailNormalized: `deleted-${suffix}@deleted.invalid`,
        nickname: anonymousNickname,
        nicknameNormalized: anonymousNickname.toLowerCase(),
        passwordHash: randomPasswordHash,
        status: "DELETED",
        emailVerifiedAt: null,
        allowDirectMessages: false,
        showOnline: false,
        showLastSeen: false,
        deletedAt: now
      }
    });
  });
}
