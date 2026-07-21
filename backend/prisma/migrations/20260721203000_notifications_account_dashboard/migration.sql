CREATE TYPE "NotificationType" AS ENUM (
  'FRIEND_REQUEST',
  'FRIEND_ACCEPTED',
  'DIRECT_MESSAGE',
  'CHANNEL_MENTION',
  'MODERATOR_PROMOTED',
  'ROOM_MUTED',
  'ROOM_KICKED',
  'ROOM_BANNED',
  'SYSTEM'
);

ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "AuthSession" ADD COLUMN "locationLabel" TEXT;
ALTER TABLE "ChannelMembership" ADD COLUMN "muteNotifications" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "link" TEXT,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_readAt_createdAt_idx"
  ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX "Notification_userId_createdAt_idx"
  ON "Notification"("userId", "createdAt");

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
