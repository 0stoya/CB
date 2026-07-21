export type AccountUser = {
  id: string;
  email: string;
  nickname: string;
  emailVerified: boolean;
  status: string;
  createdAt: string;
};

type ApiErrorPayload = {
  ok?: false;
  error?: string;
  fields?: Record<string, string[]>;
  accountCreated?: boolean;
};

export class AccountApiError extends Error {
  code: string;
  fields?: Record<string, string[]>;
  accountCreated?: boolean;

  constructor(payload: ApiErrorPayload, status: number) {
    super(payload.error || `Request failed (${status})`);
    this.name = "AccountApiError";
    this.code = payload.error || "REQUEST_FAILED";
    this.fields = payload.fields;
    this.accountCreated = payload.accountCreated;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/auth${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;
  if (!response.ok || payload.ok === false) {
    throw new AccountApiError(payload, response.status);
  }

  return payload;
}

export const accountApi = {
  register: (input: { email: string; nickname: string; password: string }) =>
    request<{ ok: true; verificationRequired: true }>("/register", {
      method: "POST",
      body: JSON.stringify(input)
    }),

  verifyEmail: (token: string) =>
    request<{ ok: true }>("/verify-email", {
      method: "POST",
      body: JSON.stringify({ token })
    }),

  resendVerification: (email: string) =>
    request<{ ok: true }>("/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email })
    }),

  login: (email: string, password: string) =>
    request<{ ok: true; user: AccountUser }>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),

  logout: () => request<{ ok: true }>("/logout", { method: "POST" }),

  me: () => request<{ ok: true; user: AccountUser | null }>("/me"),

  forgotPassword: (email: string) =>
    request<{ ok: true }>("/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    }),

  resetPassword: (token: string, password: string) =>
    request<{ ok: true }>("/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password })
    })
};
