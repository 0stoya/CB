import { Request, Response, NextFunction } from "express";
import { TokenBucketLimiter } from "../utils/TokenBucketLimiter";
import { getClientIp } from "../utils/ip";

const loginLimiterInstance = new TokenBucketLimiter(0.2, 5);
const accountActionLimiterInstance = new TokenBucketLimiter(0.05, 3);
const reportLimiterInstance = new TokenBucketLimiter(0.5, 3);
const apiLimiterInstance = new TokenBucketLimiter(5, 20);

setInterval(() => {
  loginLimiterInstance.cleanup();
  accountActionLimiterInstance.cleanup();
  reportLimiterInstance.cleanup();
  apiLimiterInstance.cleanup();
}, 10 * 60 * 1000).unref();

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
export const accountActionLimiter = createRateLimiter(accountActionLimiterInstance);
export const reportLimiter = createRateLimiter(reportLimiterInstance);
export const apiLimiter = createRateLimiter(apiLimiterInstance);
