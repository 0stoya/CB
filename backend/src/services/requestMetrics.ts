type RecentRequest = {
  at: number;
  durationMs: number;
  statusCode: number;
};

const RECENT_WINDOW_MS = 5 * 60 * 1000;
const MAX_RECENT_REQUESTS = 50_000;
const recent: RecentRequest[] = [];
let total = 0;
let clientErrors = 0;
let serverErrors = 0;
let latencyTotalMs = 0;
let latencyMaxMs = 0;

function prune(now = Date.now()) {
  const cutoff = now - RECENT_WINDOW_MS;
  while (recent.length && recent[0]!.at < cutoff) recent.shift();
  if (recent.length > MAX_RECENT_REQUESTS) {
    recent.splice(0, recent.length - MAX_RECENT_REQUESTS);
  }
}

export function recordRequestMetric(statusCode: number, durationMs: number) {
  const safeDuration = Math.max(0, Math.min(120_000, durationMs));
  total += 1;
  latencyTotalMs += safeDuration;
  latencyMaxMs = Math.max(latencyMaxMs, safeDuration);
  if (statusCode >= 500) serverErrors += 1;
  else if (statusCode >= 400) clientErrors += 1;
  recent.push({ at: Date.now(), durationMs: safeDuration, statusCode });
  prune();
}

export function getRequestMetrics() {
  prune();
  const recentLatency = recent.reduce((sum, item) => sum + item.durationMs, 0);
  return {
    lifetime: {
      total,
      clientErrors,
      serverErrors,
      averageLatencyMs: total ? Math.round((latencyTotalMs / total) * 10) / 10 : 0,
      maxLatencyMs: Math.round(latencyMaxMs * 10) / 10
    },
    last5Minutes: {
      total: recent.length,
      clientErrors: recent.filter((item) => item.statusCode >= 400 && item.statusCode < 500).length,
      serverErrors: recent.filter((item) => item.statusCode >= 500).length,
      averageLatencyMs: recent.length ? Math.round((recentLatency / recent.length) * 10) / 10 : 0,
      maxLatencyMs: recent.length ? Math.round(Math.max(...recent.map((item) => item.durationMs)) * 10) / 10 : 0
    }
  };
}
