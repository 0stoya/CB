import type { AccountUser } from "./auth";

export type AccountSession = {
  id: string;
  device: string;
  location: string;
  lastSeenAt: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
};

export type AccountFavourite = {
  channel: { id: string; slug: string; name: string; topic: string | null };
  autoJoin: boolean;
  position: number;
};

export type AccountMembership = {
  channel: { id: string; slug: string; name: string; isOfficial: boolean };
  role: "OWNER" | "MODERATOR" | "MEMBER";
  muteNotifications: boolean;
  joinedAt: string;
};

export type AccountOverview = {
  user: AccountUser;
  sessions: AccountSession[];
  favourites: AccountFavourite[];
  memberships: AccountMembership[];
  blocked: { id: string; nickname: string }[];
};

export class AccountDashboardApiError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "AccountDashboardApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/account${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new AccountDashboardApiError(payload?.error || `REQUEST_FAILED_${response.status}`);
  }
  return payload as T;
}

export const accountDashboardApi = {
  overview: () => request<{ ok: true } & AccountOverview>("/overview"),
  updateProfile: (nickname: string) =>
    request<{ ok: true; user: AccountUser }>("/profile", {
      method: "PATCH",
      body: JSON.stringify({ nickname })
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>("/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    }),
  revokeSession: (sessionId: string) =>
    request<{ ok: true; currentSessionRevoked: boolean }>(`/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE"
    }),
  revokeOthers: () =>
    request<{ ok: true; revoked: number }>("/sessions/revoke-others", { method: "POST" }),
  setRoomNotificationsMuted: (channelId: string, muted: boolean) =>
    request<{ ok: true; muteNotifications: boolean }>(
      `/rooms/${encodeURIComponent(channelId)}/notifications`,
      { method: "PATCH", body: JSON.stringify({ muted }) }
    ),
  exportData: async () => {
    const response = await fetch("/api/account/export", { credentials: "include" });
    if (!response.ok) throw new AccountDashboardApiError("EXPORT_FAILED");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chati-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
  deleteAccount: (password: string, confirmation: string) =>
    request<{ ok: true }>("/delete", {
      method: "POST",
      body: JSON.stringify({ password, confirmation })
    })
};
