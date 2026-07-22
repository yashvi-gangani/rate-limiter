export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  limit: number;
}

/**
 * A Store implements the actual state mutation for each algorithm.
 * Both operations MUST be atomic (single round trip / no read-modify-write
 * race) since multiple gateway instances or concurrent requests from the
 * same client can hit these simultaneously.
 */
export interface RateLimitStore {
  /**
   * Token bucket: bucket refills continuously at `refillRatePerSec`,
   * holds at most `capacity` tokens. Each request costs 1 token.
   */
  consumeTokenBucket(
    key: string,
    capacity: number,
    refillRatePerSec: number,
    now: number
  ): Promise<RateLimitResult>;

  /**
   * Sliding window counter: counts requests in the trailing `windowMs`
   * window using a weighted average of the current and previous fixed
   * windows (approximation of a true sliding log, O(1) memory).
   */
  consumeSlidingWindow(
    key: string,
    windowMs: number,
    maxRequests: number,
    now: number
  ): Promise<RateLimitResult>;
}
