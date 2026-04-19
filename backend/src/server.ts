import express from "express";
import http from "http";
import cors from "cors";
import session from "express-session";
import { Server } from "socket.io";
import { config } from "./config";
import { logger } from "./utils/logger";
import { registerSocketHandlers } from "./socket";
import { createPublicRoutes } from "./routes/publicRoutes";
import { createAdminRoutes } from "./routes/adminRoutes";
import { apiLimiter } from "./middleware/rateLimit";

const app = express();

// Konfiguracja pod Nginx (zabezpieczenia req.ip)
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

// Konfiguracja Sesji (Dla Panelu Admina)
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
      maxAge: 1000 * 60 * 60 * 12 // 12 hours
    }
  })
);

// Inicjalizacja Serwera HTTP i WebSocket
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.corsOrigin, credentials: true },
  transports: ["websocket", "polling"],
  pingInterval: 5000,  
  pingTimeout: 8000    
});

const socketApi = registerSocketHandlers(io);

// ZAPINANIE ROUTERÓW I RATE LIMITINGU
app.use("/", apiLimiter, createPublicRoutes(socketApi));
app.use("/admin/api", createAdminRoutes(socketApi));

server.listen(config.port, () => {
  logger.info("Backend listening on :" + config.port, {
    env: config.nodeEnv,
    cors: config.corsOrigin
  });
});

process.on("SIGTERM", () => {
  logger.warn("SIGTERM received, shutting down...");
  server.close(() => process.exit(0));
});