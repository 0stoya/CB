"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeIp = normalizeIp;
exports.getClientIp = getClientIp;
function normalizeIp(ip) {
    const s = (ip || "").trim();
    if (!s)
        return "";
    // Konwersja IPv6-mapped IPv4: ::ffff:1.2.3.4 -> 1.2.3.4
    if (s.startsWith("::ffff:"))
        return s.slice(7);
    return s;
}
function getClientIp(req) {
    // Preferowane nagłówki od Nginx
    const xReal = req.header("x-real-ip");
    if (xReal && xReal.trim())
        return normalizeIp(xReal.trim());
    const xff = req.header("x-forwarded-for");
    if (xff && xff.trim())
        return normalizeIp(xff.split(",")[0].trim());
    // Z fallbackiem do standardowego req.ip
    return normalizeIp(req.ip ?? "");
}
