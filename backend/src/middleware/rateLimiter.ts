import { Response, NextFunction } from "express";
import { AuthedRequest } from "./auth";
import { RateLimitStore } from "../store/types";
import { getTierConfig, Algorithm, config } from "../config";
import { rateLimitAllowedCounter, rateLimitBlockedCounter } from "../routes/metrics";
import { recordRequest } from "../state/liveStats";

export function rateLimiterMiddleware(store: RateLimitStore) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const clientId = req.clientId || `ip:${req.ip}`;
    const tier = getTierConfig(req.tier || "free");

    // Algorithm can be overridden per-request via header for demo/testing
    // purposes, e.g. to compare both algorithms side by side.
    const algorithm = (req.header("x-rate-algorithm") as Algorithm) ||
      config.defaultAlgorithm;

    const now = Date.now();
    const key = `${clientId}:${req.baseUrl}${req.path}`;

    try {
      const result =
        algorithm === "sliding-window"
          ? await store.consumeSlidingWindow(
              key,
              tier.windowSizeMs,
              tier.maxRequestsPerWindow,
              now
            )
          : await store.consumeTokenBucket(
              key,
              tier.capacity,
              tier.refillRatePerSec,
              now
            );

      res.setHeader("X-RateLimit-Limit", result.limit.toString());
      res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
      res.setHeader("X-RateLimit-Algorithm", algorithm);
      res.setHeader("X-RateLimit-Tier", tier.name);

      if (!result.allowed) {
        rateLimitBlockedCounter.inc({ tier: tier.name, algorithm });
        recordRequest({
          clientId,
          tier: tier.name,
          algorithm,
          remaining: result.remaining,
          limit: result.limit,
          lastResult: "blocked",
        });
        res.setHeader("Retry-After", Math.ceil(result.retryAfterMs / 1000).toString());
        return res.status(429).json({
          error: "rate_limit_exceeded",
          retryAfterMs: result.retryAfterMs,
          tier: tier.name,
          algorithm,
        });
      }

      rateLimitAllowedCounter.inc({ tier: tier.name, algorithm });
      recordRequest({
        clientId,
        tier: tier.name,
        algorithm,
        remaining: result.remaining,
        limit: result.limit,
        lastResult: "allowed",
      });
      next();
    } catch (err) {
      // Fail-open: if the rate limit store is unavailable, we let the
      // request through rather than taking the whole API down. This is a
      // deliberate tradeoff — log it loudly so it's visible in metrics/alerts.
      // eslint-disable-next-line no-console
      console.error("[rate-limiter] store error, failing open:", err);
      next();
    }
  };
}
