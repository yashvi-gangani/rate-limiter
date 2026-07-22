import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ShieldAlert,
  Users,
  Gauge,
  Wifi,
  WifiOff,
  Zap,
  Play,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useStatsHistory } from "./useStatsHistory";
import { AnimatedNumber } from "./AnimatedNumber";
import { GATEWAY_URL } from "./api";
import { runBurst, runMixedTraffic } from "./simulate";

const TIER_COLORS: Record<string, string> = {
  free: "#8b93a7",
  pro: "#5eead4",
  enterprise: "#a78bfa",
  ultra: "#fbbf24",
};

function tierColor(name: string) {
  return TIER_COLORS[name] || "#5eead4";
}

function timeAgo(ts: number): string {
  const seconds = Math.round((Date.now() - ts) / 1000);
  if (seconds < 2) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

function StatCard({
  icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
  sub?: string;
}) {
  const prevValue = useRef(value);
  const changed = prevValue.current !== value;
  prevValue.current = value;

  return (
    <motion.div
      variants={itemVariants}
      className="stat-card"
      style={{ ["--accent" as any]: accent }}
      animate={changed ? { scale: [1, 1.03, 1] } : undefined}
      transition={{ duration: 0.35 }}
    >
      <div className="stat-card-top">
        <motion.div
          className="stat-icon"
          animate={changed ? { rotate: [0, -8, 8, 0] } : undefined}
          transition={{ duration: 0.4 }}
        >
          {icon}
        </motion.div>
        <div className="stat-label">{label}</div>
      </div>
      <div className="stat-value">
        <AnimatedNumber value={value} />
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </motion.div>
  );
}

function LiveBadge({ isLive }: { isLive: boolean }) {
  return (
    <div className={`conn-badge ${isLive ? "conn-good" : "conn-bad"}`}>
      <span className="pulse-dot-wrap">
        {isLive && <span className="pulse-ring" />}
        <span className="pulse-dot" />
      </span>
      {isLive ? <Wifi size={14} /> : <WifiOff size={14} />}
      {isLive ? "live" : "disconnected"}
    </div>
  );
}

export default function App() {
  const { stats, history, error, lastUpdated, pollIntervalMs } = useStatsHistory();
  const [simulating, setSimulating] = useState<"burst" | "mixed" | null>(null);

  const handleBurst = async () => {
    if (simulating) return;
    setSimulating("burst");
    await runBurst();
    setSimulating(null);
  };

  const handleMixed = async () => {
    if (simulating) return;
    setSimulating("mixed");
    await runMixedTraffic();
    setSimulating(null);
  };

  const blockRate =
    stats && stats.totalRequests > 0
      ? ((stats.totalBlocked / stats.totalRequests) * 100).toFixed(1)
      : "0.0";

  const tierDistribution = useMemo(() => {
    if (!stats) return [];
    const counts: Record<string, number> = {};
    for (const c of stats.activeClients) {
      counts[c.tier] = (counts[c.tier] || 0) + 1;
    }
    return Object.entries(counts).map(([tier, count]) => ({ name: tier, value: count }));
  }, [stats]);

  return (
    <motion.div className="app" variants={containerVariants} initial="hidden" animate="show">
      <div className="bg-glow" aria-hidden />

      <motion.header className="header" variants={itemVariants}>
        <div>
          <h1>
            <motion.span
              animate={{ rotate: [0, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="header-icon-wrap"
            >
              <Activity size={22} className="header-icon" />
            </motion.span>
            Rate Limiter Dashboard
          </h1>
          <p className="subtitle">
            Live view of <code>{GATEWAY_URL}</code>
          </p>
        </div>
        <LiveBadge isLive={!error} />
      </motion.header>

      <AnimatePresence>
        {error && (
          <motion.div
            className="error-banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            Couldn't reach the gateway ({error}). Make sure it's running and
            CORS/URL is configured (see <code>VITE_GATEWAY_URL</code>).
          </motion.div>
        )}
      </AnimatePresence>

      <motion.section className="control-panel" variants={itemVariants}>
        <div className="control-panel-text">
          <span className="control-panel-title">Demo controls</span>
          <span className="control-panel-sub">Generate live traffic without leaving the browser</span>
        </div>
        <div className="control-buttons">
          <button
            className="sim-btn sim-btn-burst"
            onClick={handleBurst}
            disabled={simulating !== null}
          >
            {simulating === "burst" ? <Loader2 size={15} className="spin" /> : <Zap size={15} />}
            {simulating === "burst" ? "Bursting…" : "Quick Burst (free tier)"}
          </button>
          <button
            className="sim-btn sim-btn-mixed"
            onClick={handleMixed}
            disabled={simulating !== null}
          >
            {simulating === "mixed" ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
            {simulating === "mixed" ? "Simulating 8s…" : "Simulate Mixed Traffic (8s)"}
          </button>
        </div>
      </motion.section>

      <motion.section className="stat-grid" variants={itemVariants}>
        <StatCard
          icon={<Activity size={16} />}
          label="Total Requests"
          value={stats?.totalRequests ?? 0}
          accent="#5eead4"
        />
        <StatCard
          icon={<ShieldAlert size={16} />}
          label="Blocked Requests"
          value={stats?.totalBlocked ?? 0}
          accent="#ef4444"
          sub={`${blockRate}% block rate`}
        />
        <StatCard
          icon={<Users size={16} />}
          label="Active Clients"
          value={stats?.activeClientCount ?? 0}
          accent="#a78bfa"
        />
        <motion.div
          className="stat-card stat-card-static"
          style={{ ["--accent" as any]: "#fbbf24" }}
          variants={itemVariants}
        >
          <div className="stat-card-top">
            <div className="stat-icon">
              <Gauge size={16} />
            </div>
            <div className="stat-label">Default Algorithm</div>
          </div>
          <div className="stat-value stat-value-text">{stats?.defaultAlgorithm ?? "—"}</div>
        </motion.div>
      </motion.section>

      <motion.section className="chart-row" variants={itemVariants}>
        <div className="panel chart-panel">
          <h2>Traffic (last {Math.round((history.length * pollIntervalMs) / 1000)}s)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="allowedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5eead4" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#5eead4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="blockedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#232838" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: "#8b93a7", fontSize: 11 }} axisLine={{ stroke: "#232838" }} tickLine={false} />
              <YAxis tick={{ fill: "#8b93a7", fontSize: 11 }} axisLine={{ stroke: "#232838" }} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#131722", border: "1px solid #232838", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#8b93a7" }}
              />
              <Area type="monotone" dataKey="allowed" stackId="1" stroke="#5eead4" fill="url(#allowedGrad)" name="allowed" animationDuration={400} />
              <Area type="monotone" dataKey="blocked" stackId="1" stroke="#ef4444" fill="url(#blockedGrad)" name="blocked" animationDuration={400} />
            </AreaChart>
          </ResponsiveContainer>
          {history.length === 0 && (
            <p className="chart-empty">Waiting for traffic — send a request to the gateway to see it graphed here.</p>
          )}
        </div>

        <div className="panel chart-panel chart-panel-small">
          <h2>Active Clients by Tier</h2>
          {tierDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={tierDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  animationDuration={500}
                >
                  {tierDistribution.map((entry) => (
                    <Cell key={entry.name} fill={tierColor(entry.name)} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#131722", border: "1px solid #232838", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#8b93a7" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="chart-empty">No active clients yet.</p>
          )}
        </div>
      </motion.section>

      <motion.section className="panel" variants={itemVariants}>
        <h2>Active Clients</h2>
        <table className="client-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Tier</th>
              <th>Algorithm</th>
              <th>Remaining / Limit</th>
              <th>Last Result</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {stats?.activeClients.length ? (
                stats.activeClients.map((c) => (
                  <motion.tr
                    key={`${c.clientId}-${c.lastSeen}`}
                    initial={{ opacity: 0, backgroundColor: "rgba(94,234,212,0.12)" }}
                    animate={{ opacity: 1, backgroundColor: "rgba(94,234,212,0)" }}
                    transition={{ duration: 0.8 }}
                  >
                    <td className="mono">{c.clientId}</td>
                    <td>
                      <span className="tier-pill" style={{ background: `${tierColor(c.tier)}22`, color: tierColor(c.tier) }}>
                        {c.tier}
                      </span>
                    </td>
                    <td className="mono">{c.algorithm}</td>
                    <td>
                      <div className="quota-bar-wrap">
                        <motion.div
                          className="quota-bar"
                          animate={{ width: `${Math.min(100, (c.remaining / c.limit) * 100)}%` }}
                          transition={{ duration: 0.4, ease: "easeOut" }}
                          style={{ background: tierColor(c.tier) }}
                        />
                      </div>
                      <span className="mono quota-text">
                        {c.remaining} / {c.limit}
                      </span>
                    </td>
                    <td>
                      <span className={c.lastResult === "allowed" ? "badge-ok" : "badge-blocked"}>
                        {c.lastResult}
                      </span>
                    </td>
                    <td className="mono">{timeAgo(c.lastSeen)}</td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty-row">
                    No active clients yet — send a request to the gateway to see it here.
                  </td>
                </tr>
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </motion.section>

      <motion.section className="panel" variants={itemVariants}>
        <h2>Configured Tiers</h2>
        <table className="client-table">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Bucket Capacity</th>
              <th>Refill / sec</th>
              <th>Window (ms)</th>
              <th>Max / Window</th>
            </tr>
          </thead>
          <tbody>
            {stats?.tiers.map((t) => (
              <tr key={t.name}>
                <td>
                  <span className="tier-pill" style={{ background: `${tierColor(t.name)}22`, color: tierColor(t.name) }}>
                    {t.name}
                  </span>
                </td>
                <td className="mono">{t.capacity}</td>
                <td className="mono">{t.refillRatePerSec}</td>
                <td className="mono">{t.windowSizeMs}</td>
                <td className="mono">{t.maxRequestsPerWindow}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.section>

      <footer className="footer">
        {lastUpdated ? `Last updated ${timeAgo(lastUpdated)}` : "Connecting…"} · polling every{" "}
        {pollIntervalMs / 1000}s
      </footer>
    </motion.div>
  );
}
