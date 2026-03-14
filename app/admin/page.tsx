"use client";

import { useEffect, useState } from "react";

type ServerStats = {
  memUsedMb: number;
  memTotalMb: number;
  memUsedPct: number;
  loadAvg1m: number;
  loadAvg5m: number;
  loadPct: number;
  cpuCount: number;
  serverUptimeSeconds: number;
};

type AdminOverview = {
  users: { total: number; banned: number; frozen: number; telegramLinked: number };
  activity: { alerts24h: number; trades24h: number };
  listener: { running: boolean; subscriptions: number; uptime?: string; mode?: string; monitors?: string[] };
  infra: { solanaRpc: string; jupiter: string };
  server: ServerStats;
  checkedAt: string;
};

type TestResult = { name: string; status: "pass" | "fail" | "skip"; duration: number; error?: string };
type TestSuite = { file: string; tests: TestResult[]; passed: number; failed: number; skipped: number; duration: number };
type TestRunResult = {
  ok: boolean; duration: number; suites: TestSuite[];
  summary: { total: number; passed: number; failed: number; skipped: number };
  ranAt: string; error?: string;
};

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full border-2 border-[#5100fd] border-t-transparent animate-spin"
      style={{ width: size, height: size, flexShrink: 0 }}
    />
  );
}

