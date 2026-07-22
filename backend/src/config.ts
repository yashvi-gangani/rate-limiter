import dotenv from "dotenv";
dotenv.config();

export type Algorithm = "token-bucket" | "sliding-window";

export const config = {
  port: parseInt(process.env.PORT || "8080", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  redisUrl: process.env.REDIS_URL || "",
  mongoUrl: process.env.MONGO_URL || "",
  adminKey: process.env.ADMIN_KEY || "demo-admin-key",
  upstreamUrl: process.env.UPSTREAM_URL || "http://localhost:4000",
  defaultAlgorithm: (process.env.DEFAULT_ALGORITHM as Algorithm) || "token-bucket",
};

// Tier lookups now live in services/tierService.ts, backed by Mongo with an
// in-memory fallback/cache. Re-exported here so existing imports of
// `getTierConfig`/`TierConfig` from "../config" keep working unchanged.
export { getTierConfig, TierConfig } from "./services/tierService";
