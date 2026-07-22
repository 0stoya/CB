import { Router } from "express";
import { reportLimiter } from "../middleware/rateLimit";
import { contactService } from "../services/contact";
import { getClientIp } from "../utils/ip";

export function createPublicRoutes(socketApi: any) {
  const router = Router();

  router.get("/health", (_req, res) => res.json({ ok: true }));

  router.get("/metrics", (_req, res) => {
    const stats = socketApi.getStats();
    res.json({ ok: true, online: stats.online, now: stats.now });
  });

  router.post("/report", reportLimiter, (req, res) => {
    const { socketId, type } = req.body ?? {};

    if (typeof socketId !== "string") return res.status(400).json({ ok: false, error: "socketId required" });
    if (type !== "bot" && type !== "abuse") return res.status(400).json({ ok: false, error: "type must be bot|abuse" });

    const partnerSocketId = socketApi.getPartnerSocketId(socketId);
    if (!partnerSocketId) return res.status(400).json({ ok: false, error: "no partner to report" });

    const targetIp = socketApi.getIpBySocketId(partnerSocketId);
    if (!targetIp) return res.status(400).json({ ok: false, error: "target not found" });

    if (!socketApi.isWhitelistedIp(targetIp)) {
      const { shouldBan } = socketApi.reportIp(targetIp, type);
      if (shouldBan) socketApi.banIpAuto(targetIp, type);
    }

    return res.json({ ok: true });
  });

  router.post("/api/contact", reportLimiter, (req, res) => {
    const { email, subject, message, category } = req.body ?? {};

    if (!subject || !message) {
      return res.status(400).json({ ok: false, error: "Brak wymaganych pól" });
    }

    const validCategory = ["sugestia", "blad", "szukam"].includes(category) ? category : "inne";
    const ip = getClientIp(req);
    contactService.addMessage({
      ip,
      category: validCategory,
      email: (email || "").trim().slice(0, 100),
      subject: subject.trim().slice(0, 150),
      message: message.trim().slice(0, 2000)
    });

    return res.json({ ok: true });
  });

  return router;
}
