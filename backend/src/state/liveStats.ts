export interface ClientSnapshot {
  clientId: string;
  tier: string;
  algorithm: string;
  remaining: number;
  limit: number;
  lastSeen: number;
  lastResult: "allowed" | "blocked";
}

const CLIENT_TTL_MS = 60_000; // drop clients we haven't seen in 60s from "active"

let totalAllowed = 0;
let totalBlocked = 0;
const clients = new Map<string, ClientSnapshot>();

export function recordRequest(snapshot: Omit<ClientSnapshot, "lastSeen">) {
  if (snapshot.lastResult === "allowed") totalAllowed++;
  else totalBlocked++;

  clients.set(snapshot.clientId, { ...snapshot, lastSeen: Date.now() });
}

export function getStats() {
  const now = Date.now();
  const activeClients = Array.from(clients.values()).filter(
    (c) => now - c.lastSeen < CLIENT_TTL_MS
  );

  return {
    totalRequests: totalAllowed + totalBlocked,
    totalAllowed,
    totalBlocked,
    activeClientCount: activeClients.length,
    activeClients: activeClients.sort((a, b) => b.lastSeen - a.lastSeen),
  };
}
