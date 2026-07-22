import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config";

function acceptedRequestId(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9._:-]{8,100}$/.test(trimmed) ? trimmed : null;
}

export function apiSecurity(req: Request, res: Response, next: NextFunction) {
  const requestId = acceptedRequestId(req.get("x-request-id")) || randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  if (config.nodeEnv === "production") {
    res.setHeader("Strict-Transport-Security", `max-age=${Math.max(0, config.hstsMaxAgeSeconds)}; includeSubDomains`);
  }
  if (req.path.startsWith("/api/") || req.path.startsWith("/admin/api/")) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
  }
  next();
}
