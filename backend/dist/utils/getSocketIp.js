"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocketIp = getSocketIp;
function getSocketIp(socket) {
    const xReal = socket.handshake.headers["x-real-ip"];
    if (typeof xReal === "string" && xReal.trim())
        return xReal.trim();
    const xff = socket.handshake.headers["x-forwarded-for"];
    if (typeof xff === "string" && xff.trim()) {
        return xff.split(",")[0].trim();
    }
    // socket.handshake.address is often the proxy (127.0.0.1) unless you use headers.
    const addr = socket.handshake.address;
    return typeof addr === "string" ? addr : "unknown";
}
