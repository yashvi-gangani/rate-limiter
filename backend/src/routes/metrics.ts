import { Router } from "express";
import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: "gateway_http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "status_code"],
  buckets: [5, 10, 25, 50, 100, 200, 400, 800, 1500, 3000],
});

export const rateLimitAllowedCounter = new client.Counter({
  name: "gateway_rate_limit_allowed_total",
  help: "Total requests allowed by the rate limiter",
  labelNames: ["tier", "algorithm"],
});

export const rateLimitBlockedCounter = new client.Counter({
  name: "gateway_rate_limit_blocked_total",
  help: "Total requests blocked (429) by the rate limiter",
  labelNames: ["tier", "algorithm"],
});

register.registerMetric(httpRequestDuration);
register.registerMetric(rateLimitAllowedCounter);
register.registerMetric(rateLimitBlockedCounter);

export const metricsRouter = Router();

metricsRouter.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", register.contentType);
  res.send(await register.metrics());
});
