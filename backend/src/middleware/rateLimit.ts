import { Request, Response, NextFunction } from "express";
import { TokenBucketLimiter } from "../utils/TokenBucketLimiter";
import { getClientIp } from "../utils/ip";

// Konfiguracja różnych limitów
const loginLimiterInstance = new TokenBucketLimiter(0.2, 5); // Logowanie admina: 1 zap. / 5 sek, burst 5
const reportLimiterInstance = new TokenBucketLimiter(0.5, 3); // Zgłoszenia: 1 zap. / 2 sek, burst 3
const apiLimiterInstance = new TokenBucketLimiter(5, 20); // Ogólne API: 5 zap. / sek, burst 20

// Automatyczne czyszczenie starych IP z pamięci co 10 minut
setInterval(() => {
  loginLimiterInstance.cleanup();
  reportLimiterInstance.cleanup();
  apiLimiterInstance.cleanup();
}, 10 * 60 * 1000);

export function createRateLimiter(limiter: TokenBucketLimiter) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    if (!limiter.allow(ip)) {
      return res.status(429).json({ ok: false, error: "Zbyt wiele zapytań (Rate Limit)" });
    }
    next();
  };
}

export const loginLimiter = createRateLimiter(loginLimiterInstance);
export const reportLimiter = createRateLimiter(reportLimiterInstance);
export const apiLimiter = createRateLimiter(apiLimiterInstance);