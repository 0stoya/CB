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

export type AdminUserSummary = {
  id: string;
  email: string;
  nickname: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  emailVerifiedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  _count: {
    sessions: number;
    createdChannels: number;
    channelMessages: number;
    sentDirectMessages: number;
    receivedDirectMessages: number;
    notifications: number;
  };
};

export type AdminUserDetail = AdminUserSummary & {
  friendRequestPolicy: "EVERYONE" | "SHARED_CHANNELS" | "NOBODY";
  allowDirectMessages: boolean;
  showOnline: boolean;
  showLastSeen: boolean;
  updatedAt: string;
  sessions: Array<{
    id: string;
    locationLabel: string | null;
    lastSeenAt: string;
    expiresAt: string;
    revokedAt: string | null;
    createdAt: string;
    userAgent: string | null;
  }>;
  createdChannels: Array<{
    id: string;
    slug: string;
    name: string;
    status: "ACTIVE" | "ARCHIVED" | "DELETED";
    createdAt: string;
  }>;
  _count: AdminUserSummary["_count"] & {
    channelMemberships: number;
    channelFavourites: number;
    friendshipRequests: number;
    friendshipResponses: number;
  };
};

export type DailyMetric = {
  day: string;
  registeredUsers: number;
  verifiedUsers: number;
  activeUsers: number;
  publicMessages: number;
  directMessages: number;
  roomsCreated: number;
  reportsCreated: number;
  notificationsCreated: number;
  emailsSent: number;
  emailsFailed: number;
  generatedAt: string;
};

export type OperationsOverview = {
  generatedAt: string;
  application: {
    version: string;
    buildSha: string;
    nodeEnv: string;
    uptimeSeconds: number;
    nodeVersion: string;
    memory: { rss: number; heapTotal: number; heapUsed: number; external: number; arrayBuffers: number };
  };
  database: { ok: boolean; latencyMs: number | null; error?: string };
  smtp: {
    configured: boolean;
    lastCheckedAt: string | null;
    lastCheckOk: boolean | null;
    lastCheckError: string | null;
    lastSentAt: string | null;
    lastFailedAt: string | null;
  };
  maintenance: {
    running: boolean;
    startedAt: string | null;
    finishedAt: string | null;
    success: boolean | null;
    counts: Record<string, number> | null;
    error: string | null;
  };
  counts: {
    users: Record<string, number>;
    activeSessions: number;
    openReports: number;
    unreadNotifications: number;
  };
  latestMetric: DailyMetric | null;
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
  operations: () => req<{ ok: true; operations: OperationsOverview }>("/admin/api/operations"),
  verifySmtp: () => req<{ ok: true; operations: OperationsOverview }>("/admin/api/operations/smtp-check", { method: "POST" }),
  runMaintenance: () => req<{ ok: true; result: unknown }>("/admin/api/operations/maintenance", { method: "POST" }),
  analytics: (days = 30) => req<{ ok: true; days: number; metrics: DailyMetric[] }>(`/admin/api/analytics?days=${days}`),
  rebuildAnalytics: (days = 30) => req<{ ok: true; metrics: DailyMetric[] }>("/admin/api/analytics/rebuild", {
    method: "POST",
    body: JSON.stringify({ days })
  }),
  users: (input?: { q?: string; status?: AdminUserSummary["status"]; page?: number; pageSize?: number }) => {
    const params = new URLSearchParams();
    if (input?.q) params.set("q", input.q);
    if (input?.status) params.set("status", input.status);
    if (input?.page) params.set("page", String(input.page));
    if (input?.pageSize) params.set("pageSize", String(input.pageSize));
    return req<{ ok: true; users: AdminUserSummary[]; pagination: { page: number; pageSize: number; total: number; pages: number } }>(
      `/admin/api/users${params.size ? `?${params.toString()}` : ""}`
    );
  },
  user: (id: string) => req<{ ok: true; user: AdminUserDetail }>(`/admin/api/users/${encodeURIComponent(id)}`),
  setUserStatus: (id: string, status: "ACTIVE" | "SUSPENDED", reason?: string) =>
    req<{ ok: true; user: AdminUserDetail }>(`/admin/api/users/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason })
    }),
  revokeUserSessions: (id: string, reason?: string) =>
    req<{ ok: true; revoked: number }>(`/admin/api/users/${encodeURIComponent(id)}/revoke-sessions`, {
      method: "POST",
      body: JSON.stringify({ reason })
    }),
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
