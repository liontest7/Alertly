"use client";

import { useEffect, useRef, useState } from "react";

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
  alerts: Array<{ id: string; type: string; name: string; symbol?: string; mc?: string; liquidity?: string; alertedAt: string }>;
  trades: Array<any>;
  blockchainEvents: Array<any>;
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

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full border-2 border-[#5100fd] border-t-transparent animate-spin"
      style={{ width: size, height: size, flexShrink: 0 }}
    />
  );
}

function StatusBadge({ on }: { on: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${on ? "bg-green-500/10 text-green-400 border border-green-500/25" : "bg-red-500/10 text-red-400 border border-red-500/25"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
      {on ? "Live" : "Offline"}
    </span>
  );
}

function Pill({ label, variant }: { label: string; variant: "green" | "red" | "yellow" | "purple" | "gray" }) {
  const cls = {
    green: "bg-green-500/10 text-green-400 border-green-500/25",
    red: "bg-red-500/10 text-red-400 border-red-500/25",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25",
    purple: "bg-[#5100fd]/10 text-[#5100fd] border-[#5100fd]/25",
    gray: "bg-zinc-800 text-zinc-400 border-zinc-700",
  }[variant];
  return <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${cls}`}>{label}</span>;
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{label}</div>
      <div className={`text-3xl font-black leading-none ${accent ? "text-[#5100fd]" : "text-white"}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-600 mt-1.5">{sub}</div>}
    </div>
  );
}

