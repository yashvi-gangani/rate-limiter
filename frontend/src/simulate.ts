import { GATEWAY_URL } from "./api";

const DEMO_KEYS = ["demo-free-key", "demo-pro-key", "demo-enterprise-key"] as const;

function ping(apiKey: string, endpoint: "ping" | "heavy" = "ping") {
  return fetch(`${GATEWAY_URL}/api/demo/${endpoint}`, {
    headers: { "x-api-key": apiKey },
  }).catch(() => null); // ignore network errors during simulation, dashboard will show disconnected state anyway
}

/**
 * Fires a rapid burst of requests against the free tier — enough to blow
 * past its bucket capacity (10) so you visibly see allowed → blocked flip
 * in the dashboard within a couple seconds.
 */
export async function runBurst(count = 60) {
  const requests = Array.from({ length: count }, () => ping("demo-free-key"));
  await Promise.all(requests);
}

/**
 * Simulates realistic mixed traffic across all three tiers for a few
 * seconds — good for showing the dashboard's charts and active-clients
 * table populate with multiple simultaneous clients.
 */
export async function runMixedTraffic(durationMs = 8000, intervalMs = 200) {
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    const key = DEMO_KEYS[Math.floor(Math.random() * DEMO_KEYS.length)];
    const endpoint = Math.random() > 0.85 ? "heavy" : "ping";
    ping(key, endpoint);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
