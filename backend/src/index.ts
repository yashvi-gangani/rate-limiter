import express from "express";
import cors from "cors";
import morgan from "morgan";
import { createProxyMiddleware } from "http-proxy-middleware";

import { config } from "./config";
import { authMiddleware } from "./middleware/auth";
import { rateLimiterMiddleware } from "./middleware/rateLimiter";
import { latencyMiddleware } from "./middleware/logger";
import { RedisStore } from "./store/redisStore";
import { MemoryStore } from "./store/memoryStore";
import { RateLimitStore } from "./store/types";
import { demoRouter } from "./routes/demo";
import { metricsRouter } from "./routes/metrics";
import { adminRouter } from "./routes/admin";
import { connectMongo } from "./db/mongo";
import { initTierCache } from "./services/tierService";

async function main() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
  app.use(latencyMiddleware);

  // --- Mongo (API keys + dynamic tiers) ---------------------------------
  // Falls back to in-memory demo keys/tiers if MONGO_URL isn't set — same
  // graceful-degradation pattern as the Redis store below.
  const mongoConnected = await connectMongo(config.mongoUrl);
  if (!mongoConnected) {
    console.log(
      "[gateway] MONGO_URL not set/unreachable — using in-memory API keys + tiers",
    );
  }
  await initTierCache();

  // --- Store selection ----------------------------------------------------
  // Uses Redis if REDIS_URL is set (required for correctness across multiple
  // gateway instances). Falls back to in-memory for local single-instance dev.
  let store: RateLimitStore;
  if (config.redisUrl) {
    store = new RedisStore(config.redisUrl);
    console.log(`[gateway] using RedisStore at ${config.redisUrl}`);
  } else {
    store = new MemoryStore();
    console.log(
      "[gateway] REDIS_URL not set — using in-memory store (single instance only)",
    );
  }

  // --- Public, unlimited routes --------------------------------------------

  // Home route
  app.get("/", (_req, res) => {
    res.json({
      project: "API Gateway with Configurable Rate Limiting",
      status: "Running",
      version: "1.0.0",
      endpoints: {
        health: "/health",
        stats: "/admin/stats",
        metrics: "/metrics",
        ping: "/api/demo/ping",
        heavy: "/api/demo/heavy",
        whoami: "/api/demo/whoami",
      },
    });
  });

  // Health check
  app.get("/health", (_req, res) =>
    res.json({
      status: "ok",
      uptime: process.uptime(),
    }),
  );

  app.use("/", metricsRouter);

  // Dashboard stats + admin CRUD (stats is public-read, CRUD needs x-admin-key)
  app.use("/admin", adminRouter);

  // --- Gated routes: auth -> rate limit -> handler/proxy -------------------
  app.use("/api", authMiddleware, rateLimiterMiddleware(store));

  // Built-in demo endpoints (self-contained, no external upstream needed)
  app.use("/api/demo", demoRouter);

  // Generic proxy: forwards anything under /api/proxy to your real upstream
  // service (config.upstreamUrl), after auth + rate limiting have run.
  app.use(
    "/api/proxy",
    createProxyMiddleware({
      target: config.upstreamUrl,
      changeOrigin: true,
      pathRewrite: { "^/api/proxy": "" },
    }),
  );

  app.listen(config.port, () => {
    console.log(
      `[gateway] listening on port ${config.port} (${config.nodeEnv})`,
    );
    console.log(
      `[gateway] demo endpoints:   http://localhost:${config.port}/api/demo/ping`,
    );
    console.log(
      `[gateway] metrics:          http://localhost:${config.port}/metrics`,
    );
    console.log(
      `[gateway] dashboard stats:  http://localhost:${config.port}/admin/stats`,
    );
  });
}

main().catch((err) => {
  console.error("[gateway] fatal startup error:", err);
  process.exit(1);
});
