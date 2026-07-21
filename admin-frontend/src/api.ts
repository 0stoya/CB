export type ReportType = "bot" | "abuse";

export type AdminMe = {
  ok: true;
  isAdmin: boolean;
  username: string | null;
};

export type Stats = {
  ok: true;
  now: number;
  online: number;
  queueSize: number;
  activeRooms: number;
  publicRoomsActive: number;
  publicRoomUsers: number;
  publicMessages: number;
  totals: { matches: number; messages: number };
  last60s: { matches: number; messages: number };
  reports: { bot: number; abuse: number; windowMs: number };
  bansActive: number;
};

export type BanRecord = {
  ip: string;
  until: number;
  flagged: boolean;
  source?: "auto" | "manual";
  reasons: { bot: number; abuse: number };
  note?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type ContactMsg = {
  id: string;
  ip: string;
  email: string;
  subject: string;
  category?: string;
  message: string;
  createdAt: number;
};

export type AdminChannel = {
  id: string;
  slug: string;
  name: string;
  topic: string | null;
  language: string;
  isOfficial: boolean;
  isUnlisted: boolean;
  allowGuests: boolean;
  maxMembers: number;
  slowModeSeconds: number;
  protectedFromExpiry: boolean;
  status: "ACTIVE" | "ARCHIVED" | "DELETED";
  lastActivityAt: string;
  createdAt: string;
  online: number;
  creator: { id: string; nickname: string } | null;
  _count: { favourites: number; messages: number };
};

export type AdminReport = {
  id: string;
  reporterUserId: string | null;
  reporterClientId: string | null;
  targetType: "CHANNEL" | "CHANNEL_MESSAGE" | "DIRECT_MESSAGE" | "USER";
  targetId: string;
  channelId: string | null;
  reason: "SPAM" | "HARASSMENT" | "HATE" | "SEXUAL" | "VIOLENCE" | "IMPERSONATION" | "ILLEGAL" | "OTHER";
  details: string | null;
  snapshot: Record<string, unknown>;
  status: "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED";
  resolutionNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminModerationAction = {
  id: string;
  channelId: string | null;
  actorUserId: string | null;
  actorAdmin: string | null;
  targetUserId: string | null;
  targetMessageId: string | null;
  reportId: string | null;
  action: string;
  reason: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.ok === false) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  return json<T>(res);
}

export const api = {
  me: () => req<AdminMe>("/admin/api/me"),
  login: (username: string, password: string) =>
    req<{ ok: true }>("/admin/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    }),
  logout: () => req<{ ok: true }>("/admin/api/logout", { method: "POST" }),
  stats: () => req<Stats>("/admin/api/stats"),
  bans: () => req<{ ok: true; bans: BanRecord[] }>("/admin/api/bans"),
  ban: (ip: string, reason: ReportType, durationMs: number, note?: string) =>
    req<{ ok: true; ban: BanRecord }>("/admin/api/bans/ban", {
      method: "POST",
      body: JSON.stringify({ ip, reason, durationMs, note })
    }),
  unban: (ip: string) =>
    req<{ ok: true; unbanned: boolean }>("/admin/api/bans/unban", {
      method: "POST",
      body: JSON.stringify({ ip })
    }),
  getMessages: () => req<{ ok: true; messages: ContactMsg[] }>("/admin/api/messages"),
  deleteMessage: (id: string) =>
    req<{ ok: true }>("/admin/api/messages/delete", {
      method: "POST",
      body: JSON.stringify({ id })
    }),
  channels: () => req<{ ok: true; channels: AdminChannel[] }>("/admin/api/channels"),
  updateChannel: (
    id: string,
    input: Partial<Pick<AdminChannel, "topic" | "allowGuests" | "slowModeSeconds" | "protectedFromExpiry" | "status">>
  ) =>
    req<{ ok: true; channel: AdminChannel }>(`/admin/api/channels/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  deleteChannel: (id: string) =>
    req<{ ok: true }>(`/admin/api/channels/${encodeURIComponent(id)}`, { method: "DELETE" }),
  reports: (status?: AdminReport["status"]) =>
    req<{ ok: true; reports: AdminReport[] }>(`/admin/api/reports${status ? `?status=${status}` : ""}`),
  reviewReport: (
    id: string,
    input: {
      status: "REVIEWING" | "RESOLVED" | "DISMISSED";
      action?: "NONE" | "DELETE_CONTENT" | "SUSPEND_USER" | "ARCHIVE_ROOM";
      resolutionNote?: string;
    }
  ) =>
    req<{ ok: true; report: AdminReport }>(`/admin/api/reports/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  moderationActions: () =>
    req<{ ok: true; actions: AdminModerationAction[] }>("/admin/api/moderation-actions")
};
