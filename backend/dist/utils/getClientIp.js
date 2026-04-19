"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientIp = getClientIp;
function normalizeIp(ip) {
    const s = (ip || "").trim();
    if (!s)
        return "";
    if (s.startsWith("::ffff:"))
        return s.slice(7);
    return s;
}
function getClientIp(req) {
    // Prefer nginx-provided headers
    const xReal = req.headers["x-real-ip"];
    if (typeof xReal === "string" && xReal.trim()) {
        return normalizeIp(xReal);
    }
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string" && xff.trim()) {
        return normalizeIp(xff.split(",")[0].trim());
    }
    // With app.set("trust proxy", 1), req.ip should be the real client IP.
    // In Express typings, req.ip is string, but we normalize defensively anyway.
    return normalizeIp(req.ip || "");
}
