const counters = new Map<string, { count: number; resetAt: number }>();

const CLEANUP_INTERVAL = 5 * 60_000;
let lastCleanup = Date.now();

function maybeCleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of counters) {
    if (now > entry.resetAt) counters.delete(key);
  }
}

/**
 * Simple in-memory per-key rate limiter.
 * Returns true if the request is allowed, false if rate-limited.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number = 60_000,
): boolean {
  const now = Date.now();
  maybeCleanup(now);

  const entry = counters.get(key);

  if (!entry || now > entry.resetAt) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}
