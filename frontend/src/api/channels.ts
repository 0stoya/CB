import type { PublicChannelMessage } from "../socket";

export type ChannelListItem = {
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
  status: string;
  lastActivityAt: string;
  createdAt: string;
  creator: { id: string; nickname: string } | null;
  online: number;
  favourite: boolean;
  autoJoin: boolean;
  _count: { favourites: number; messages: number };
};

export class ChannelApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
    this.name = "ChannelApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/channels${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    ok?: boolean;
    error?: string;
  };
  if (!response.ok || payload.ok === false) {
    throw new ChannelApiError(payload.error || `REQUEST_FAILED_${response.status}`, response.status);
  }
  return payload;
}

export const channelsApi = {
  list: () => request<{ ok: true; channels: ChannelListItem[] }>("/"),
  favourites: () => request<{ ok: true; channels: ChannelListItem[] }>("/favourites"),
  messages: (slug: string) =>
    request<{ ok: true; messages: Omit<PublicChannelMessage, "slug">[] }>(
      `/${encodeURIComponent(slug)}/messages`
    ),
  create: (input: {
    name: string;
    topic?: string;
    language?: string;
    isUnlisted?: boolean;
    allowGuests?: boolean;
    maxMembers?: number;
    slowModeSeconds?: number;
  }) =>
    request<{ ok: true; channel: ChannelListItem }>("/", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  favourite: (slug: string, autoJoin = false) =>
    request<{ ok: true }>(`/${encodeURIComponent(slug)}/favourite`, {
      method: "PUT",
      body: JSON.stringify({ autoJoin })
    }),
  updateFavourite: (slug: string, autoJoin: boolean) =>
    request<{ ok: true }>(`/${encodeURIComponent(slug)}/favourite`, {
      method: "PATCH",
      body: JSON.stringify({ autoJoin })
    }),
  unfavourite: (slug: string) =>
    request<{ ok: true }>(`/${encodeURIComponent(slug)}/favourite`, {
      method: "DELETE"
    })
};
