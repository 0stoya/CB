import type { Request } from "express";

function normalizeIp(ip: string): string {
  const s = (ip || "").trim();
  if (!s) return "";
  if (s.startsWith("::ffff:")) return s.slice(7);
  return s;
}

export function getClientIp(req: Request): string {
  // Prefer nginx-provided headers
  const xReal = req.headers["x-real-ip"];
  if (typeof xReal === "string" && xReal.trim()) {
    return normalizeIp(xReal);
  }

  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return normalizeIp(xff.split(",")[0]!.trim());
  }

  // With app.set("trust proxy", 1), req.ip should be the real client IP.
  // In Express typings, req.ip is string, but we normalize defensively anyway.
  return normalizeIp(req.ip || "");
}