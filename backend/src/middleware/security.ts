import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { recordRequestMetric } from "../services/requestMetrics";

const noStorePaths = new Set(["/health", "/healthz", "/readyz", "/metrics", "/report"]);

function acceptedRequestId(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9._:-]{8,100}$/.test(trimmed) ? trimmed : null;
}

export function apiSecurity(req: Request, res: Response, next: NextFunction) {
  const startedAt = process.hrtime.bigint();
  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    recordRequestMetric(res.statusCode, durationMs);
  });

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
  if (req.path.startsWith("/api/") || req.path.startsWith("/admin/api/") || noStorePaths.has(req.path)) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
  }
  next();
}
