"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ─── Types ─────────────────────────────────────────── */

type AdminOverview = {
  users: { total: number; banned: number; frozen: number; telegramLinked: number };
  activity: { alerts24h: number; trades24h: number };
  listener: { running: boolean; subscriptions: number; uptime?: string; mode?: string; monitors?: string[] };
  infra: { database: string; solanaRpc: string; jupiter: string };
  checkedAt: string;
};

type AdminUser = {
  id: string;
  walletAddress: string;
  isBanned: boolean;
  isFrozen: boolean;
  adminNote?: string | null;
  createdAt: string;
  telegramLink?: { telegramId: string } | null;
  _count?: { tradeExecutionLogs: number; copyTraders: number };
};

type AdminLogs = {
  recentAlerts: Array<{ id: string; type: string; name: string; riskLevel: string; alertedAt: string }>;
  recentEvents: Array<{ id: string; eventType: string; dex: string; timestamp: string }>;
  failedTrades: Array<{ id: string; action: string; status: string; message?: string | null; createdAt: string }>;
};

type TestResult = { name: string; status: "pass" | "fail" | "skip"; duration: number; error?: string };
type TestSuite = { file: string; tests: TestResult[]; passed: number; failed: number; skipped: number; duration: number };
type TestRunResult = {
  ok: boolean; duration: number; suites: TestSuite[];
  summary: { total: number; passed: number; failed: number; skipped: number };
  ranAt: string; error?: string;
};

type UserTrades = {
  userId: string;
  summary: { totalSuccess: number; totalFailed: number; totalBoughtSol: number; pnl24h: { pnl24hSol: number; solIn: number; solOut: number } };
  trades: Array<{ id: string; action: string; tokenAddress: string; alertType: string; amount: number; slippage: number; status: string; txSig?: string | null; message?: string | null; createdAt: string }>;
};

/* ─── Design tokens ──────────────────────────────────── */

const C = {
  bg: "#050505",
  surface: "#0e0e14",
  card: "#111118",
  border: "#1e1e2e",
  accent: "#5100fd",
  accentMid: "rgba(81,0,253,0.15)",
  accentBorder: "rgba(81,0,253,0.35)",
  text: "#f0f0f8",
  muted: "#8b8ba0",
  dim: "#4a4a60",
  green: "#22c55e",
  red: "#ef4444",
  yellow: "#eab308",
  blue: "#3b82f6",
};

/* ─── Tiny helpers ───────────────────────────────────── */

function StatusDot({ on, pulse }: { on: boolean; pulse?: boolean }) {
  return (
    <span
      className={pulse && on ? "animate-pulse" : ""}
      style={{
        display: "inline-block", width: 8, height: 8, borderRadius: "50%",
        backgroundColor: on ? C.green : C.red, flexShrink: 0,
      }}
    />
  );
}

function InfraStatus({ label, value }: { label: string; value: string }) {
  const ok = value === "ok";
  const color = ok ? C.green : value === "missing" ? C.yellow : C.red;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
      {children}
    </div>
  );
}

function Card({ label, value, sub, color = C.text }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.dim, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
      backgroundColor: `${color}20`, color, border: `1px solid ${color}40`,
    }}>{children}</span>
  );
}

function ActionBtn({ children, onClick, variant = "default" }: {
  children: React.ReactNode; onClick: () => void;
  variant?: "default" | "danger" | "success" | "warning" | "accent";
}) {
  const colors: Record<string, { bg: string; text: string }> = {
    default: { bg: C.surface, text: C.muted },
    danger: { bg: "rgba(239,68,68,0.15)", text: C.red },
    success: { bg: "rgba(34,197,94,0.15)", text: C.green },
    warning: { bg: "rgba(234,179,8,0.15)", text: C.yellow },
    accent: { bg: C.accentMid, text: C.accent },
  };
  const { bg, text } = colors[variant];
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700,
        backgroundColor: bg, color: text, border: `1px solid ${text}40`,
        cursor: "pointer", transition: "opacity 0.15s",
      }}
    >
      {children}
    </button>
  );
}

