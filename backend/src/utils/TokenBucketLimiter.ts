export type Bucket = {
  tokens: number;
  lastRefillMs: number;
};

export class TokenBucketLimiter {
  private byKey = new Map<string, Bucket>();

  constructor(
    private readonly perSecond: number,
    private readonly burst: number
  ) {}

  allow(key: string, now = Date.now()): boolean {
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
      if (now - b.lastRefillMs > maxAgeMs) this.byKey.delete(k);
    }
  }
}