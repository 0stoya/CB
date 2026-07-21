import express from "express";
import http from "http";
import cors from "cors";
import session from "express-session";
import { Server } from "socket.io";
import { config } from "./config";
import { prisma } from "./db";
import { logger } from "./utils/logger";
import { registerSocketHandlers } from "./socket";
import { createPublicRoutes } from "./routes/publicRoutes";
import { createAdminRoutes } from "./routes/adminRoutes";
import { createAuthRoutes } from "./routes/authRoutes";
import { apiLimiter } from "./middleware/rateLimit";

const app = express();

app.set("trust proxy", 1);
app.use(express.json({ limit: "200kb" }));

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true
  })
);

if (!config.sessionSecret) {
  throw new Error("SESSION_SECRET is required");
}

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

const socketApi = registerSocketHandlers(io);

app.use("/api/auth", apiLimiter, createAuthRoutes());
app.use("/", apiLimiter, createPublicRoutes(socketApi));
app.use("/admin/api", createAdminRoutes(socketApi));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error("Unhandled API error", {
    error: error instanceof Error ? error.message : String(error)
  });
  res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
});

server.listen(config.port, () => {
  logger.info("Backend listening on :" + config.port, {
    env: config.nodeEnv,
    cors: config.corsOrigin
  });
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
