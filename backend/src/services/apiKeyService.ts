import { isMongoConnected } from "../db/mongo";
import { ApiKeyModel } from "../db/models/ApiKey";

export interface ApiKeyRecord {
  key: string;
  clientId: string;
  tier: string;
}

// In-memory fallback — used when MONGO_URL isn't configured, so the
// project still runs standalone for quick local testing/demos.
const memoryKeys = new Map<string, ApiKeyRecord>([
  ["demo-free-key", { key: "demo-free-key", clientId: "client-free", tier: "free" }],
  ["demo-pro-key", { key: "demo-pro-key", clientId: "client-pro", tier: "pro" }],
  ["demo-enterprise-key", { key: "demo-enterprise-key", clientId: "client-enterprise", tier: "enterprise" }],
]);

export async function getApiKey(key: string): Promise<ApiKeyRecord | null> {
  if (isMongoConnected()) {
    const doc = await ApiKeyModel.findOne({ key }).lean();

    // If the key exists in MongoDB, use it.
    if (doc) {
      return {
        key: doc.key,
        clientId: doc.clientId,
        tier: doc.tier,
      };
    }

    // Otherwise, fall back to the built-in demo keys.
    return memoryKeys.get(key) || null;
  }

  // No MongoDB connection → use in-memory keys.
  return memoryKeys.get(key) || null;
}

export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  if (isMongoConnected()) {
    const docs = await ApiKeyModel.find().lean();
    return docs.map((d) => ({ key: d.key, clientId: d.clientId, tier: d.tier }));
  }
  return Array.from(memoryKeys.values());
}

export async function createApiKey(record: ApiKeyRecord): Promise<ApiKeyRecord> {
  if (isMongoConnected()) {
    const doc = await ApiKeyModel.findOneAndUpdate(
      { key: record.key },
      { $set: record },
      { upsert: true, new: true }
    ).lean();
    return { key: doc!.key, clientId: doc!.clientId, tier: doc!.tier };
  }
  memoryKeys.set(record.key, record);
  return record;
}

export async function deleteApiKey(key: string): Promise<boolean> {
  if (isMongoConnected()) {
    const res = await ApiKeyModel.deleteOne({ key });
    return res.deletedCount > 0;
  }
  return memoryKeys.delete(key);
}
