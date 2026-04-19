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

// Dodany nowy typ
export type ContactMsg = { 
  id: string; 
  ip: string; 
  email: string; 
  subject: string; 
  category?: string;
  message: string; 
  createdAt: number; 
};

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.ok === false) {
    const msg = data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
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
    }), // <--- TUTAJ BRAKOWAŁO PRZECINKA!

  // Nowe metody z poprawną składnią
  getMessages: () => req<{ messages: ContactMsg[] }>("/admin/api/messages"),
  
  deleteMessage: (id: string) => req<{ ok: true }>("/admin/api/messages/delete", {
      method: "POST",
      body: JSON.stringify({ id })
  })
};