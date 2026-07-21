export type SocialSettings = {
  friendRequestPolicy: "EVERYONE" | "SHARED_CHANNELS" | "NOBODY";
  allowDirectMessages: boolean;
  showOnline: boolean;
  showLastSeen: boolean;
};

export type DirectMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
};

export type SocialFriend = {
  relationshipId: string;
  user: {
    id: string;
    nickname: string;
    online: boolean;
    lastSeenAt: string | null;
    allowDirectMessages: boolean;
  };
  conversation: {
    id: string;
    updatedAt: string;
    unread: number;
    lastMessage: {
      id: string;
      senderId: string;
      text: string;
      createdAt: string;
      deliveredAt: string | null;
      readAt: string | null;
    } | null;
  } | null;
};

export type SocialOverview = {
  ok: true;
  friends: SocialFriend[];
  incoming: Array<{
    id: string;
    createdAt: string;
    user: { id: string; nickname: string; online: boolean };
  }>;
  outgoing: Array<{
    id: string;
    createdAt: string;
    user: { id: string; nickname: string };
  }>;
  blocked: Array<{ id: string; user: { id: string; nickname: string } }>;
  settings: SocialSettings;
};

export type PersonSearchResult = {
  id: string;
  nickname: string;
  online: boolean;
  relationshipStatus: "NONE" | "PENDING_INCOMING" | "PENDING_OUTGOING" | "FRIENDS" | "BLOCKED";
};

export class SocialApiError extends Error {
  constructor(public readonly code: string, status: number) {
    super(code || `Request failed (${status})`);
    this.name = "SocialApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/social${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new SocialApiError(payload?.error || "REQUEST_FAILED", response.status);
  }
  return payload as T;
}

export const socialApi = {
  overview: () => request<SocialOverview>("/overview"),
  search: (query: string) =>
    request<{ ok: true; users: PersonSearchResult[] }>(`/search?q=${encodeURIComponent(query)}`),
  sendRequest: (nickname: string) =>
    request<{ ok: true; requestId: string }>("/requests", {
      method: "POST",
      body: JSON.stringify({ nickname })
    }),
  acceptRequest: (id: string) => request<{ ok: true }>(`/requests/${id}/accept`, { method: "POST" }),
  declineRequest: (id: string) => request<{ ok: true }>(`/requests/${id}/decline`, { method: "POST" }),
  cancelRequest: (id: string) => request<{ ok: true }>(`/requests/${id}/cancel`, { method: "POST" }),
  removeFriend: (friendId: string) =>
    request<{ ok: true }>(`/friends/${friendId}/remove`, { method: "POST" }),
  blockUser: (targetId: string) =>
    request<{ ok: true }>(`/users/${targetId}/block`, { method: "POST" }),
  unblockUser: (targetId: string) =>
    request<{ ok: true }>(`/users/${targetId}/unblock`, { method: "POST" }),
  updateSettings: (settings: SocialSettings) =>
    request<{ ok: true; settings: SocialSettings }>("/settings", {
      method: "PATCH",
      body: JSON.stringify(settings)
    }),
  messages: (friendId: string, before?: string) =>
    request<{ ok: true; conversationId: string | null; messages: DirectMessage[] }>(
      `/conversations/${friendId}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`
    ),
  markRead: (friendId: string) =>
    request<{ ok: true; readAt: string }>(`/conversations/${friendId}/read`, { method: "POST" })
};
