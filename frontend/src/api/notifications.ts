export type NotificationType =
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPTED"
  | "DIRECT_MESSAGE"
  | "CHANNEL_MENTION"
  | "MODERATOR_PROMOTED"
  | "ROOM_MUTED"
  | "ROOM_KICKED"
  | "ROOM_BANNED"
  | "SYSTEM";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  metadata: unknown;
  readAt: string | null;
  createdAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/notifications${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }
  return payload as T;
}

export const notificationsApi = {
  list: (limit = 50) =>
    request<{ ok: true; notifications: NotificationItem[]; unread: number }>(`/?limit=${limit}`),
  markRead: (id: string) => request<{ ok: true }>(`/${encodeURIComponent(id)}/read`, { method: "POST" }),
  markAllRead: () => request<{ ok: true }>("/read-all", { method: "POST" }),
  markLinkRead: (link: string) =>
    request<{ ok: true }>("/read-link", { method: "POST", body: JSON.stringify({ link }) }),
  processMentions: (messageId: string) =>
    request<{ ok: true; created: number }>("/process-mentions", {
      method: "POST",
      body: JSON.stringify({ messageId })
    })
};
