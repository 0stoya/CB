"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenBucketLimiter = void 0;
class TokenBucketLimiter {
    perSecond;
    burst;
    byKey = new Map();
    constructor(perSecond, burst) {
        this.perSecond = perSecond;
        this.burst = burst;
    }
    allow(key, now = Date.now()) {
        const bucket = this.byKey.get(key) ?? {
            tokens: this.burst,
            lastRefillMs: now
        };
        const elapsed = Math.max(0, now - bucket.lastRefillMs);
        const refill = (elapsed / 1000) * this.perSecond;
        bucket.tokens = Math.min(this.burst, bucket.tokens + refill);
        bucket.lastRefillMs = now;
        if (bucket.tokens < 1) {
            this.byKey.set(key, bucket);
            return false;
        }
        bucket.tokens -= 1;
        this.byKey.set(key, bucket);
        return true;
    }
    cleanup(maxAgeMs = 10 * 60 * 1000) {
        const now = Date.now();
        for (const [k, b] of this.byKey.entries()) {
            if (now - b.lastRefillMs > maxAgeMs)
                this.byKey.delete(k);
        }
    }
}
exports.TokenBucketLimiter = TokenBucketLimiter;
