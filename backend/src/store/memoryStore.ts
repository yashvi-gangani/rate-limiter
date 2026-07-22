import { RateLimitResult, RateLimitStore } from "./types";

interface BucketState {
  tokens: number;
  lastRefillTs: number;
}

/**
 * In-memory store. Fine for local dev / a single instance / the load-test
 * demo. NOT suitable for multi-instance production deployments since state
 * isn't shared across processes — that's exactly the problem RedisStore
 * solves. Node is single-threaded per event-loop tick so no explicit lock
 * is needed here.
 */
export class MemoryStore implements RateLimitStore {
  private buckets = new Map<string, BucketState>();
  private windows = new Map<string, Map<number, number>>();

  async consumeTokenBucket(
    key: string,
    capacity: number,
    refillRatePerSec: number,
    now: number
  ): Promise<RateLimitResult> {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: capacity, lastRefillTs: now };
      this.buckets.set(key, bucket);
    }

    const elapsedSec = Math.max(0, (now - bucket.lastRefillTs) / 1000);
    const refill = elapsedSec * refillRatePerSec;
    bucket.tokens = Math.min(capacity, bucket.tokens + refill);
    bucket.lastRefillTs = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        retryAfterMs: 0,
        limit: capacity,
      };
    }

    const deficit = 1 - bucket.tokens;
    const retryAfterMs = Math.ceil((deficit / refillRatePerSec) * 1000);
    return { allowed: false, remaining: 0, retryAfterMs, limit: capacity };
  }

  async consumeSlidingWindow(
    key: string,
    windowMs: number,
    maxRequests: number,
    now: number
  ): Promise<RateLimitResult> {
    const currentWindowId = Math.floor(now / windowMs);
    const prevWindowId = currentWindowId - 1;

    let windowMap = this.windows.get(key);
    if (!windowMap) {
      windowMap = new Map();
      this.windows.set(key, windowMap);
    }

    // garbage collect old windows
    for (const id of windowMap.keys()) {
      if (id < prevWindowId) windowMap.delete(id);
    }

    const currCount = windowMap.get(currentWindowId) || 0;
    const prevCount = windowMap.get(prevWindowId) || 0;

    const elapsedInCurrent = now % windowMs;
    const weightPrev = (windowMs - elapsedInCurrent) / windowMs;
    const estimatedCount = prevCount * weightPrev + currCount;

    if (estimatedCount < maxRequests) {
      windowMap.set(currentWindowId, currCount + 1);
      const remaining = Math.max(
        0,
        maxRequests - Math.ceil(estimatedCount + 1)
      );
      return { allowed: true, remaining, retryAfterMs: 0, limit: maxRequests };
    }

    const retryAfterMs = windowMs - elapsedInCurrent;
    return { allowed: false, remaining: 0, retryAfterMs, limit: maxRequests };
  }
}
