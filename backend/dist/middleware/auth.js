"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminIp = requireAdminIp;
exports.requireAdminSession = requireAdminSession;
const config_1 = require("../config");
const ip_1 = require("../utils/ip");
function requireAdminIp(req, res, next) {
    // Blokada hosta (Tylko po wejściu przez domenę admina)
    const host = (req.hostname || "").toLowerCase();
    if (host !== "admin.chati.online") {
        return res.status(403).json({ ok: false, error: "forbidden" });
    }
    const ip = (0, ip_1.getClientIp)(req);
    if (!config_1.config.adminIpWhitelist || config_1.config.adminIpWhitelist.length === 0) {
        return res.status(500).json({ ok: false, error: "ADMIN_IP_WHITELIST not set" });
    }
    if (!config_1.config.adminIpWhitelist.includes(ip)) {
        return res.status(403).json({ ok: false, error: "forbidden" });
    }
    next();
}
function requireAdminSession(req, res, next) {
    const sess = req.session;
    if (sess?.isAdmin === true)
        return next();
    return res.status(401).json({ ok: false, error: "unauthorized" });
}
