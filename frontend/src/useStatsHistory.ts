import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStats, GatewayStats } from "./api";

const POLL_INTERVAL_MS = 2000;
const MAX_HISTORY_POINTS = 30; // 30 * 2s = 1 minute of history

export interface HistoryPoint {
  time: string;
  allowed: number;
  blocked: number;
  total: number;
}

export function useStatsHistory() {
  const [stats, setStats] = useState<GatewayStats | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const prevTotals = useRef<{ allowed: number; blocked: number } | null>(null);

  const poll = useCallback(async () => {
    try {
      const data = await fetchStats();
      setStats(data);
      setError(null);
      setLastUpdated(Date.now());

      const prev = prevTotals.current;
      const allowedDelta = prev ? Math.max(0, data.totalAllowed - prev.allowed) : 0;
      const blockedDelta = prev ? Math.max(0, data.totalBlocked - prev.blocked) : 0;
      prevTotals.current = { allowed: data.totalAllowed, blocked: data.totalBlocked };

      setHistory((h) => {
        const point: HistoryPoint = {
          time: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
          allowed: allowedDelta,
          blocked: blockedDelta,
          total: allowedDelta + blockedDelta,
        };
        const next = [...h, point];
        return next.length > MAX_HISTORY_POINTS ? next.slice(-MAX_HISTORY_POINTS) : next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach gateway");
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [poll]);

  return { stats, history, error, lastUpdated, pollIntervalMs: POLL_INTERVAL_MS };
}
