import "dotenv/config";

function num(name: string, fallback: number) {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function str(name: string, fallback: string) {
  return process.env[name] ?? fallback;
}

function bool(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export const config = {
  port: num("PORT", 3066),
  nodeEnv: str("NODE_ENV", "development"),

  corsOrigin: str("CORS_ORIGIN", "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  publicAppUrl: str("PUBLIC_APP_URL", "http://localhost:5173").replace(/\/$/, ""),

  onlineBroadcastIntervalMs: num("ONLINE_BROADCAST_INTERVAL_MS", 15000),

  maxMessageLength: num("MAX_MESSAGE_LENGTH", 500),
  msgRateLimitPerSec: num("MSG_RATE_LIMIT_PER_SEC", 5),
  msgRateBurst: num("MSG_RATE_BURST", 10),

  typingThrottleMs: num("TYPING_THROTTLE_MS", 300),

  bannedWords: (process.env.BANNED_WORDS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  maxSocketsPerIp: num("MAX_SOCKETS_PER_IP", 5),
  ipWhitelist: str("IP_WHITELIST", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  reportWindowMs: num("REPORT_WINDOW_MS", 10 * 60 * 1000),
  reportBotThreshold: num("REPORT_BOT_THRESHOLD", 3),
  reportAbuseThreshold: num("REPORT_ABUSE_THRESHOLD", 5),
  banDurationMs: num("BAN_DURATION_MS", 24 * 60 * 60 * 1000),
  banPersistPath: str("BAN_PERSIST_PATH", "./data/bans.json"),

  adminToken: str("ADMIN_TOKEN", ""),
  adminUsername: str("ADMIN_USERNAME", "admin"),
  adminPasswordHash: str("ADMIN_PASSWORD_HASH", ""),
  sessionSecret: str("SESSION_SECRET", ""),
  adminIpWhitelist: str("ADMIN_IP_WHITELIST", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  bcryptRounds: num("BCRYPT_ROUNDS", 12),
  userSessionDays: num("USER_SESSION_DAYS", 30),
  emailVerificationHours: num("EMAIL_VERIFICATION_HOURS", 24),
  passwordResetMinutes: num("PASSWORD_RESET_MINUTES", 30),

  channelInactiveHours: num("CHANNEL_INACTIVE_HOURS", 48),
  channelCleanupIntervalMs: num("CHANNEL_CLEANUP_INTERVAL_MS", 60 * 60 * 1000),
  channelHistoryLimit: num("CHANNEL_HISTORY_LIMIT", 100),
  channelMaxAutoJoin: num("CHANNEL_MAX_AUTO_JOIN", 5),
  channelMaxJoined: num("CHANNEL_MAX_JOINED", 8),

  smtpHost: str("SMTP_HOST", ""),
  smtpPort: num("SMTP_PORT", 587),
  smtpSecure: bool("SMTP_SECURE", false),
  smtpUser: str("SMTP_USER", ""),
  smtpPassword: str("SMTP_PASSWORD", ""),
  smtpFrom: str("SMTP_FROM", "Chati <noreply@chati.online>")
};
