import { Router } from "express";
import { config } from "../config";
import { readiness } from "../services/operations";

export function createHealthRoutes() {
  const router = Router();

  router.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      service: "chati-backend",
      version: config.appVersion,
      buildSha: config.buildSha,
      uptimeSeconds: Math.floor(process.uptime()),
      now: new Date().toISOString()
    });
  });

  router.get("/readyz", async (_req, res) => {
    try {
      const database = await readiness();
      res.json({ ok: true, database, now: new Date().toISOString() });
    } catch (error) {
      res.status(503).json({
        ok: false,
        error: error instanceof Error ? error.message : "NOT_READY",
        now: new Date().toISOString()
      });
    }
  });

  return router;
}
