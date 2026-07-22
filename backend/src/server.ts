import express from "express";
import http from "http";
import cors from "cors";
import session from "express-session";
import { Server } from "socket.io";
import { config } from "./config";
import { prisma } from "./db";
import { logger } from "./utils/logger";
import { registerSocketHandlers } from "./socket";
import { DirectMessageRuntime } from "./socket/directMessages";
import { NotificationRuntime } from "./socket/notifications";
import { createPublicRoutes } from "./routes/publicRoutes";
import { createAdminRoutes } from "./routes/adminRoutes";
import { createAuthRoutes } from "./routes/authRoutes";
import { createAccountRoutes } from "./routes/accountRoutes";
import { createChannelRoutes } from "./routes/channelRoutes";
import { createSocialRoutes } from "./routes/socialRoutes";
import { createModerationRoutes } from "./routes/moderationRoutes";
import { createNotificationRoutes } from "./routes/notificationRoutes";
import { apiLimiter } from "./middleware/rateLimit";
import { ensureOfficialChannels } from "./services/channels";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "200kb" }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));

if (!config.sessionSecret) throw new Error("SESSION_SECRET is required");

app.use(
  session({
    name: "chati_admin",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.nodeEnv === "production",
      maxAge: 1000 * 60 * 60 * 12
    }
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.corsOrigin, credentials: true },
  transports: ["websocket", "polling"],
  pingInterval: 5000,
  pingTimeout: 8000
});

const notifications = new NotificationRuntime(io);
const socketApi = registerSocketHandlers(io);
const directMessages = new DirectMessageRuntime(io, notifications);
directMessages.attach();

app.use("/api/auth", apiLimiter, createAuthRoutes());
app.use("/api/account", apiLimiter, createAccountRoutes(socketApi));
app.use("/api/notifications", apiLimiter, createNotificationRoutes(notifications));
app.use("/api/channels", apiLimiter, createChannelRoutes(socketApi));
app.use("/api/social", apiLimiter, createSocialRoutes(directMessages));
app.use("/api/moderation", apiLimiter, createModerationRoutes(socketApi, notifications));
app.use("/", apiLimiter, createPublicRoutes(socketApi));
app.use("/admin/api", createAdminRoutes(socketApi));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled API error", {
    error: error instanceof Error ? error.message : String(error)
  });
  res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
});

async function start() {
  await ensureOfficialChannels();
  server.listen(config.port, () => {
    logger.info("Backend listening on :" + config.port, {
      env: config.nodeEnv,
      cors: config.corsOrigin
    });
  });
}

void start().catch(async (error) => {
  logger.error("Backend startup failed", { error: String(error) });
  await prisma.$disconnect();
  process.exit(1);
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn(`${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
