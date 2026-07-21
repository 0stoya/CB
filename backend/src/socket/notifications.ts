import type { Server } from "socket.io";
import { publicNotification } from "../services/notifications";

export type StoredNotification = Parameters<typeof publicNotification>[0];

export class NotificationRuntime {
  constructor(private readonly io: Server) {}

  private room(userId: string) {
    return `account:${userId}`;
  }

  emitCreated(userId: string, notification: StoredNotification) {
    this.io.to(this.room(userId)).emit("notification.created", {
      notification: publicNotification(notification)
    });
    this.emitChanged(userId);
  }

  emitChanged(userId: string) {
    this.io.to(this.room(userId)).emit("notifications.changed", {});
  }
}