function InfraRow({ label, value }: { label: string; value: string }) {
  const ok = value === "ok";
  const missing = value === "missing";
  const color = ok ? "text-green-400" : missing ? "text-yellow-400" : "text-red-400";
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-zinc-800 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{value}</span>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">{children}</div>;
}

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
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchOverview = async () => {
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    if (res.status === 403) { setAccessDenied(true); setLoading(false); return; }
    if (!res.ok) throw new Error("Failed");
    setOverview(await res.json());
    setLastRefresh(new Date());
  };

  const fetchUsers = async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size={32} />
          <p className="text-zinc-500 text-sm">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  if (accessDenied || !overview) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-2xl">🔐</div>
        <h1 className="text-xl font-black text-white">Access Denied</h1>
        <p className="text-zinc-500 text-sm text-center max-w-xs">Your wallet is not on the admin allowlist. Connect an authorized wallet to continue.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-6 py-2.5 rounded-xl bg-[#5100fd] text-white font-bold text-sm hover:bg-[#5100fd]/80 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const recentAlerts = logs?.alerts ?? [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base font-black tracking-tight">Alertly Admin</span>
            <StatusBadge on={overview.listener.running} />
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-[10px] text-zinc-600">Refreshed {lastRefresh.toLocaleTimeString()}</span>
            )}
            <button
              onClick={() => { fetchOverview().catch(() => null); fetchLogs().catch(() => null); fetchUsers().catch(() => null); }}
              className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Telegram Users" value={overview.users.total} />
          <StatCard label="Alerts 24h" value={overview.activity.alerts24h} accent />
          <StatCard label="Trades 24h" value={overview.activity.trades24h} />
          <StatCard label="Banned" value={overview.users.banned} sub={overview.users.banned > 0 ? "action needed" : "none"} />
          <StatCard label="Uptime" value={overview.listener.uptime || "—"} sub={overview.listener.mode || undefined} />
        </div>

        {/* Listener + Infra */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Listener */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <SectionHeader>Listener Control</SectionHeader>
            <div className="flex items-center gap-2.5 mb-5">
              <span className={`w-2 h-2 rounded-full ${overview.listener.running ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
              <span className={`text-sm font-bold ${overview.listener.running ? "text-green-400" : "text-red-400"}`}>
                {overview.listener.running ? "Running" : "Stopped"}
              </span>
              {overview.listener.uptime && (
                <span className="text-xs text-zinc-600">· {overview.listener.uptime}</span>
              )}
            </div>

            {overview.listener.monitors && overview.listener.monitors.length > 0 && (
              <div className="mb-5 space-y-1.5">
                <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-2">Active Monitors</div>
                {overview.listener.monitors.map((m) => (
                  <div key={m} className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="w-1 h-1 rounded-full bg-[#5100fd]" />
                    {m}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => controlListener("start")}
                disabled={controlLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-green-500/10 text-green-400 border border-green-500/25 hover:bg-green-500/20 transition-colors disabled:opacity-50"
              >
                {controlLoading ? <Spinner size={10} /> : "▶"} Start
              </button>
              <button
                onClick={() => controlListener("stop")}
                disabled={controlLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {controlLoading ? <Spinner size={10} /> : "■"} Stop
              </button>
              <button
                onClick={() => controlListener("restart")}
                disabled={controlLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/25 hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
              >
                {controlLoading ? <Spinner size={10} /> : "↺"} Restart
              </button>
            </div>
          </div>

          {/* Infrastructure */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <SectionHeader>Infrastructure</SectionHeader>
            <InfraRow label="Database" value={overview.infra.database} />
            <InfraRow label="Solana RPC" value={overview.infra.solanaRpc} />
            <InfraRow label="Jupiter API" value={overview.infra.jupiter} />
            <div className="text-[10px] text-zinc-600 mt-3">
              Last checked: {new Date(overview.checkedAt).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        {recentAlerts.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <SectionHeader>Recent Alerts</SectionHeader>
            <div className="space-y-2">
              {recentAlerts.slice(0, 12).map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  <span className="text-sm">{a.type === "DEX_BOOST" ? "⚡" : "🆕"}</span>
                  <span className="flex-1 text-xs font-semibold text-white truncate">{a.name || a.symbol || a.id}</span>
                  {a.mc && <span className="text-[10px] text-zinc-500 hidden sm:block">MC {a.mc}</span>}
                  <span className="text-[10px] text-zinc-600 flex-shrink-0">
                    {new Date(a.alertedAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Management */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <SectionHeader>User Management</SectionHeader>

          <div className="flex gap-2 mb-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search wallet / id / telegram…"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#5100fd]/50 transition-colors"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-400 outline-none focus:border-[#5100fd]/50 transition-colors"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="banned">Banned</option>
              <option value="frozen">Frozen</option>
            </select>
          </div>

          {users.length === 0 ? (
            <div className="text-center py-10 text-zinc-600 text-sm">
              No users found — user records require database integration.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-950">
                    {["Wallet", "Telegram", "Status", "Trades", "Note", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const stateVariant = u.isBanned ? "red" : u.isFrozen ? "yellow" : "green";
                    const stateLabel = u.isBanned ? "Banned" : u.isFrozen ? "Frozen" : "Active";
                    return (
                      <tr key={u.id} className="border-t border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-zinc-400">
                          {u.walletAddress.slice(0, 8)}…{u.walletAddress.slice(-6)}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {u.telegramLink?.telegramId || <span className="text-zinc-700">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Pill label={stateLabel} variant={stateVariant as any} />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setTradesModal({ userId: u.id, wallet: u.walletAddress })}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors text-[10px] font-bold"
                          >
                            {u._count?.tradeExecutionLogs ?? 0} trades
                          </button>
                        </td>
                        <td className="px-4 py-3 min-w-[160px]">
                          <textarea
                            value={notes[u.id] || ""}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [u.id]: e.target.value }))}
                            rows={2}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-300 resize-y outline-none focus:border-[#5100fd]/40 transition-colors"
                          />
                          <button
                            onClick={() => saveNote(u.id)}
                            className="mt-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-[#5100fd]/10 text-[#5100fd] border border-[#5100fd]/25 hover:bg-[#5100fd]/20 transition-colors"
                          >
                            Save
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {u.isBanned
                              ? <button onClick={() => updateStatus(u.id, "unban")} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/25 hover:bg-green-500/20 transition-colors">Unban</button>
                              : <button onClick={() => updateStatus(u.id, "ban")} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 transition-colors">Ban</button>}
                            {u.isFrozen
                              ? <button onClick={() => updateStatus(u.id, "unfreeze")} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#5100fd]/10 text-[#5100fd] border border-[#5100fd]/25 hover:bg-[#5100fd]/20 transition-colors">Unfreeze</button>
                              : <button onClick={() => updateStatus(u.id, "freeze")} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/25 hover:bg-yellow-500/20 transition-colors">Freeze</button>}
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

        {/* Test Runner */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <SectionHeader>Test Runner</SectionHeader>

          <div className="flex flex-wrap gap-2 items-center mb-5">
            {(["unit", "integration", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setTestSuite(s)}
                className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-colors ${
                  testSuite === s
                    ? "bg-[#5100fd] text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                }`}
              >
                {s === "all" ? "All Tests" : `${s.charAt(0).toUpperCase() + s.slice(1)} Tests`}
              </button>
            ))}

            <button
              onClick={runTests}
              disabled={testRunning}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-[#5100fd]/10 text-[#5100fd] border border-[#5100fd]/25 hover:bg-[#5100fd]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testRunning ? <Spinner size={12} /> : "▶"}
              {testRunning ? "Running…" : "Run Tests"}
            </button>

            {testResult && (
              <span className="text-[10px] text-zinc-600 ml-auto">
                {new Date(testResult.ranAt).toLocaleTimeString()} · {(testResult.duration / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          {testRunning && (
            <div className="flex items-center gap-3 py-4 text-zinc-500 text-sm">
              <Spinner size={16} />
              Running {testSuite} tests — this may take up to 30 seconds…
            </div>
          )}

          {testResult && !testRunning && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Total", value: testResult.summary.total, cls: "text-white" },
                  { label: "Passed", value: testResult.summary.passed, cls: "text-green-400" },
                  { label: "Failed", value: testResult.summary.failed, cls: "text-red-400" },
                  { label: "Skipped", value: testResult.summary.skipped, cls: "text-yellow-400" },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-center">
                    <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2">{label}</div>
                    <div className={`text-2xl font-black ${cls}`}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Result badge */}
              <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${testResult.ok ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                <span className="text-base">{testResult.ok ? "✅" : "❌"}</span>
                <span className={`text-sm font-bold ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                  {testResult.ok
                    ? "All tests passed"
                    : `${testResult.summary.failed} test${testResult.summary.failed !== 1 ? "s" : ""} failed`}
                </span>
              </div>

              {testResult.error && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 font-mono text-xs text-red-400 whitespace-pre-wrap break-all">
                  {testResult.error}
                </div>
              )}

              {/* Suite breakdown */}
              {testResult.suites.map((suite) => (
                <div key={suite.file} className="border border-zinc-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSuite(expandedSuite === suite.file ? null : suite.file)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-zinc-950 hover:bg-zinc-900 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${suite.failed === 0 ? "bg-green-400" : "bg-red-400"}`} />
                      <span className="font-mono text-xs text-zinc-400">{suite.file}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-400">{suite.passed} passed</span>
                      {suite.failed > 0 && <span className="text-red-400">{suite.failed} failed</span>}
                      <span className="text-zinc-600">{suite.duration}ms</span>
                      <span className="text-zinc-500">{expandedSuite === suite.file ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {expandedSuite === suite.file && (
                    <div className="bg-zinc-900">
                      {suite.tests.map((t, i) => (
                        <div key={i} className="flex items-start gap-2.5 px-4 py-2.5 border-t border-zinc-800">
                          <span className={`text-sm flex-shrink-0 ${t.status === "pass" ? "text-green-400" : t.status === "fail" ? "text-red-400" : "text-yellow-400"}`}>
                            {t.status === "pass" ? "✓" : t.status === "fail" ? "✗" : "○"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-zinc-300">{t.name}</div>
                            {t.error && (
                              <pre className="mt-1.5 text-[10px] text-red-400 whitespace-pre-wrap break-all font-mono">
                                {t.error}
                              </pre>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-600 flex-shrink-0">{t.duration}ms</span>
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

      {/* Trades Modal */}
      {tradesModal && (
        <div
          onClick={() => { setTradesModal(null); setTradesData(null); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div>
                <h2 className="font-black text-white">Trade History</h2>
                <p className="font-mono text-xs text-zinc-600 mt-0.5">{tradesModal.wallet}</p>
              </div>
              <button
                onClick={() => { setTradesModal(null); setTradesData(null); }}
                className="text-zinc-500 hover:text-white transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {tradesLoading && (
                <div className="flex items-center justify-center py-10">
                  <Spinner size={24} />
                </div>
              )}

              {!tradesLoading && tradesData && (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Successful", value: tradesData.summary.totalSuccess, cls: "text-green-400" },
                      { label: "Failed", value: tradesData.summary.totalFailed, cls: "text-red-400" },
                      { label: "Total Bought", value: `${tradesData.summary.totalBoughtSol.toFixed(3)} SOL`, cls: "text-white" },
                      {
                        label: "PnL 24h",
                        value: `${tradesData.summary.pnl24h.pnl24hSol >= 0 ? "+" : ""}${tradesData.summary.pnl24h.pnl24hSol.toFixed(4)} SOL`,
                        cls: tradesData.summary.pnl24h.pnl24hSol >= 0 ? "text-green-400" : "text-red-400",
                      },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                        <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider mb-1.5">{label}</div>
                        <div className={`text-base font-black ${cls}`}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {tradesData.trades.length === 0 ? (
                    <div className="text-center py-8 text-zinc-600 text-sm">No trades found</div>
                  ) : (
                    <div className="space-y-2">
                      {tradesData.trades.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs">
                          <Pill label={t.action.toUpperCase()} variant={t.action === "buy" ? "green" : "red"} />
                          <span className="font-mono text-zinc-500">{t.tokenAddress.slice(0, 8)}…</span>
                          <span className="font-bold text-white">{t.amount} SOL</span>
                          <Pill
                            label={t.status}
                            variant={t.status === "success" ? "green" : t.status === "failed" ? "red" : "yellow"}
                          />
                          {t.txSig && (
                            <a
                              href={`https://solscan.io/tx/${t.txSig}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#5100fd] hover:underline ml-auto text-[10px]"
                            >
                              View tx ↗
                            </a>
                          )}
                          {!t.txSig && t.message && (
                            <span className="text-[10px] text-zinc-600 ml-auto truncate max-w-[180px]">{t.message}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {!tradesLoading && !tradesData && (
                <div className="text-center py-8 text-zinc-600 text-sm">No trade data available.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
