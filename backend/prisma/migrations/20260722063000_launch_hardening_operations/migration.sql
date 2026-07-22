-- Extend the existing moderation audit enum for direct admin account actions.
ALTER TYPE "ModerationActionType" ADD VALUE IF NOT EXISTS 'REACTIVATE_USER';
ALTER TYPE "ModerationActionType" ADD VALUE IF NOT EXISTS 'REVOKE_USER_SESSIONS';

CREATE TYPE "EmailDeliveryKind" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PREVIEW', 'SENT', 'FAILED');

CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "kind" "EmailDeliveryKind" NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyMetric" (
    "day" DATE NOT NULL,
    "registeredUsers" INTEGER NOT NULL DEFAULT 0,
    "verifiedUsers" INTEGER NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "publicMessages" INTEGER NOT NULL DEFAULT 0,
    "directMessages" INTEGER NOT NULL DEFAULT 0,
    "roomsCreated" INTEGER NOT NULL DEFAULT 0,
    "reportsCreated" INTEGER NOT NULL DEFAULT 0,
    "notificationsCreated" INTEGER NOT NULL DEFAULT 0,
    "emailsSent" INTEGER NOT NULL DEFAULT 0,
    "emailsFailed" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("day")
);

CREATE INDEX "EmailDelivery_status_createdAt_idx" ON "EmailDelivery"("status", "createdAt");
CREATE INDEX "EmailDelivery_kind_createdAt_idx" ON "EmailDelivery"("kind", "createdAt");
CREATE INDEX "EmailDelivery_recipientHash_createdAt_idx" ON "EmailDelivery"("recipientHash", "createdAt");
