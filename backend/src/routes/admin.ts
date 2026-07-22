import { Router } from "express";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { getStats } from "../state/liveStats";
import { config } from "../config";
import {
  listTiersFromCache,
  upsertTier,
  deleteTier,
  TierConfig,
} from "../services/tierService";
import {
  listApiKeys,
  createApiKey,
  deleteApiKey,
} from "../services/apiKeyService";

export const adminRouter = Router();

/**
 * Public, read-only stats for the dashboard. Deliberately NOT behind
 * admin auth — it only exposes counts and tier names, nothing sensitive
 * (no API keys, no secrets), so the dashboard can poll it directly.
 */
adminRouter.get("/stats", (_req, res) => {
  res.json({
    ...getStats(),
    defaultAlgorithm: config.defaultAlgorithm,
    tiers: listTiersFromCache(),
  });
});

// --- Everything below requires the admin key -----------------------------
adminRouter.use(adminAuthMiddleware);

// Tier management
adminRouter.get("/tiers", (_req, res) => {
  res.json(listTiersFromCache());
});

adminRouter.post("/tiers", async (req, res) => {
  const body = req.body as Partial<TierConfig>;
  if (
    !body.name ||
    body.capacity == null ||
    body.refillRatePerSec == null ||
    body.windowSizeMs == null ||
    body.maxRequestsPerWindow == null
  ) {
    return res.status(400).json({
      error: "missing_fields",
      required: ["name", "capacity", "refillRatePerSec", "windowSizeMs", "maxRequestsPerWindow"],
    });
  }
  const saved = await upsertTier(body as TierConfig);
  res.status(201).json(saved);
});

adminRouter.put("/tiers/:name", async (req, res) => {
  const existing = listTiersFromCache().find((t) => t.name === req.params.name);
  if (!existing) return res.status(404).json({ error: "tier_not_found" });

  const updated: TierConfig = { ...existing, ...req.body, name: req.params.name };
  const saved = await upsertTier(updated);
  res.json(saved);
});

adminRouter.delete("/tiers/:name", async (req, res) => {
  try {
    const deleted = await deleteTier(req.params.name);
    if (!deleted) return res.status(404).json({ error: "tier_not_found" });
    res.json({ deleted: true });
  } catch (err: any) {
    if (err.message === "cannot_delete_free_tier") {
      return res.status(400).json({ error: "cannot_delete_free_tier" });
    }
    throw err;
  }
});

// API key management
adminRouter.get("/api-keys", async (_req, res) => {
  const keys = await listApiKeys();
  res.json(keys);
});

adminRouter.post("/api-keys", async (req, res) => {
  const { key, clientId, tier } = req.body || {};
  if (!key || !clientId || !tier) {
    return res.status(400).json({ error: "missing_fields", required: ["key", "clientId", "tier"] });
  }
  const saved = await createApiKey({ key, clientId, tier });
  res.status(201).json(saved);
});

adminRouter.delete("/api-keys/:key", async (req, res) => {
  const deleted = await deleteApiKey(req.params.key);
  if (!deleted) return res.status(404).json({ error: "key_not_found" });
  res.json({ deleted: true });
});
