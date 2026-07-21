-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('CHANNEL', 'CHANNEL_MESSAGE', 'DIRECT_MESSAGE', 'USER');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'HATE', 'SEXUAL', 'VIOLENCE', 'IMPERSONATION', 'ILLEGAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('KICK', 'MUTE', 'UNMUTE', 'BAN', 'UNBAN', 'DELETE_MESSAGE', 'SET_MODERATOR', 'REMOVE_MODERATOR', 'UPDATE_ROOM', 'LOCK_ROOM', 'UNLOCK_ROOM', 'SUSPEND_USER', 'ARCHIVE_ROOM', 'RESOLVE_REPORT', 'DISMISS_REPORT');

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ChannelRestriction" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mutedUntil" TIMESTAMP(3),
    "bannedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChannelRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT,
    "reporterClientId" TEXT,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "channelId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "snapshot" JSONB NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "channelId" TEXT,
    "actorUserId" TEXT,
    "actorAdmin" TEXT,
    "targetUserId" TEXT,
    "targetMessageId" TEXT,
    "reportId" TEXT,
    "action" "ModerationActionType" NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelRestriction_channelId_userId_key" ON "ChannelRestriction"("channelId", "userId");
CREATE INDEX "ChannelRestriction_userId_bannedAt_idx" ON "ChannelRestriction"("userId", "bannedAt");
CREATE INDEX "ChannelRestriction_channelId_mutedUntil_idx" ON "ChannelRestriction"("channelId", "mutedUntil");
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");
CREATE INDEX "Report_reporterUserId_createdAt_idx" ON "Report"("reporterUserId", "createdAt");
CREATE INDEX "Report_channelId_createdAt_idx" ON "Report"("channelId", "createdAt");
CREATE INDEX "ModerationAction_channelId_createdAt_idx" ON "ModerationAction"("channelId", "createdAt");
CREATE INDEX "ModerationAction_targetUserId_createdAt_idx" ON "ModerationAction"("targetUserId", "createdAt");
CREATE INDEX "ModerationAction_reportId_createdAt_idx" ON "ModerationAction"("reportId", "createdAt");
