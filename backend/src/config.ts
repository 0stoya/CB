import "dotenv/config";

function num(name: string, fallback: number) {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function str(name: string, fallback: string) {
  return process.env[name] ?? fallback;
}

export const config = {
  port: num("PORT", 3066),
  nodeEnv: str("NODE_ENV", "development"),

  corsOrigin: str("CORS_ORIGIN", "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  onlineBroadcastIntervalMs: num("ONLINE_BROADCAST_INTERVAL_MS", 15000),

  maxMessageLength: num("MAX_MESSAGE_LENGTH", 500),
  msgRateLimitPerSec: num("MSG_RATE_LIMIT_PER_SEC", 5),
  msgRateBurst: num("MSG_RATE_BURST", 10),

  typingThrottleMs: num("TYPING_THROTTLE_MS", 300),

  bannedWords: (process.env.BANNED_WORDS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  // multi-connection control
  maxSocketsPerIp: num("MAX_SOCKETS_PER_IP", 5),
  ipWhitelist: str("IP_WHITELIST", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // report + ban
  reportWindowMs: num("REPORT_WINDOW_MS", 10 * 60 * 1000),
  reportBotThreshold: num("REPORT_BOT_THRESHOLD", 3),
  reportAbuseThreshold: num("REPORT_ABUSE_THRESHOLD", 5),
  banDurationMs: num("BAN_DURATION_MS", 24 * 60 * 60 * 1000),
  banPersistPath: str("BAN_PERSIST_PATH", "./data/bans.json"),

  // admin
  adminToken: str("Kj9xW2vL5mPz8tR4nY6bC1qF3hD0sV7gM9rJ2wZ5xN8cK4vB1lH7jT0fP3dG6mR9yX2bL5nC8vQ1tZ4sF7hD0jW3gM9rK2xP5cN8vB1lH7jT0fP3dG6mR9yX2bL5nC8vQ1", ""),
  adminUsername: str("ADMIN_USERNAME", "admin"),
adminPasswordHash: str("ADMIN_PASSWORD_HASH", ""),
sessionSecret: str("SESSION_SECRET", ""),
adminIpWhitelist: str("ADMIN_IP_WHITELIST", "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean),
};