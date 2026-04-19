import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { getClientIp } from "../utils/ip";

export function requireAdminIp(req: Request, res: Response, next: NextFunction) {
  // Blokada hosta (Tylko po wejściu przez domenę admina)
  const host = (req.hostname || "").toLowerCase();
  if (host !== "admin.chati.online") {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const ip = getClientIp(req);

  if (!config.adminIpWhitelist || config.adminIpWhitelist.length === 0) {
    return res.status(500).json({ ok: false, error: "ADMIN_IP_WHITELIST not set" });
  }

  if (!config.adminIpWhitelist.includes(ip)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  next();
}

export function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  const sess = (req as any).session;
  if (sess?.isAdmin === true) return next();
  return res.status(401).json({ ok: false, error: "unauthorized" });
}