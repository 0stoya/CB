import { config } from "../config";
import { prisma } from "../db";
import { logger } from "../utils/logger";
import { getEmailHealth, verifyEmailTransport } from "./email";
import { getRequestMetrics } from "./requestMetrics";

type CleanupCounts = {
  sessions: number;
  verificationTokens: number;
  passwordResetTokens: number;
  notifications: number;
  emailDeliveries: number;
  dailyMetrics: number;
};

type MaintenanceState = {
  running: boolean;
  startedAt: Date | null;
  finishedAt: Date | null;
  success: boolean | null;
  counts: CleanupCounts | null;
  error: string | null;
};

const maintenanceState: MaintenanceState = {
  running: false,
  startedAt: null,
  finishedAt: null,
  success: null,
  counts: null,
  error: null
};

function daysAgo(days: number) {
  return new Date(Date.now() - Math.max(0, days) * 24 * 60 * 60 * 1000);
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
}

export async function rollupDailyMetric(dayValue: Date) {
  const day = startOfUtcDay(dayValue);
  const nextDay = addUtcDays(day, 1);
  const range = { gte: day, lt: nextDay };

  const [
    registeredUsers,
    verifiedUsers,
    activeSessionUsers,
    publicMessages,
    directMessages,
    roomsCreated,
    reportsCreated,
    notificationsCreated,
    emailsSent,
    emailsFailed
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: range } }),
    prisma.user.count({ where: { emailVerifiedAt: range } }),
    prisma.authSession.findMany({
      where: { lastSeenAt: range },
      select: { userId: true },
      distinct: ["userId"]
    }),
    prisma.channelMessage.count({ where: { createdAt: range } }),
    prisma.directMessage.count({ where: { createdAt: range } }),
    prisma.channel.count({ where: { createdAt: range } }),
    prisma.report.count({ where: { createdAt: range } }),
    prisma.notification.count({ where: { createdAt: range } }),
    prisma.emailDelivery.count({ where: { createdAt: range, status: "SENT" } }),
    prisma.emailDelivery.count({ where: { createdAt: range, status: "FAILED" } })
  ]);

  return prisma.dailyMetric.upsert({
    where: { day },
    create: {
      day,
      registeredUsers,
      verifiedUsers,
      activeUsers: activeSessionUsers.length,
      publicMessages,
      directMessages,
      roomsCreated,
      reportsCreated,
      notificationsCreated,
      emailsSent,
      emailsFailed,
      generatedAt: new Date()
    },
    update: {
      registeredUsers,
      verifiedUsers,
      activeUsers: activeSessionUsers.length,
      publicMessages,
      directMessages,
      roomsCreated,
      reportsCreated,
      notificationsCreated,
      emailsSent,
      emailsFailed,
      generatedAt: new Date()
    }
  });
}

export async function rebuildDailyMetrics(days = 30) {
  const safeDays = Math.min(90, Math.max(1, Math.floor(days)));
  const today = startOfUtcDay(new Date());
  const rows = [];
  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    rows.push(await rollupDailyMetric(addUtcDays(today, -offset)));
  }
  return rows;
}

export async function listDailyMetrics(days = 30) {
  const safeDays = Math.min(90, Math.max(1, Math.floor(days)));
  const from = addUtcDays(startOfUtcDay(new Date()), -(safeDays - 1));
  return prisma.dailyMetric.findMany({
    where: { day: { gte: from } },
    orderBy: { day: "asc" }
  });
}

export async function runMaintenance() {
  if (maintenanceState.running) return { skipped: true, state: { ...maintenanceState } };

  maintenanceState.running = true;
  maintenanceState.startedAt = new Date();
  maintenanceState.finishedAt = null;
  maintenanceState.success = null;
  maintenanceState.error = null;

  try {
    const sessionCutoff = daysAgo(config.sessionRecordRetentionDays);
    const tokenCutoff = daysAgo(config.tokenRecordRetentionDays);
    const notificationCutoff = daysAgo(config.readNotificationRetentionDays);
    const emailCutoff = daysAgo(config.emailDeliveryRetentionDays);
    const analyticsCutoff = startOfUtcDay(daysAgo(config.analyticsRetentionDays));

    const [sessions, verificationTokens, passwordResetTokens, notifications, emailDeliveries, dailyMetrics] =
      await prisma.$transaction([
        prisma.authSession.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: sessionCutoff } },
              { revokedAt: { lt: sessionCutoff } }
            ]
          }
        }),
        prisma.emailVerificationToken.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: tokenCutoff } },
              { usedAt: { lt: tokenCutoff } }
            ]
          }
        }),
        prisma.passwordResetToken.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: tokenCutoff } },
              { usedAt: { lt: tokenCutoff } }
            ]
          }
        }),
        prisma.notification.deleteMany({ where: { readAt: { lt: notificationCutoff } } }),
        prisma.emailDelivery.deleteMany({ where: { createdAt: { lt: emailCutoff } } }),
        prisma.dailyMetric.deleteMany({ where: { day: { lt: analyticsCutoff } } })
      ]);

    await Promise.all([rollupDailyMetric(new Date()), rollupDailyMetric(daysAgo(1))]);

    const counts: CleanupCounts = {
      sessions: sessions.count,
      verificationTokens: verificationTokens.count,
      passwordResetTokens: passwordResetTokens.count,
      notifications: notifications.count,
      emailDeliveries: emailDeliveries.count,
      dailyMetrics: dailyMetrics.count
    };
    maintenanceState.counts = counts;
    maintenanceState.success = true;
    maintenanceState.finishedAt = new Date();
    logger.info("Maintenance completed", counts);
    return { skipped: false, state: { ...maintenanceState } };
  } catch (error) {
    maintenanceState.success = false;
    maintenanceState.error = errorText(error);
    maintenanceState.finishedAt = new Date();
    logger.error("Maintenance failed", { error: maintenanceState.error });
    throw error;
  } finally {
    maintenanceState.running = false;
  }
}

export function startMaintenanceLoop() {
  void runMaintenance().catch(() => undefined);
  return setInterval(() => {
    void runMaintenance().catch(() => undefined);
  }, Math.max(60_000, config.maintenanceIntervalMs)).unref();
}

async function databaseHealth() {
  const started = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  return { ok: true as const, latencyMs: Date.now() - started };
}

export async function getOperationsOverview(options?: { verifySmtp?: boolean }) {
  const db = await databaseHealth().catch((error) => ({
    ok: false as const,
    latencyMs: null,
    error: errorText(error)
  }));
  const smtp = options?.verifySmtp ? await verifyEmailTransport() : getEmailHealth();
  const [users, activeSessions, openReports, unreadNotifications, latestMetric] = await Promise.all([
    prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.authSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.report.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    prisma.notification.count({ where: { readAt: null } }),
    prisma.dailyMetric.findFirst({ orderBy: { day: "desc" } })
  ]);

  return {
    generatedAt: new Date(),
    application: {
      version: config.appVersion,
      buildSha: config.buildSha,
      nodeEnv: config.nodeEnv,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memory: process.memoryUsage()
    },
    database: db,
    smtp,
    http: getRequestMetrics(),
    maintenance: { ...maintenanceState },
    counts: {
      users: Object.fromEntries(users.map((row) => [row.status, row._count._all])),
      activeSessions,
      openReports,
      unreadNotifications
    },
    latestMetric
  };
}

export async function readiness() {
  const timeout = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => reject(new Error("READINESS_TIMEOUT")), config.readinessTimeoutMs);
    timer.unref();
  });
  return Promise.race([databaseHealth(), timeout]);
}
