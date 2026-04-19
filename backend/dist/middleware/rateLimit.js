"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiLimiter = exports.reportLimiter = exports.loginLimiter = void 0;
exports.createRateLimiter = createRateLimiter;
const TokenBucketLimiter_1 = require("../utils/TokenBucketLimiter");
const ip_1 = require("../utils/ip");
// Konfiguracja różnych limitów
const loginLimiterInstance = new TokenBucketLimiter_1.TokenBucketLimiter(0.2, 5); // Logowanie admina: 1 zap. / 5 sek, burst 5
const reportLimiterInstance = new TokenBucketLimiter_1.TokenBucketLimiter(0.5, 3); // Zgłoszenia: 1 zap. / 2 sek, burst 3
const apiLimiterInstance = new TokenBucketLimiter_1.TokenBucketLimiter(5, 20); // Ogólne API: 5 zap. / sek, burst 20
// Automatyczne czyszczenie starych IP z pamięci co 10 minut
setInterval(() => {
    loginLimiterInstance.cleanup();
    reportLimiterInstance.cleanup();
    apiLimiterInstance.cleanup();
}, 10 * 60 * 1000);
function createRateLimiter(limiter) {
    return (req, res, next) => {
        const ip = (0, ip_1.getClientIp)(req);
        if (!limiter.allow(ip)) {
            return res.status(429).json({ ok: false, error: "Zbyt wiele zapytań (Rate Limit)" });
        }
        next();
    };
}
exports.loginLimiter = createRateLimiter(loginLimiterInstance);
exports.reportLimiter = createRateLimiter(reportLimiterInstance);
exports.apiLimiter = createRateLimiter(apiLimiterInstance);
