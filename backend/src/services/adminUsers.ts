import { Prisma, type UserStatus } from "@prisma/client";
import { prisma } from "../db";

export class AdminUserError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code);
    this.name = "AdminUserError";
  }
}

function safePage(value: number, fallback: number, max: number) {
  return Math.min(max, Math.max(1, Number.isFinite(value) ? Math.floor(value) : fallback));
}

export async function listAdminUsers(input: {
  query?: string;
  status?: UserStatus;
  page?: number;
  pageSize?: number;
}) {
  const page = safePage(input.page ?? 1, 1, 100000);
  const pageSize = safePage(input.pageSize ?? 25, 25, 100);
  const query = input.query?.trim().slice(0, 100) || "";
  const where: Prisma.UserWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { nickname: { contains: query, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        nickname: true,
        status: true,
        emailVerifiedAt: true,
        lastSeenAt: true,
        createdAt: true,
        deletedAt: true,
        _count: {
          select: {
            sessions: true,
            createdChannels: true,
            channelMessages: true,
            sentDirectMessages: true,
            receivedDirectMessages: true,
            notifications: true
          }
        }
      }
    })
  ]);

  return {
    users,
    pagination: {
      page,
      pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
}

export async function getAdminUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      nickname: true,
      status: true,
      emailVerifiedAt: true,
      friendRequestPolicy: true,
      allowDirectMessages: true,
      showOnline: true,
      showLastSeen: true,
      lastSeenAt: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      sessions: {
        orderBy: { lastSeenAt: "desc" },
        take: 20,
        select: {
          id: true,
          locationLabel: true,
          lastSeenAt: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
          userAgent: true
        }
      },
      createdChannels: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, slug: true, name: true, status: true, createdAt: true }
      },
      _count: {
        select: {
          sessions: true,
          createdChannels: true,
          channelMemberships: true,
          channelFavourites: true,
          channelMessages: true,
          sentDirectMessages: true,
          receivedDirectMessages: true,
          notifications: true,
          friendshipRequests: true,
          friendshipResponses: true
        }
      }
    }
  });
  if (!user) throw new AdminUserError("USER_NOT_FOUND", 404);
  return user;
}

export async function setAdminUserStatus(input: {
  userId: string;
  status: "ACTIVE" | "SUSPENDED";
  adminUsername: string;
  reason?: string | null;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { status: true } });
  if (!user) throw new AdminUserError("USER_NOT_FOUND", 404);
  if (user.status === "DELETED") throw new AdminUserError("DELETED_ACCOUNT_IMMUTABLE", 409);

  const now = new Date();
  const reason = input.reason?.trim().slice(0, 500) || null;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: input.userId }, data: { status: input.status } });
    if (input.status === "SUSPENDED") {
      await tx.authSession.updateMany({
        where: { userId: input.userId, revokedAt: null },
        data: { revokedAt: now }
      });
    }
    await tx.moderationAction.create({
      data: {
        actorAdmin: input.adminUsername,
        targetUserId: input.userId,
        action: input.status === "SUSPENDED" ? "SUSPEND_USER" : "REACTIVATE_USER",
        reason,
        metadata: { previousStatus: user.status }
      }
    });
  });
  return getAdminUser(input.userId);
}

export async function revokeAdminUserSessions(input: {
  userId: string;
  adminUsername: string;
  reason?: string | null;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) throw new AdminUserError("USER_NOT_FOUND", 404);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const result = await tx.authSession.updateMany({
      where: { userId: input.userId, revokedAt: null },
      data: { revokedAt: now }
    });
    await tx.moderationAction.create({
      data: {
        actorAdmin: input.adminUsername,
        targetUserId: input.userId,
        action: "REVOKE_USER_SESSIONS",
        reason: input.reason?.trim().slice(0, 500) || null
      }
    });
    return result.count;
  });
}
