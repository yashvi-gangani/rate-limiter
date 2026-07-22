import { isMongoConnected } from "../db/mongo";
import { TierModel } from "../db/models/Tier";

export interface TierConfig {
  name: string;
  capacity: number;
  refillRatePerSec: number;
  windowSizeMs: number;
  maxRequestsPerWindow: number;
}

// Seed/default tiers. Used to (a) pre-populate Mongo on first boot if the
// tiers collection is empty, and (b) serve as the in-memory fallback when
// Mongo isn't configured at all.
const DEFAULT_TIERS: Record<string, TierConfig> = {
  free: { name: "free", capacity: 10, refillRatePerSec: 1, windowSizeMs: 60_000, maxRequestsPerWindow: 30 },
  pro: { name: "pro", capacity: 50, refillRatePerSec: 10, windowSizeMs: 60_000, maxRequestsPerWindow: 300 },
  enterprise: { name: "enterprise", capacity: 500, refillRatePerSec: 100, windowSizeMs: 60_000, maxRequestsPerWindow: 5000 },
};

/**
 * In-process cache of tier configs. The rate-limiter middleware runs on
 * every single request, so it reads from this synchronous cache rather
 * than hitting Mongo per-request. The cache is refreshed on writes (so
 * admin changes apply immediately on this instance) and on a short
 * interval (so changes made via a different gateway instance / admin
 * client eventually propagate here too).
 */
let cache: Record<string, TierConfig> = { ...DEFAULT_TIERS };

async function refreshCacheFromMongo(): Promise<void> {
  const docs = await TierModel.find().lean();
  if (docs.length === 0) {
    // first boot — seed Mongo with the defaults
    await TierModel.insertMany(Object.values(DEFAULT_TIERS));
    cache = { ...DEFAULT_TIERS };
    return;
  }
  const next: Record<string, TierConfig> = {};
  for (const d of docs) {
    next[d.name] = {
      name: d.name,
      capacity: d.capacity,
      refillRatePerSec: d.refillRatePerSec,
      windowSizeMs: d.windowSizeMs,
      maxRequestsPerWindow: d.maxRequestsPerWindow,
    };
  }
  cache = next;
}

export async function initTierCache(): Promise<void> {
  if (!isMongoConnected()) {
    cache = { ...DEFAULT_TIERS };
    return;
  }
  await refreshCacheFromMongo();
  // periodic background refresh so changes from other instances propagate
  setInterval(() => {
    refreshCacheFromMongo().catch((err) =>
      // eslint-disable-next-line no-console
      console.error("[tierService] background refresh failed:", err)
    );
  }, 5000).unref();
}

/** Synchronous, hot-path lookup used by the rate limiter on every request. */
export function getTierConfig(name: string): TierConfig {
  return cache[name] || cache.free || DEFAULT_TIERS.free;
}

export function listTiersFromCache(): TierConfig[] {
  return Object.values(cache);
}

export async function upsertTier(tier: TierConfig): Promise<TierConfig> {
  if (isMongoConnected()) {
    await TierModel.findOneAndUpdate(
      { name: tier.name },
      { $set: { ...tier, updatedAt: new Date() } },
      { upsert: true }
    );
  }
  cache[tier.name] = tier;
  return tier;
}

export async function deleteTier(name: string): Promise<boolean> {
  if (name === "free") {
    // guardrail: never delete the fallback tier everything defaults to
    throw new Error("cannot_delete_free_tier");
  }
  if (isMongoConnected()) {
    await TierModel.deleteOne({ name });
  }
  const existed = name in cache;
  delete cache[name];
  return existed;
}
