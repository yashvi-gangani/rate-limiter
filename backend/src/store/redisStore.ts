import Redis from "ioredis";
import { RateLimitResult, RateLimitStore } from "./types";

/**
 * TOKEN BUCKET (Lua)
 * KEYS[1] = bucket key
 * ARGV[1] = capacity
 * ARGV[2] = refillRatePerSec
 * ARGV[3] = now (ms)
 *
 * We store [tokens, lastRefillTimestamp] as a Redis hash.
 * On each call we compute how many tokens should have been added since
 * the last refill, cap at capacity, then try to consume 1.
 */
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call("HMGET", key, "tokens", "ts")
local tokens = tonumber(bucket[1])
local ts = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  ts = now
end

local elapsedSec = math.max(0, (now - ts) / 1000)
local refill = elapsedSec * refillRate
tokens = math.min(capacity, tokens + refill)

local allowed = 0
local retryAfterMs = 0

if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  local deficit = 1 - tokens
  retryAfterMs = math.ceil((deficit / refillRate) * 1000)
end

redis.call("HMSET", key, "tokens", tokens, "ts", now)
redis.call("PEXPIRE", key, math.ceil((capacity / refillRate) * 1000) + 5000)

return {allowed, tostring(tokens), retryAfterMs, capacity}
`;

/**
 * SLIDING WINDOW COUNTER (Lua)
 * Approximates a sliding log using two fixed windows weighted by how far
 * we are into the current window. O(1) storage per key instead of storing
 * every timestamp (which a true sliding log requires).
 *
 * KEYS[1] = base key
 * ARGV[1] = windowMs
 * ARGV[2] = maxRequests
 * ARGV[3] = now (ms)
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local windowMs = tonumber(ARGV[1])
local maxRequests = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local currentWindowId = math.floor(now / windowMs)
local prevWindowId = currentWindowId - 1

local currKey = key .. ":" .. currentWindowId
local prevKey = key .. ":" .. prevWindowId

local currCount = tonumber(redis.call("GET", currKey)) or 0
local prevCount = tonumber(redis.call("GET", prevKey)) or 0

local elapsedInCurrent = now % windowMs
local weightPrev = (windowMs - elapsedInCurrent) / windowMs

local estimatedCount = (prevCount * weightPrev) + currCount

local allowed = 0
local retryAfterMs = 0

if estimatedCount < maxRequests then
  redis.call("INCR", currKey)
  redis.call("PEXPIRE", currKey, windowMs * 2)
  allowed = 1
  currCount = currCount + 1
  estimatedCount = estimatedCount + 1
else
  retryAfterMs = windowMs - elapsedInCurrent
end

local remaining = math.max(0, maxRequests - math.ceil(estimatedCount))

return {allowed, remaining, retryAfterMs, maxRequests}
`;

export class RedisStore implements RateLimitStore {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    this.client.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error("[redis] connection error:", err.message);
    });
  }

  async consumeTokenBucket(
    key: string,
    capacity: number,
    refillRatePerSec: number,
    now: number
  ): Promise<RateLimitResult> {
    const raw = (await this.client.eval(
      TOKEN_BUCKET_SCRIPT,
      1,
      `tb:${key}`,
      capacity,
      refillRatePerSec,
      now
    )) as [number, string, number, number];

    const [allowed, tokensLeft, retryAfterMs, limit] = raw;
    return {
      allowed: allowed === 1,
      remaining: Math.floor(parseFloat(tokensLeft)),
      retryAfterMs,
      limit,
    };
  }

  async consumeSlidingWindow(
    key: string,
    windowMs: number,
    maxRequests: number,
    now: number
  ): Promise<RateLimitResult> {
    const raw = (await this.client.eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      `sw:${key}`,
      windowMs,
      maxRequests,
      now
    )) as [number, number, number, number];

    const [allowed, remaining, retryAfterMs, limit] = raw;
    return {
      allowed: allowed === 1,
      remaining,
      retryAfterMs,
      limit,
    };
  }

  async disconnect() {
    await this.client.quit();
  }
}
