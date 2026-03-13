"use client";

import { useEffect, useMemo, useState } from "react";

type AdminOverview = {
  users: { total: number; banned: number; frozen: number; telegramLinked: number };
  activity: { alerts24h: number; trades24h: number };
  listener: { running: boolean; subscriptions: number; uptime?: string; mode?: string; monitoredPrograms?: number };
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

type UserTrades = {
  userId: string;
  summary: {
    totalSuccess: number;
    totalFailed: number;
    totalBoughtSol: number;
    pnl24h: { pnl24hSol: number; solIn: number; solOut: number };
  };
  trades: Array<{
    id: string;
    action: string;
    tokenAddress: string;
    alertType: string;
    amount: number;
    slippage: number;
    status: string;
    txSig?: string | null;
    message?: string | null;
    createdAt: string;
  }>;
};

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AdminLogs | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [tradesModal, setTradesModal] = useState<{ userId: string; wallet: string } | null>(null);
  const [tradesData, setTradesData] = useState<UserTrades | null>(null);
  const [tradesLoading, setTradesLoading] = useState(false);

  const fetchOverview = async () => {
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 403) {
        setOverview(null);
        setLoading(false);
        return;
      }
      throw new Error("Failed to fetch overview");
    }
    setOverview(await res.json());
  };

  const fetchUsers = async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Forbidden");
    const data = await res.json();
    const list = data.users || [];
    setUsers(list);
    setNotes((prev) => {
      const next = { ...prev };
      for (const u of list) {
        if (!(u.id in next)) {
          next[u.id] = u.adminNote || "";
        }
      }
      return next;
    });
  };

  const fetchLogs = async () => {
    const res = await fetch("/api/admin/logs", { cache: "no-store" });
    if (!res.ok) throw new Error("Forbidden");
    setLogs(await res.json());
  };

  const fetchUserTrades = async (userId: string) => {
    setTradesLoading(true);
    setTradesData(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/trades`, { cache: "no-store" });
      if (res.ok) setTradesData(await res.json());
    } finally {
      setTradesLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        await Promise.all([fetchOverview(), fetchUsers(), fetchLogs()]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      fetchUsers().catch(() => null);
    }, 200);
    return () => clearTimeout(id);
  }, [q, status]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchOverview().catch(() => null);
      fetchLogs().catch(() => null);
    }, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (tradesModal) {
      fetchUserTrades(tradesModal.userId);
    }
  }, [tradesModal]);

  const title = useMemo(() => `Admin Panel • ${overview?.listener?.running ? "LIVE" : "OFFLINE"}`, [overview]);

  const controlListener = async (action: "start" | "stop" | "restart") => {
    await fetch("/api/admin/listener/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await fetchOverview();
  };

  const updateStatus = async (id: string, action: "ban" | "unban" | "freeze" | "unfreeze") => {
    await fetch(`/api/admin/users/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: notes[id] || null }),
    });
    await fetchUsers();
    await fetchOverview();
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
    return <main className="min-h-screen bg-[#050505] text-white p-8">Loading admin panel…</main>;
  }

  if (!overview) {
    return (
      <main className="min-h-screen bg-[#050505] text-red-400 p-8 flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Admin access denied.</h1>
        <p className="text-zinc-400">Make sure your wallet is connected and authorized.</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white p-6 md:p-10 space-y-6">
      <h1 className="text-2xl font-black">{title}</h1>

      {/* Overview stats */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card label="Users" value={overview.users.total} />
        <Card label="Banned" value={overview.users.banned} color="red" />
        <Card label="Frozen" value={overview.users.frozen} color="yellow" />
        <Card label="Telegram Linked" value={overview.users.telegramLinked} color="blue" />
        <Card label="Alerts 24h" value={overview.activity.alerts24h} color="purple" />
      </section>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card label="Trades 24h" value={overview.activity.trades24h} color="green" />
      </section>

      {/* Infrastructure */}
      <section className="grid md:grid-cols-2 gap-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm space-y-2">
          <div className="font-bold text-zinc-300 mb-3">Listener Control</div>
          <div>Status: <span className={overview.listener.running ? "text-green-400" : "text-red-400"}>{overview.listener.running ? "Running" : "Stopped"}</span></div>
          <div>Uptime: {overview.listener.uptime || "-"}</div>
          <div>Mode: {overview.listener.mode || "-"}</div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => controlListener("start")} className="px-3 py-1.5 rounded bg-green-700 text-xs font-bold">Start</button>
            <button onClick={() => controlListener("stop")} className="px-3 py-1.5 rounded bg-red-700 text-xs font-bold">Stop</button>
            <button onClick={() => controlListener("restart")} className="px-3 py-1.5 rounded bg-yellow-700 text-black text-xs font-bold">Restart</button>
          </div>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm space-y-1">
          <div className="font-bold text-zinc-300 mb-3">Infrastructure</div>
          <div>DB: <span className={overview.infra.database === "ok" ? "text-green-400" : "text-red-400"}>{overview.infra.database}</span></div>
          <div>Solana RPC: <span className={overview.infra.solanaRpc === "ok" ? "text-green-400" : "text-red-400"}>{overview.infra.solanaRpc}</span></div>
          <div>Jupiter: <span className={overview.infra.jupiter === "ok" ? "text-green-400" : "text-red-400"}>{overview.infra.jupiter}</span></div>
          <div className="text-zinc-500 text-xs">Last check: {new Date(overview.checkedAt).toLocaleTimeString()}</div>
        </div>
      </section>

      {/* User management */}
      <section className="space-y-3">
        <div className="font-bold text-zinc-300">User Management</div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search wallet / id / telegram"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
            <option value="frozen">Frozen</option>
          </select>
        </div>

        <div className="overflow-auto border border-zinc-800 rounded-xl">
          <table className="w-full text-xs md:text-sm">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="text-left p-2">Wallet</th>
                <th className="text-left p-2">Telegram</th>
                <th className="text-left p-2">State</th>
                <th className="text-left p-2">Trades</th>
                <th className="text-left p-2">Admin Note</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-zinc-800 align-top">
                  <td className="p-2 font-mono text-xs">{u.walletAddress.slice(0, 8)}…{u.walletAddress.slice(-6)}</td>
                  <td className="p-2">{u.telegramLink?.telegramId || <span className="text-zinc-600">-</span>}</td>
                  <td className="p-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      u.isBanned ? "bg-red-900/40 text-red-400" :
                      u.isFrozen ? "bg-yellow-900/40 text-yellow-400" :
                      "bg-green-900/40 text-green-400"
                    }`}>
                      {u.isBanned ? "BANNED" : u.isFrozen ? "FROZEN" : "ACTIVE"}
                    </span>
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => setTradesModal({ userId: u.id, wallet: u.walletAddress })}
                      className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                    >
                      {u._count?.tradeExecutionLogs ?? 0} trades
                    </button>
                  </td>
                  <td className="p-2 min-w-[180px]">
                    <textarea
                      value={notes[u.id] || ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs"
                      rows={2}
                    />
                    <button onClick={() => saveNote(u.id)} className="mt-1 px-2 py-1 rounded bg-zinc-700 text-xs">Save</button>
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {u.isBanned ? (
                        <button onClick={() => updateStatus(u.id, "unban")} className="px-2 py-1 rounded bg-green-700 text-xs">Unban</button>
                      ) : (
                        <button onClick={() => updateStatus(u.id, "ban")} className="px-2 py-1 rounded bg-red-700 text-xs">Ban</button>
                      )}
                      {u.isFrozen ? (
                        <button onClick={() => updateStatus(u.id, "unfreeze")} className="px-2 py-1 rounded bg-blue-700 text-xs">Unfreeze</button>
                      ) : (
                        <button onClick={() => updateStatus(u.id, "freeze")} className="px-2 py-1 rounded bg-yellow-700 text-black text-xs">Freeze</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Logs */}
      <section className="grid md:grid-cols-3 gap-4 text-xs">
        <LogCard title="Recent Alerts" items={(logs?.recentAlerts || []).map((x) => `${x.type} • ${x.name} • ${x.riskLevel}`)} />
        <LogCard title="Recent Blockchain Events" items={(logs?.recentEvents || []).map((x) => `${x.eventType} • ${x.dex}`)} />
        <LogCard title="Failed Trades" items={(logs?.failedTrades || []).map((x) => `${x.action} • ${x.status} • ${x.message || "-"}`)} />
      </section>

      {/* Trades Modal */}
      {tradesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
          onClick={() => { setTradesModal(null); setTradesData(null); }}
        >
          <div
            className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <div className="font-black text-white">Trade History</div>
                <div className="text-xs text-zinc-500 font-mono mt-0.5">{tradesModal.wallet}</div>
              </div>
              <button onClick={() => { setTradesModal(null); setTradesData(null); }} className="text-zinc-500 hover:text-white text-xl">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {tradesLoading && (
                <div className="text-center text-zinc-500 py-8">Loading…</div>
              )}

              {!tradesLoading && tradesData && (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-zinc-900 rounded-lg p-3">
                      <div className="text-xs text-zinc-500 mb-1">Successful</div>
                      <div className="text-lg font-black text-green-400">{tradesData.summary.totalSuccess}</div>
                    </div>
                    <div className="bg-zinc-900 rounded-lg p-3">
                      <div className="text-xs text-zinc-500 mb-1">Failed</div>
                      <div className="text-lg font-black text-red-400">{tradesData.summary.totalFailed}</div>
                    </div>
                    <div className="bg-zinc-900 rounded-lg p-3">
                      <div className="text-xs text-zinc-500 mb-1">Total Bought</div>
                      <div className="text-lg font-black text-white">{tradesData.summary.totalBoughtSol.toFixed(3)} SOL</div>
                    </div>
                    <div className="bg-zinc-900 rounded-lg p-3">
                      <div className="text-xs text-zinc-500 mb-1">PnL 24h</div>
                      <div className={`text-lg font-black ${tradesData.summary.pnl24h.pnl24hSol >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {tradesData.summary.pnl24h.pnl24hSol >= 0 ? "+" : ""}{tradesData.summary.pnl24h.pnl24hSol.toFixed(4)} SOL
                      </div>
                    </div>
                  </div>

                  {/* Trades list */}
                  {tradesData.trades.length === 0 ? (
                    <div className="text-center text-zinc-600 py-8">No trades found</div>
                  ) : (
                    <div className="space-y-2">
                      {tradesData.trades.map((t) => (
                        <div key={t.id} className="bg-zinc-900 rounded-lg p-3 flex items-center gap-3 text-xs">
                          <span className={`px-2 py-0.5 rounded font-bold uppercase ${t.action === "buy" ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
                            {t.action}
                          </span>
                          <span className="font-mono text-zinc-400">{t.tokenAddress.slice(0, 8)}…</span>
                          <span className="text-white font-bold">{t.amount} SOL</span>
                          <span className={`ml-auto px-2 py-0.5 rounded font-bold ${
                            t.status === "success" ? "text-green-400" :
                            t.status === "failed" ? "text-red-400" :
                            "text-yellow-400"
                          }`}>{t.status}</span>
                          {t.txSig && (
                            <a
                              href={`https://solscan.io/tx/${t.txSig}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              Tx ↗
                            </a>
                          )}
                          <span className="text-zinc-600">{new Date(t.createdAt).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {!tradesLoading && !tradesData && (
                <div className="text-center text-red-400 py-8">Failed to load trades</div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Card({ label, value, color }: { label: string; value: number; color?: string }) {
  const colorMap: Record<string, string> = {
    red: "text-red-400",
    yellow: "text-yellow-400",
    blue: "text-blue-400",
    green: "text-green-400",
    purple: "text-[#5100fd]",
  };
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
      <div className="text-zinc-400 text-xs uppercase tracking-widest">{label}</div>
      <div className={`text-2xl font-black mt-1 ${color ? colorMap[color] : "text-white"}`}>{value}</div>
    </div>
  );
}

function LogCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
      <div className="font-bold mb-2 text-zinc-300">{title}</div>
      <ul className="space-y-1 text-zinc-400">
        {items.length === 0 ? <li className="text-zinc-600">No data</li> : items.slice(0, 10).map((item, i) => <li key={i}>• {item}</li>)}
      </ul>
    </div>
  );
}