/* ─── Main component ─────────────────────────────────── */

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AdminLogs | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [tradesModal, setTradesModal] = useState<{ userId: string; wallet: string } | null>(null);
  const [tradesData, setTradesData] = useState<UserTrades | null>(null);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testSuite, setTestSuite] = useState<"unit" | "integration" | "all">("unit");
  const [expandedSuite, setExpandedSuite] = useState<string | null>(null);
  const [controlLoading, setControlLoading] = useState(false);

  const fetchOverview = async () => {
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 403) { setOverview(null); setLoading(false); return; }
      throw new Error("Failed");
    }
    setOverview(await res.json());
    setLastRefresh(new Date());
  };

  const fetchUsers = async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Forbidden");
    const data = await res.json();
    const list = data.users || [];
    setUsers(list);
    setNotes((prev) => {
      const next = { ...prev };
      for (const u of list) if (!(u.id in next)) next[u.id] = u.adminNote || "";
      return next;
    });
  };

  const fetchLogs = async () => {
    const res = await fetch("/api/admin/logs", { cache: "no-store" });
    if (!res.ok) return;
    setLogs(await res.json());
  };

  const fetchUserTrades = async (userId: string) => {
    setTradesLoading(true);
    setTradesData(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/trades`, { cache: "no-store" });
      if (res.ok) setTradesData(await res.json());
    } finally { setTradesLoading(false); }
  };

  useEffect(() => {
    const run = async () => {
      try { await Promise.all([fetchOverview(), fetchUsers(), fetchLogs()]); }
      finally { setLoading(false); }
    };
    run();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => fetchUsers().catch(() => null), 250);
    return () => clearTimeout(id);
  }, [q, statusFilter]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchOverview().catch(() => null);
      fetchLogs().catch(() => null);
    }, 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (tradesModal) fetchUserTrades(tradesModal.userId);
  }, [tradesModal]);

  const runTests = async () => {
    setTestRunning(true);
    setTestResult(null);
    setExpandedSuite(null);
    try {
      const res = await fetch(`/api/admin/tests/run?suite=${testSuite}`, { method: "POST" });
      if (res.ok) setTestResult(await res.json());
    } finally { setTestRunning(false); }
  };

  const controlListener = async (action: "start" | "stop" | "restart") => {
    setControlLoading(true);
    try {
      await fetch("/api/admin/listener/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await fetchOverview();
    } finally { setControlLoading(false); }
  };

  const updateStatus = async (id: string, action: "ban" | "unban" | "freeze" | "unfreeze") => {
    await fetch(`/api/admin/users/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: notes[id] || null }),
    });
    await Promise.all([fetchUsers(), fetchOverview()]);
  };

  const saveNote = async (id: string) => {
    await fetch(`/api/admin/users/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "note", note: notes[id] || null }),
    }).catch(() => null);
    await fetchUsers();
  };

  /* ── Loading / Access denied ── */

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: C.muted }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${C.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 13 }}>Loading admin panel…</div>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
        <div style={{ fontSize: 32 }}>🔐</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>Access Denied</div>
        <div style={{ fontSize: 13, color: C.muted, textAlign: "center", maxWidth: 320 }}>
          Your wallet is not on the admin list. Connect an authorized wallet to access this panel.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 8, padding: "10px 24px", borderRadius: 10, background: C.accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", border: "none" }}
        >
          Retry
        </button>
      </div>
    );
  }

  const liveColor = overview.listener.running ? C.green : C.red;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } } * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text, letterSpacing: "-0.02em" }}>Alertly Admin</div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20,
            backgroundColor: overview.listener.running ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${overview.listener.running ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}>
            <StatusDot on={overview.listener.running} pulse />
            <span style={{ fontSize: 10, fontWeight: 800, color: liveColor, letterSpacing: "0.06em" }}>
              {overview.listener.running ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.dim }}>
          {lastRefresh ? `Refreshed ${lastRefresh.toLocaleTimeString()}` : ""}
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 28 }}>

        {/* ── Stats row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
          <Card label="Telegram Users" value={overview.users.total} />
          <Card label="Alerts 24h" value={overview.activity.alerts24h} color={C.accent} />
          <Card label="Trades 24h" value={overview.activity.trades24h} color={C.green} />
          <Card label="Banned" value={overview.users.banned} color={overview.users.banned > 0 ? C.red : C.dim} />
          <Card label="Uptime" value={overview.listener.uptime || "—"} sub={overview.listener.mode || undefined} />
        </div>

        {/* ── Listener + Infrastructure ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Listener control */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <SectionTitle>Listener Control</SectionTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <StatusDot on={overview.listener.running} pulse />
              <span style={{ fontSize: 13, fontWeight: 700, color: liveColor }}>
                {overview.listener.running ? "Running" : "Stopped"}
              </span>
              {overview.listener.uptime && (
                <span style={{ fontSize: 11, color: C.dim }}>· {overview.listener.uptime}</span>
              )}
            </div>

            {overview.listener.monitors && overview.listener.monitors.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.dim, fontWeight: 600, marginBottom: 8, letterSpacing: "0.05em" }}>ACTIVE MONITORS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {overview.listener.monitors.map((m) => (
                    <div key={m} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: C.muted }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: C.accent, flexShrink: 0, display: "inline-block" }} />
                      {m}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <ActionBtn variant="success" onClick={() => controlListener("start")}>
                {controlLoading ? "…" : "▶ Start"}
              </ActionBtn>
              <ActionBtn variant="danger" onClick={() => controlListener("stop")}>
                {controlLoading ? "…" : "■ Stop"}
              </ActionBtn>
              <ActionBtn variant="warning" onClick={() => controlListener("restart")}>
                {controlLoading ? "…" : "↺ Restart"}
              </ActionBtn>
            </div>
          </div>

          {/* Infrastructure */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <SectionTitle>Infrastructure</SectionTitle>
            <InfraStatus label="Database" value={overview.infra.database} />
            <InfraStatus label="Solana RPC" value={overview.infra.solanaRpc} />
            <InfraStatus label="Jupiter API" value={overview.infra.jupiter} />
            <div style={{ fontSize: 10, color: C.dim, marginTop: 12 }}>
              Last check: {new Date(overview.checkedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* ── Recent alerts ── */}
        {logs && logs.recentAlerts.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <SectionTitle>Recent Alerts</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {logs.recentAlerts.slice(0, 12).map((a) => {
                const riskColor = a.riskLevel === "HIGH" ? C.red : a.riskLevel === "MEDIUM" ? C.yellow : C.green;
                const isBoost = a.type === "DEX_BOOST";
                return (
                  <div key={a.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", borderRadius: 10,
                    background: C.surface, border: `1px solid ${C.border}`,
                  }}>
                    <span style={{ fontSize: 12 }}>{isBoost ? "⚡" : "🆕"}</span>
                    <span style={{ flex: 1, fontSize: 12, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.name}
                    </span>
                    <Pill color={riskColor}>{a.riskLevel || "—"}</Pill>
                    <span style={{ fontSize: 10, color: C.dim, flexShrink: 0 }}>
                      {new Date(a.alertedAt).toLocaleTimeString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {logs && logs.failedTrades.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <SectionTitle>Failed Trades</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {logs.failedTrades.slice(0, 8).map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.red, textTransform: "uppercase" }}>{t.action}</span>
                  <span style={{ flex: 1, fontSize: 11, color: C.muted }}>{t.message || t.status || "—"}</span>
                  <span style={{ fontSize: 10, color: C.dim }}>{new Date(t.createdAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── User management ── */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <SectionTitle>User Management</SectionTitle>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search wallet / id / telegram…"
              style={{
                flex: 1, background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "8px 14px", color: C.text, fontSize: 12, outline: "none",
              }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "8px 14px", color: C.muted, fontSize: 12, outline: "none",
              }}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
              <option value="frozen">Frozen</option>
            </select>
          </div>

          {users.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: C.dim, fontSize: 12 }}>
              No users found — user records require database integration.
            </div>
          ) : (
            <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${C.border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.surface }}>
                    {["Wallet", "Telegram", "Status", "Trades", "Note", "Actions"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const stateColor = u.isBanned ? C.red : u.isFrozen ? C.yellow : C.green;
                    const stateLabel = u.isBanned ? "BANNED" : u.isFrozen ? "FROZEN" : "ACTIVE";
                    return (
                      <tr key={u.id} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: C.muted }}>
                          {u.walletAddress.slice(0, 8)}…{u.walletAddress.slice(-6)}
                        </td>
                        <td style={{ padding: "10px 14px", color: C.muted }}>
                          {u.telegramLink?.telegramId || <span style={{ color: C.dim }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <Pill color={stateColor}>{stateLabel}</Pill>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <button
                            onClick={() => setTradesModal({ userId: u.id, wallet: u.walletAddress })}
                            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px 10px", color: C.muted, fontSize: 11, cursor: "pointer" }}
                          >
                            {u._count?.tradeExecutionLogs ?? 0} trades
                          </button>
                        </td>
                        <td style={{ padding: "10px 14px", minWidth: 180 }}>
                          <textarea
                            value={notes[u.id] || ""}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [u.id]: e.target.value }))}
                            rows={2}
                            style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 8px", color: C.text, fontSize: 11, resize: "vertical", outline: "none" }}
                          />
                          <button
                            onClick={() => saveNote(u.id)}
                            style={{ marginTop: 4, padding: "3px 10px", borderRadius: 6, background: C.accentMid, color: C.accent, fontSize: 10, fontWeight: 700, border: `1px solid ${C.accentBorder}`, cursor: "pointer" }}
                          >
                            Save
                          </button>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {u.isBanned
                              ? <ActionBtn variant="success" onClick={() => updateStatus(u.id, "unban")}>Unban</ActionBtn>
                              : <ActionBtn variant="danger" onClick={() => updateStatus(u.id, "ban")}>Ban</ActionBtn>}
                            {u.isFrozen
                              ? <ActionBtn variant="accent" onClick={() => updateStatus(u.id, "unfreeze")}>Unfreeze</ActionBtn>
                              : <ActionBtn variant="warning" onClick={() => updateStatus(u.id, "freeze")}>Freeze</ActionBtn>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Test Runner ── */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
          <SectionTitle>Test Runner</SectionTitle>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 }}>
            {(["unit", "integration", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setTestSuite(s)}
                style={{
                  padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: testSuite === s ? C.accent : C.surface,
                  color: testSuite === s ? "#fff" : C.muted,
                  border: `1px solid ${testSuite === s ? C.accent : C.border}`,
                  textTransform: "capitalize",
                }}
              >
                {s === "all" ? "All Tests" : `${s.charAt(0).toUpperCase() + s.slice(1)} Tests`}
              </button>
            ))}

            <button
              onClick={runTests}
              disabled={testRunning}
              style={{
                padding: "7px 20px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: testRunning ? "not-allowed" : "pointer",
                background: testRunning ? C.surface : C.accentMid,
                color: testRunning ? C.dim : C.accent,
                border: `1px solid ${testRunning ? C.border : C.accentBorder}`,
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              {testRunning && (
                <span style={{ width: 12, height: 12, border: `2px solid ${C.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
              )}
              {testRunning ? "Running…" : "▶ Run"}
            </button>

            {testResult && (
              <span style={{ fontSize: 10, color: C.dim, marginLeft: "auto" }}>
                Last run: {new Date(testResult.ranAt).toLocaleTimeString()} · {(testResult.duration / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          {testRunning && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0", color: C.muted, fontSize: 12 }}>
              <span style={{ width: 16, height: 16, border: `2px solid ${C.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block", flexShrink: 0 }} />
              Running {testSuite} tests… this may take up to 30 seconds
            </div>
          )}

          {testResult && !testRunning && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Summary */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {[
                  { label: "Total", value: testResult.summary.total, color: C.text },
                  { label: "Passed", value: testResult.summary.passed, color: C.green },
                  { label: "Failed", value: testResult.summary.failed, color: C.red },
                  { label: "Skipped", value: testResult.summary.skipped, color: C.yellow },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: C.surface, borderRadius: 10, padding: "12px 16px", textAlign: "center", border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Overall result badge */}
              <div style={{
                padding: "10px 16px", borderRadius: 10,
                background: testResult.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${testResult.ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>{testResult.ok ? "✅" : "❌"}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: testResult.ok ? C.green : C.red }}>
                  {testResult.ok ? "All tests passed" : `${testResult.summary.failed} test${testResult.summary.failed !== 1 ? "s" : ""} failed`}
                </span>
              </div>

              {testResult.error && (
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "12px 16px", fontSize: 11, color: C.red, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {testResult.error}
                </div>
              )}

              {/* Suite breakdown */}
              {testResult.suites.map((suite) => (
                <div key={suite.file} style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <button
                    onClick={() => setExpandedSuite(expandedSuite === suite.file ? null : suite.file)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 16px", background: C.surface, border: "none", cursor: "pointer", color: C.text,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <StatusDot on={suite.failed === 0} />
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: C.muted }}>{suite.file}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
                      <span style={{ color: C.green }}>{suite.passed} passed</span>
                      {suite.failed > 0 && <span style={{ color: C.red }}>{suite.failed} failed</span>}
                      <span style={{ color: C.dim }}>{suite.duration}ms</span>
                      <span style={{ color: C.dim, fontSize: 14 }}>{expandedSuite === suite.file ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {expandedSuite === suite.file && (
                    <div style={{ background: C.card }}>
                      {suite.tests.map((t, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 16px", borderTop: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 13, flexShrink: 0, color: t.status === "pass" ? C.green : t.status === "fail" ? C.red : C.yellow }}>
                            {t.status === "pass" ? "✓" : t.status === "fail" ? "✗" : "○"}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: C.text }}>{t.name}</div>
                            {t.error && (
                              <pre style={{ marginTop: 4, fontSize: 10, color: C.red, whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "monospace" }}>
                                {t.error}
                              </pre>
                            )}
                          </div>
                          <span style={{ fontSize: 10, color: C.dim, flexShrink: 0 }}>{t.duration}ms</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Trades Modal ── */}
      {tradesModal && (
        <div
          onClick={() => { setTradesModal(null); setTradesData(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, width: "100%", maxWidth: 720, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
          >
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 900, color: C.text, fontSize: 15 }}>Trade History</div>
                <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginTop: 3 }}>{tradesModal.wallet}</div>
              </div>
              <button onClick={() => { setTradesModal(null); setTradesData(null); }} style={{ color: C.muted, fontSize: 18, background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: 20 }}>
              {tradesLoading && <div style={{ textAlign: "center", color: C.dim, padding: "32px 0" }}>Loading…</div>}

              {!tradesLoading && tradesData && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                    {[
                      { label: "Successful", value: tradesData.summary.totalSuccess, color: C.green },
                      { label: "Failed", value: tradesData.summary.totalFailed, color: C.red },
                      { label: "Total Bought", value: `${tradesData.summary.totalBoughtSol.toFixed(3)} SOL`, color: C.text },
                      {
                        label: "PnL 24h",
                        value: `${tradesData.summary.pnl24h.pnl24hSol >= 0 ? "+" : ""}${tradesData.summary.pnl24h.pnl24hSol.toFixed(4)} SOL`,
                        color: tradesData.summary.pnl24h.pnl24hSol >= 0 ? C.green : C.red,
                      },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, letterSpacing: "0.07em", marginBottom: 5, textTransform: "uppercase" }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {tradesData.trades.length === 0
                    ? <div style={{ textAlign: "center", color: C.dim, padding: "24px 0" }}>No trades found</div>
                    : tradesData.trades.map((t) => (
                      <div key={t.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                        <Pill color={t.action === "buy" ? C.green : C.red}>{t.action.toUpperCase()}</Pill>
                        <span style={{ fontFamily: "monospace", color: C.muted }}>{t.tokenAddress.slice(0, 8)}…</span>
                        <span style={{ fontWeight: 700, color: C.text }}>{t.amount} SOL</span>
                        <Pill color={t.status === "success" ? C.green : t.status === "failed" ? C.red : C.yellow}>
                          {t.status}
                        </Pill>
                        {t.txSig && (
                          <a href={`https://solscan.io/tx/${t.txSig}`} target="_blank" rel="noreferrer"
                            style={{ fontSize: 10, color: C.accent, marginLeft: "auto" }}>View tx ↗</a>
                        )}
                        {!t.txSig && t.message && <span style={{ fontSize: 10, color: C.dim, marginLeft: "auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{t.message}</span>}
                      </div>
                    ))
                  }
                </div>
              )}

              {!tradesLoading && !tradesData && (
                <div style={{ textAlign: "center", color: C.dim, padding: "32px 0" }}>No trade data available.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
