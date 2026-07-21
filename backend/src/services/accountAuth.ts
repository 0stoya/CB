import { createHash, createHmac, randomBytes } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { prisma } from "../db";
import { getClientIp } from "../utils/ip";

export const USER_SESSION_COOKIE = "chati_user";

const publicUserSelect = {
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
  createdAt: true
} as const;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeNickname(value: string) {
  return value.trim().toLocaleLowerCase("pl-PL");
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

function hashIp(ip: string) {
  return createHmac("sha256", config.sessionSecret).update(ip).digest("hex");
}

function readCookie(req: Request, name: string) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key !== name) continue;

    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

export async function createEmailVerificationToken(userId: string) {
  const token = newOpaqueToken();
  const expiresAt = new Date(Date.now() + config.emailVerificationHours * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({
      where: { userId, usedAt: null }
    }),
    prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashOpaqueToken(token),
        expiresAt
      }
    })
  ]);

  return token;
}

export async function verifyEmailToken(token: string) {
  const tokenHash = hashOpaqueToken(token);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash }
  });

  if (!record || record.usedAt || record.expiresAt <= new Date()) return false;

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() }
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() }
    })
  ]);

  return true;
}

export async function createPasswordResetToken(userId: string) {
  const token = newOpaqueToken();
  const expiresAt = new Date(Date.now() + config.passwordResetMinutes * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({
      where: { userId, usedAt: null }
    }),
    prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashOpaqueToken(token),
        expiresAt
      }
    })
  ]);

  return token;
}

export async function usePasswordResetToken(token: string, passwordHash: string) {
  const tokenHash = hashOpaqueToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash }
  });

  if (!record || record.usedAt || record.expiresAt <= new Date()) return false;

  const now = new Date();
  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now }
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash }
    }),
    prisma.authSession.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: now }
    })
  ]);

  return true;
}

export async function createUserSession(req: Request, res: Response, userId: string) {
  const token = newOpaqueToken();
  const maxAge = config.userSessionDays * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + maxAge);

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash: hashOpaqueToken(token),
      expiresAt,
      userAgent: req.get("user-agent")?.slice(0, 500),
      ipHash: hashIp(getClientIp(req))
    }
  });

  res.cookie(USER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    path: "/",
    maxAge
  });
}

export async function destroyUserSession(req: Request, res: Response) {
  const token = readCookie(req, USER_SESSION_COOKIE);
  if (token) {
    await prisma.authSession.updateMany({
      where: { tokenHash: hashOpaqueToken(token), revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  res.clearCookie(USER_SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.nodeEnv === "production",
    path: "/"
  });
}

export async function getCurrentUser(req: Request) {
  const token = readCookie(req, USER_SESSION_COOKIE);
  if (!token) return null;

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
    include: {
      user: { select: publicUserSelect }
    }
  });

  const now = new Date();
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= now ||
    session.user.status !== "ACTIVE"
  ) {
    return null;
  }

  if (now.getTime() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await prisma.$transaction([
      prisma.authSession.update({
        where: { id: session.id },
        data: { lastSeenAt: now }
      }),
      prisma.user.update({
        where: { id: session.userId },
        data: { lastSeenAt: now }
      })
    ]);
  }

  return session.user;
}

export async function requireVerifiedUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "AUTH_REQUIRED" });
    if (!user.emailVerifiedAt) {
      return res.status(403).json({ ok: false, error: "EMAIL_NOT_VERIFIED" });
    }

    (req as Request & { accountUser?: typeof user }).accountUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function toPublicUser(user: {
  id: string;
  email: string;
  nickname: string;
  emailVerifiedAt: Date | null;
  status: string;
  friendRequestPolicy: string;
  allowDirectMessages: boolean;
  showOnline: boolean;
  showLastSeen: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    emailVerified: Boolean(user.emailVerifiedAt),
    status: user.status,
    friendRequestPolicy: user.friendRequestPolicy,
    allowDirectMessages: user.allowDirectMessages,
    showOnline: user.showOnline,
    showLastSeen: user.showLastSeen,
    lastSeenAt: user.lastSeenAt,
    createdAt: user.createdAt
  };
}
