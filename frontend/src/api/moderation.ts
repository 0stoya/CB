export type ReportTargetType = "CHANNEL" | "CHANNEL_MESSAGE" | "DIRECT_MESSAGE" | "USER";
export type ReportReason =
  | "SPAM"
  | "HARASSMENT"
  | "HATE"
  | "SEXUAL"
  | "VIOLENCE"
  | "IMPERSONATION"
  | "ILLEGAL"
  | "OTHER";

const CLIENT_ID_KEY = "chati_client_id";

function clientId() {
  let value = localStorage.getItem(CLIENT_ID_KEY);
  if (value) return value;
  value = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `web_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  localStorage.setItem(CLIENT_ID_KEY, value);
  return value;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/moderation${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload as T;
}

export const moderationApi = {
  report: (input: {
    targetType: ReportTargetType;
    targetId: string;
    reason: ReportReason;
    details?: string;
  }) =>
    request<{ ok: true; reportId: string }>("/reports", {
      method: "POST",
      body: JSON.stringify({ ...input, reporterClientId: clientId() })
    }),

  updateRoom: (
    slug: string,
    input: { topic?: string | null; allowGuests?: boolean; slowModeSeconds?: number; isLocked?: boolean }
  ) =>
    request<{ ok: true }>(`/channels/${encodeURIComponent(slug)}/settings`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),

  kickMember: (slug: string, memberId: string, reason?: string) =>
    request<{ ok: true }>(
      `/channels/${encodeURIComponent(slug)}/members/${encodeURIComponent(memberId)}/kick`,
      { method: "POST", body: JSON.stringify({ reason }) }
    ),

  muteUser: (slug: string, userId: string, minutes: number, reason?: string) =>
    request<{ ok: true; mutedUntil: string }>(
      `/channels/${encodeURIComponent(slug)}/users/${encodeURIComponent(userId)}/mute`,
      { method: "POST", body: JSON.stringify({ minutes, reason }) }
    ),

  unmuteUser: (slug: string, userId: string) =>
    request<{ ok: true }>(
      `/channels/${encodeURIComponent(slug)}/users/${encodeURIComponent(userId)}/mute`,
      { method: "DELETE" }
    ),

  banUser: (slug: string, userId: string, reason?: string) =>
    request<{ ok: true }>(
      `/channels/${encodeURIComponent(slug)}/users/${encodeURIComponent(userId)}/ban`,
      { method: "POST", body: JSON.stringify({ reason }) }
    ),

  unbanUser: (slug: string, userId: string) =>
    request<{ ok: true }>(
      `/channels/${encodeURIComponent(slug)}/users/${encodeURIComponent(userId)}/ban`,
      { method: "DELETE" }
    ),

  setModerator: (slug: string, userId: string, enabled: boolean) =>
    request<{ ok: true }>(
      `/channels/${encodeURIComponent(slug)}/users/${encodeURIComponent(userId)}/moderator`,
      { method: enabled ? "PUT" : "DELETE" }
    ),

  deleteMessage: (slug: string, messageId: string, reason?: string) =>
    request<{ ok: true }>(
      `/channels/${encodeURIComponent(slug)}/messages/${encodeURIComponent(messageId)}`,
      { method: "DELETE", body: JSON.stringify({ reason }) }
    )
};
