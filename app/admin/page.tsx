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
};

type AdminLogs = {
  recentAlerts: Array<{ id: string; type: string; name: string; riskLevel: string; alertedAt: string }>;
  recentEvents: Array<{ id: string; eventType: string; dex: string; timestamp: string }>;
  failedTrades: Array<{ id: string; action: string; status: string; message?: string | null; createdAt: string }>;
};

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AdminLogs | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchOverview = async () => {
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    if (!res.ok) throw new Error("Forbidden");
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
    return <main className="min-h-screen bg-[#050505] text-red-400 p-8">Admin access denied.</main>;
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white p-6 md:p-10 space-y-6">
      <h1 className="text-2xl font-black">{title}</h1>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Users" value={overview.users.total} />
        <Card label="Banned" value={overview.users.banned} />
        <Card label="Frozen" value={overview.users.frozen} />
        <Card label="Alerts 24h" value={overview.activity.alerts24h} />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm space-y-2">
          <div>Listener: {overview.listener.running ? "Running" : "Stopped"}</div>
          <div>Subscriptions: {overview.listener.subscriptions}</div>
          <div>Uptime: {overview.listener.uptime || "-"}</div>
          <div>Mode: {overview.listener.mode || "-"}</div>
          <div>Programs: {overview.listener.monitoredPrograms || 0}</div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => controlListener("start")} className="px-2 py-1 rounded bg-green-700">Start</button>
            <button onClick={() => controlListener("stop")} className="px-2 py-1 rounded bg-red-700">Stop</button>
            <button onClick={() => controlListener("restart")} className="px-2 py-1 rounded bg-yellow-700 text-black">Restart</button>
          </div>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm space-y-1">
          <div>DB: {overview.infra.database}</div>
          <div>Solana RPC: {overview.infra.solanaRpc}</div>
          <div>Jupiter: {overview.infra.jupiter}</div>
          <div>Last check: {new Date(overview.checkedAt).toLocaleTimeString()}</div>
        </div>
      </section>

      <section className="space-y-3">
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
                <th className="text-left p-2">Admin Note</th>
                <th className="text-left p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-zinc-800 align-top">
                  <td className="p-2">{u.walletAddress}</td>
                  <td className="p-2">{u.telegramLink?.telegramId || "-"}</td>
                  <td className="p-2">{u.isBanned ? "BANNED" : u.isFrozen ? "FROZEN" : "ACTIVE"}</td>
                  <td className="p-2 min-w-[220px]">
                    <textarea
                      value={notes[u.id] || ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs"
                      rows={2}
                    />
                    <button onClick={() => saveNote(u.id)} className="mt-1 px-2 py-1 rounded bg-zinc-700">Save note</button>
                  </td>
                  <td className="p-2 flex flex-wrap gap-2">
                    {u.isBanned ? (
                      <button onClick={() => updateStatus(u.id, "unban")} className="px-2 py-1 rounded bg-green-700">Unban</button>
                    ) : (
                      <button onClick={() => updateStatus(u.id, "ban")} className="px-2 py-1 rounded bg-red-700">Ban</button>
                    )}
                    {u.isFrozen ? (
                      <button onClick={() => updateStatus(u.id, "unfreeze")} className="px-2 py-1 rounded bg-blue-700">Unfreeze</button>
                    ) : (
                      <button onClick={() => updateStatus(u.id, "freeze")} className="px-2 py-1 rounded bg-yellow-700 text-black">Freeze</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4 text-xs">
        <LogCard title="Recent Alerts" items={(logs?.recentAlerts || []).map((x) => `${x.type} • ${x.name} • ${x.riskLevel}`)} />
        <LogCard title="Recent Blockchain Events" items={(logs?.recentEvents || []).map((x) => `${x.eventType} • ${x.dex}`)} />
        <LogCard title="Failed Trades" items={(logs?.failedTrades || []).map((x) => `${x.action} • ${x.status} • ${x.message || "-"}`)} />
      </section>
    </main>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
      <div className="text-zinc-400 text-xs uppercase tracking-widest">{label}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
    </div>
  );
}

function LogCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
      <div className="font-bold mb-2">{title}</div>
      <ul className="space-y-1 text-zinc-300">
        {items.length === 0 ? <li>No data</li> : items.slice(0, 10).map((item, i) => <li key={i}>• {item}</li>)}
      </ul>
    </div>
  );
}