function StatusDot({ on }: { on: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${on ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-red-500/15 text-red-400 border border-red-500/30"}`}>
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

function StatCard({ label, value, sub, accent, warn }: { label: string; value: string | number; sub?: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{label}</div>
      <div className={`text-3xl font-black leading-none ${warn ? "text-yellow-400" : accent ? "text-[#5100fd]" : "text-white"}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1.5">{sub}</div>}
    </div>
  );
}

function BarMeter({ pct, warn }: { pct: number; warn?: boolean }) {
  const color = pct > 85 ? "bg-red-500" : pct > 65 ? "bg-yellow-400" : "bg-[#5100fd]";
  return (
    <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function InfraRow({ label, value }: { label: string; value: string }) {
  const ok = value === "ok";
  const missing = value === "missing";
  const color = ok ? "text-green-400" : missing ? "text-yellow-400" : "text-red-400";
  const dotColor = ok ? "bg-green-400" : missing ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <span className="text-sm text-white font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotColor} ${ok ? "animate-pulse" : ""}`} />
        <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>{ok ? "Online" : missing ? "Not configured" : "Error"}</span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-black text-white uppercase tracking-widest mb-5">{children}</h2>;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [controlLoading, setControlLoading] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testSuite, setTestSuite] = useState<"unit" | "integration" | "all">("unit");
  const [expandedSuite, setExpandedSuite] = useState<string | null>(null);

  const fetchOverview = async () => {
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    if (res.status === 403) { setAccessDenied(true); setLoading(false); return; }
    if (!res.ok) throw new Error("Failed");
    setOverview(await res.json());
    setLastRefresh(new Date());
  };

  useEffect(() => {
    fetchOverview().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => fetchOverview().catch(() => null), 10_000);
    return () => clearInterval(id);
  }, []);

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

  const runTests = async () => {
    setTestRunning(true);
    setTestResult(null);
    setExpandedSuite(null);
    try {
      const res = await fetch(`/api/admin/tests/run?suite=${testSuite}`, { method: "POST" });
      if (res.ok) setTestResult(await res.json());
    } finally { setTestRunning(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size={32} />
          <p className="text-zinc-400 text-sm">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  if (accessDenied || !overview) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-2xl">🔐</div>
        <h1 className="text-xl font-black text-white">Access Denied</h1>
        <p className="text-zinc-400 text-sm text-center max-w-xs">Your wallet is not on the admin allowlist. Connect an authorized wallet to continue.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-6 py-2.5 rounded-xl bg-[#5100fd] text-white font-bold text-sm hover:bg-[#5100fd]/80 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const srv = overview.server;
  const memWarn = srv.memUsedPct > 85;
  const cpuWarn = srv.loadPct > 85;

  const infraErrors = [
    overview.infra.solanaRpc !== "ok" ? `Solana RPC: ${overview.infra.solanaRpc}` : null,
    overview.infra.jupiter !== "ok" ? `Jupiter API: ${overview.infra.jupiter}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* Admin Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#5100fd]/20 border border-[#5100fd]/30 flex items-center justify-center">
              <span className="text-[#5100fd] text-sm font-black">A</span>
            </div>
            <div>
              <span className="text-lg font-black text-white tracking-tight">Alertly Admin</span>
              <span className="text-[10px] text-zinc-500 ml-2">v2</span>
            </div>
            <StatusDot on={overview.listener.running} />
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-zinc-500">Updated {lastRefresh.toLocaleTimeString()}</span>
            )}
            <button
              onClick={() => fetchOverview().catch(() => null)}
              className="text-xs font-bold text-zinc-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
            >
              Refresh
            </button>
            <a href="/" className="text-xs font-bold text-zinc-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 border border-zinc-700/50">
              ← App
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* System Errors Banner — only shown when something is broken */}
        {infraErrors.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-red-400 text-base">⚠</span>
              <span className="text-sm font-black text-red-400 uppercase tracking-wider">System Errors Detected</span>
            </div>
            <ul className="space-y-1">
              {infraErrors.map((err) => (
                <li key={err} className="text-sm text-red-300 font-mono">· {err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Telegram Subscribers" value={overview.users.total} />
          <StatCard label="Alerts 24h" value={overview.activity.alerts24h} accent />
          <StatCard
            label="RAM Used"
            value={`${srv.memUsedPct}%`}
            sub={`${srv.memUsedMb} / ${srv.memTotalMb} MB`}
            warn={memWarn}
          />
          <StatCard
            label="CPU Load"
            value={`${srv.loadPct}%`}
            sub={`${srv.loadAvg1m} avg (${srv.cpuCount} cores)`}
            warn={cpuWarn}
          />
          <StatCard
            label="App Uptime"
            value={overview.listener.uptime || "—"}
            sub={overview.listener.mode || undefined}
          />
        </div>

        {/* Server Memory + Listener Control */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Listener Control */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <SectionTitle>Listener Control</SectionTitle>
            <div className="flex items-center gap-3 mb-6">
              <span className={`w-2.5 h-2.5 rounded-full ${overview.listener.running ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
              <span className={`text-base font-bold ${overview.listener.running ? "text-green-400" : "text-red-400"}`}>
                {overview.listener.running ? "Running" : "Stopped"}
              </span>
              {overview.listener.uptime && (
                <span className="text-xs text-zinc-500">· {overview.listener.uptime}</span>
              )}
            </div>

            {overview.listener.monitors && overview.listener.monitors.length > 0 && (
              <div className="mb-6 space-y-2">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Active Monitors</div>
                {overview.listener.monitors.map((m) => (
                  <div key={m} className="flex items-center gap-2 text-sm text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5100fd] flex-shrink-0" />
                    {m}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-auto">
              <button
                onClick={() => controlListener("start")}
                disabled={controlLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/25 hover:bg-green-500/20 transition-colors disabled:opacity-50"
              >
                {controlLoading ? <Spinner size={10} /> : "▶"} Start
              </button>
              <button
                onClick={() => controlListener("stop")}
                disabled={controlLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {controlLoading ? <Spinner size={10} /> : "■"} Stop
              </button>
              <button
                onClick={() => controlListener("restart")}
                disabled={controlLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/25 hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
              >
                {controlLoading ? <Spinner size={10} /> : "↺"} Restart
              </button>
            </div>
          </div>

          {/* Infrastructure + Server Stats */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-6">
            <div>
              <SectionTitle>Infrastructure</SectionTitle>
              <InfraRow label="Solana RPC" value={overview.infra.solanaRpc} />
              <InfraRow label="Jupiter API" value={overview.infra.jupiter} />
              <div className="text-xs text-zinc-500 mt-3">
                Checked: {new Date(overview.checkedAt).toLocaleTimeString()}
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-5">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Server Resources</div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-white">RAM</span>
                    <span className={`text-sm font-bold ${memWarn ? "text-yellow-400" : "text-white"}`}>
                      {srv.memUsedMb} MB / {srv.memTotalMb} MB
                      <span className="text-xs text-zinc-500 ml-1">({srv.memUsedPct}%)</span>
                    </span>
                  </div>
                  <BarMeter pct={srv.memUsedPct} />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-white">CPU Load</span>
                    <span className={`text-sm font-bold ${cpuWarn ? "text-yellow-400" : "text-white"}`}>
                      {srv.loadAvg1m} <span className="text-xs text-zinc-500">/ {srv.cpuCount} cores</span>
                    </span>
                  </div>
                  <BarMeter pct={srv.loadPct} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Server Uptime</span>
                  <span className="text-white font-bold">{formatUptime(srv.serverUptimeSeconds)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Telegram Subscribers (User Management) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <SectionTitle>Telegram Subscribers</SectionTitle>
            </div>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
              {overview.users.total} subscriber{overview.users.total !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-300 leading-relaxed">
            <p>
              User management is based on <span className="text-white font-semibold">Telegram subscribers</span> stored in{" "}
              <code className="text-[#5100fd] bg-[#5100fd]/10 px-1.5 py-0.5 rounded text-xs">telegram-bot/data/subscribers.json</code>.
              Since there is no central database, ban and freeze actions are not available in this version.
            </p>
            <p className="mt-3 text-zinc-400">
              To restrict a subscriber, remove their entry from the JSON file or stop the Telegram bot. Full user management
              (ban, freeze, notes, trade history) becomes available when a database is connected.
            </p>
          </div>
        </div>

        {/* Test Runner */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <SectionTitle>Test Runner</SectionTitle>

          <div className="flex flex-wrap gap-2 items-center mb-6">
            {(["unit", "integration", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setTestSuite(s)}
                className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-colors ${
                  testSuite === s
                    ? "bg-[#5100fd] text-white"
                    : "bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700"
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
              <span className="text-xs text-zinc-500 ml-auto">
                {new Date(testResult.ranAt).toLocaleTimeString()} · {(testResult.duration / 1000).toFixed(1)}s
              </span>
            )}
          </div>

          {testRunning && (
            <div className="flex items-center gap-3 py-4 text-zinc-400 text-sm">
              <Spinner size={16} />
              Running {testSuite} tests — this may take up to 30 seconds…
            </div>
          )}

          {testResult && !testRunning && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Total", value: testResult.summary.total, cls: "text-white" },
                  { label: "Passed", value: testResult.summary.passed, cls: "text-green-400" },
                  { label: "Failed", value: testResult.summary.failed, cls: "text-red-400" },
                  { label: "Skipped", value: testResult.summary.skipped, cls: "text-yellow-400" },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-center">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{label}</div>
                    <div className={`text-2xl font-black ${cls}`}>{value}</div>
                  </div>
                ))}
              </div>

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

              {testResult.suites.map((suite) => (
                <div key={suite.file} className="border border-zinc-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSuite(expandedSuite === suite.file ? null : suite.file)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-zinc-950 hover:bg-zinc-900 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${suite.failed === 0 ? "bg-green-400" : "bg-red-400"}`} />
                      <span className="font-mono text-xs text-zinc-300">{suite.file}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-400">{suite.passed} passed</span>
                      {suite.failed > 0 && <span className="text-red-400">{suite.failed} failed</span>}
                      <span className="text-zinc-500">{suite.duration}ms</span>
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
                            <div className="text-xs text-white">{t.name}</div>
                            {t.error && (
                              <pre className="mt-1.5 text-[10px] text-red-400 whitespace-pre-wrap break-all font-mono">
                                {t.error}
                              </pre>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-500 flex-shrink-0">{t.duration}ms</span>
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
    </div>
  );
}
