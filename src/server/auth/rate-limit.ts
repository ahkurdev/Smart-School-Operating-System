/**
 * Rate limiting. In-memory fixed-window counter, adequate for a single dev/staging
 * node. The interface is deliberately small so a Redis-backed limiter can be
 * swapped in for multi-instance production without touching call sites.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export type RateLimitOptions = {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests per window. */
  max: number;
};

export function rateLimit(
  key: string,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.max - 1, resetAt };
  }

  existing.count += 1;
  const allowed = existing.count <= options.max;
  return {
    allowed,
    remaining: Math.max(0, options.max - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Periodically drop expired buckets so the map does not grow unbounded. */
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, 60_000);
  // Do not keep the event loop alive for cleanup only.
  if (typeof timer.unref === "function") timer.unref();
}

/** Test helper: clear all buckets. */
export function __resetRateLimits(): void {
  buckets.clear();
}
