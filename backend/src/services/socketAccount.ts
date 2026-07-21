import { createHash } from "crypto";
import { prisma } from "../db";
import { USER_SESSION_COOKIE } from "./accountAuth";

function readCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getSocketAccount(cookieHeader: string | undefined) {
  const token = readCookie(cookieHeader, USER_SESSION_COOKIE);
  if (!token) return null;

  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          emailVerifiedAt: true,
          status: true,
          showOnline: true,
          showLastSeen: true,
          allowDirectMessages: true
        }
      }
    }
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.status !== "ACTIVE" ||
    !session.user.emailVerifiedAt
  ) {
    return null;
  }

  return session.user;
}
