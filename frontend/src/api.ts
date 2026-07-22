export interface ClientSnapshot {
  clientId: string;
  tier: string;
  algorithm: string;
  remaining: number;
  limit: number;
  lastSeen: number;
  lastResult: "allowed" | "blocked";
}

export interface TierConfig {
  name: string;
  capacity: number;
  refillRatePerSec: number;
  windowSizeMs: number;
  maxRequestsPerWindow: number;
}

export interface GatewayStats {
  totalRequests: number;
  totalAllowed: number;
  totalBlocked: number;
  activeClientCount: number;
  activeClients: ClientSnapshot[];
  defaultAlgorithm: string;
  tiers: TierConfig[];
}

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || "http://localhost:8080";

export async function fetchStats(): Promise<GatewayStats> {
  const res = await fetch(`${GATEWAY_URL}/admin/stats`);
  if (!res.ok) {
    throw new Error(`Gateway responded with ${res.status}`);
  }
  return res.json();
}

export { GATEWAY_URL };
