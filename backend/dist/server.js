"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const express_session_1 = __importDefault(require("express-session"));
const socket_io_1 = require("socket.io");
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
const socket_1 = require("./socket");
const publicRoutes_1 = require("./routes/publicRoutes");
const adminRoutes_1 = require("./routes/adminRoutes");
const rateLimit_1 = require("./middleware/rateLimit");
const app = (0, express_1.default)();
// Konfiguracja pod Nginx (zabezpieczenia req.ip)
app.set("trust proxy", 1);
app.use(express_1.default.json({ limit: "200kb" }));
app.use((0, cors_1.default)({
    origin: config_1.config.corsOrigin,
    credentials: true
}));
if (!config_1.config.sessionSecret) {
    throw new Error("SESSION_SECRET is required");
}
// Konfiguracja Sesji (Dla Panelu Admina)
app.use((0, express_session_1.default)({
    name: "chati_admin",
    secret: config_1.config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: config_1.config.nodeEnv === "production",
        maxAge: 1000 * 60 * 60 * 12 // 12 hours
    }
}));
// Inicjalizacja Serwera HTTP i WebSocket
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: { origin: config_1.config.corsOrigin, credentials: true },
    transports: ["websocket", "polling"],
    pingInterval: 5000,
    pingTimeout: 8000
});
const socketApi = (0, socket_1.registerSocketHandlers)(io);
// ZAPINANIE ROUTERÓW I RATE LIMITINGU
app.use("/", rateLimit_1.apiLimiter, (0, publicRoutes_1.createPublicRoutes)(socketApi));
app.use("/admin/api", (0, adminRoutes_1.createAdminRoutes)(socketApi));
server.listen(config_1.config.port, () => {
    logger_1.logger.info("Backend listening on :" + config_1.config.port, {
        env: config_1.config.nodeEnv,
        cors: config_1.config.corsOrigin
    });
});
process.on("SIGTERM", () => {
    logger_1.logger.warn("SIGTERM received, shutting down...");
    server.close(() => process.exit(0));
});
