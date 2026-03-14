"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ExternalLink, Copy, Check, Zap, Globe, Twitter, Send,
  Clock, TrendingUp, TrendingDown, Loader2, BarChart2,
  X, ChevronDown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertEvent = {
  fingerprint?: string;
  type?: string;
  name?: string;
  symbol?: string;
  change?: string;
  trend?: string;
  alertedAt?: string;
  mc?: string;
  boostAmount?: number;
};

type TradeLog = {
  id: string;
  tokenAddress: string;
  alertType: string;
  action: string;
  amount: number;
  slippage: number;
  status: string;
  txSig?: string | null;
  message?: string | null;
  createdAt: string;
  tokenName?: string;
  tokenSymbol?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

function fmtSOL(n: number) {
  return n.toFixed(4);
}

function fmtPrice(p: number): string {
  if (p === 0) return "0";
  if (p < 0.000001) return `$${p.toExponential(2)}`;
  if (p < 0.001) return `$${p.toFixed(8).replace(/\.?0+$/, "")}`;
  if (p < 1) return `$${p.toPrecision(4)}`;
  return `$${p.toLocaleString()}`;
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-zinc-600 hover:text-white transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, label, right }: { icon: React.ReactNode; label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[#5100fd]">{icon}</span>
      <h2 className="text-xs font-black uppercase tracking-widest text-white">{label}</h2>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

// ─── Event Badge ──────────────────────────────────────────────────────────────

function EventBadge({ type }: { type: string }) {
  const isBoost = type.toUpperCase().includes("BOOST");
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${isBoost ? "bg-[#5100fd] text-white" : "bg-blue-600 text-white"}`}>
      {isBoost ? "DEX BOOST" : "DEX LISTING"}
    </span>
  );
}

// ─── Trade / Sell Drawer ──────────────────────────────────────────────────────

function TradeDrawer({
  mode, address, tokenSymbol, tokenName, settings, openSOL, onClose, onTraded,
}: {
  mode: "buy" | "sell";
  address: string;
  tokenSymbol: string;
  tokenName: string;
  settings: any;
  openSOL: number;
  onClose: () => void;
  onTraded: () => void;
}) {
  const [wallet, setWallet] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [buyAmount, setBuyAmount] = useState<number>(settings?.buyAmount ?? 0.5);
  const [slippage, setSlippage] = useState<number>(settings?.slippage ?? 10);
  const [sellPct, setSellPct] = useState<number>(50);
  const [trading, setTrading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; txSig?: string } | null>(null);

  useEffect(() => {
    import("@/lib/browser-wallet").then(({ getBrowserWallet, getWalletBalanceSol }) => {
      const w = getBrowserWallet();
      setWallet(w);
      if (w?.address) getWalletBalanceSol(w.address).then(setBalance).catch(() => {});
    });
  }, []);

  async function execute() {
    if (!wallet) return;
    setTrading(true);
    setResult(null);
    const amount = mode === "buy" ? buyAmount : parseFloat((openSOL * sellPct / 100).toFixed(4));
    try {
      const { executeBrowserTrade, slippagePctToBps } = await import("@/lib/browser-trade");
      const { saveBrowserTrade } = await import("@/lib/browser-trade-history");
      const res = await executeBrowserTrade(wallet, address, amount, slippagePctToBps(slippage));
      saveBrowserTrade({ tokenAddress: address, alertType: "MANUAL", action: mode, amount, slippage, status: res.success ? "success" : "failed", txSig: res.txSig, message: res.message, tokenName, tokenSymbol });
      setResult(res);
      if (res.success) {
        onTraded();
        import("@/lib/browser-wallet").then(({ getWalletBalanceSol }) => getWalletBalanceSol(wallet.address).then(setBalance).catch(() => {}));
      }
    } catch (e) {
      setResult({ success: false, message: e instanceof Error ? e.message : "Trade failed" });
    } finally {
      setTrading(false);
    }
  }

  const isBuy = mode === "buy";
  const accentBuy = "bg-[#5100fd] border-[#5100fd] text-white";
  const accentSell = "bg-red-500 border-red-500 text-white";
  const accent = isBuy ? accentBuy : accentSell;
  const accentHover = isBuy ? "hover:bg-[#5100fd]/80" : "hover:bg-red-500/80";

  if (!wallet) {
    return (
      <div className="mt-4 pt-4 border-t border-zinc-900 flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">No sniper wallet. Generate one in the Dashboard to trade directly.</p>
        <a href="/dashboard" className="flex-shrink-0 px-3 py-2 rounded-xl bg-[#5100fd] text-white text-xs font-black uppercase tracking-wider">Dashboard</a>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-zinc-900">
      {/* Wallet row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-600 font-mono">{shortAddr(wallet.address)}</span>
        </div>
        <span className="text-xs font-black text-white">
          {balance !== null ? `${balance.toFixed(4)} SOL` : "— SOL"}
        </span>
      </div>

      {isBuy ? (
        <>
          {/* Size */}
          <div className="mb-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1.5">Size (SOL)</p>
            <div className="grid grid-cols-4 gap-1.5 mb-1.5">
              {[0.1, 0.5, 1, 2].map(v => (
                <button key={v} onClick={() => setBuyAmount(v)} className={`py-2 rounded-xl text-xs font-black border transition-colors ${buyAmount === v ? accentBuy : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600"}`}>{v}</button>
              ))}
            </div>
            <input type="number" min="0.01" step="0.01" value={buyAmount} onChange={e => setBuyAmount(parseFloat(e.target.value) || 0.1)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-[#5100fd] transition-colors" />
          </div>
          {/* Slippage */}
          <div className="mb-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1.5">Slippage</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[5, 10, 15, 25].map(v => (
                <button key={v} onClick={() => setSlippage(v)} className={`py-2 rounded-xl text-xs font-black border transition-colors ${slippage === v ? accentBuy : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600"}`}>{v}%</button>
              ))}
            </div>
          </div>
          <button onClick={execute} disabled={trading} className={`w-full py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#5100fd]/20 disabled:opacity-50 ${accentBuy} ${accentHover}`}>
            {trading ? <><Loader2 className="w-4 h-4 animate-spin" /> Executing…</> : <><Zap className="w-4 h-4" /> Buy {tokenSymbol ? `$${tokenSymbol}` : "Token"} · {buyAmount} SOL</>}
          </button>
        </>
      ) : (
        <>
          {/* Sell pct */}
          <div className="mb-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1.5">Sell Amount</p>
            {openSOL > 0 ? (
              <>
                <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                  {[25, 50, 75, 100].map(v => (
                    <button key={v} onClick={() => setSellPct(v)} className={`py-2 rounded-xl text-xs font-black border transition-colors ${sellPct === v ? accentSell : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600"}`}>{v}%</button>
                  ))}
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-400 text-center">
                  ≈ {fmtSOL(openSOL * sellPct / 100)} SOL of {fmtSOL(openSOL)} open
                </div>
              </>
            ) : (
              <p className="text-xs text-zinc-600 py-2">No open position found for this token.</p>
            )}
          </div>
          {/* Slippage */}
          <div className="mb-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1.5">Slippage</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[5, 10, 15, 25].map(v => (
                <button key={v} onClick={() => setSlippage(v)} className={`py-2 rounded-xl text-xs font-black border transition-colors ${slippage === v ? accentSell : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600"}`}>{v}%</button>
              ))}
            </div>
          </div>
          <button onClick={execute} disabled={trading || openSOL <= 0} className={`w-full py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${accentSell} ${accentHover}`}>
            {trading ? <><Loader2 className="w-4 h-4 animate-spin" /> Executing…</> : <>Sell {sellPct}% · {fmtSOL(openSOL * sellPct / 100)} SOL</>}
          </button>
        </>
      )}

      {result && (
        <div className={`mt-3 rounded-xl px-3 py-2.5 text-xs font-bold border ${result.success ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
          {result.success ? "✓ " : "✗ "}{result.message}
          {result.success && result.txSig && (
            <a href={`https://solscan.io/tx/${result.txSig}`} target="_blank" rel="noopener noreferrer" className="ml-2 underline text-zinc-400 font-normal">View tx</a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Alert History ────────────────────────────────────────────────────────────

function AlertHistoryCard({ address }: { address: string }) {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/alerts/events?address=${address}&limit=20`);
      const d = await res.json().catch(() => ({ events: [] }));
      if (Array.isArray(d?.events)) setEvents(d.events);
    } catch {}
    setLoading(false);
  }, [address]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5">
      <SectionHeader
        icon={<Clock className="w-4 h-4" />}
        label="Alert History"
        right={<span className="text-[10px] text-zinc-600 uppercase tracking-wider">updates every 30s</span>}
      />
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-600" /></div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <Clock className="w-8 h-8 text-zinc-800 mx-auto" />
          <p className="text-xs text-zinc-500">No alerts recorded for this token yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev, idx) => (
            <div key={ev.fingerprint || idx} className="flex flex-wrap items-center gap-2 bg-zinc-900/50 border border-zinc-900 rounded-xl px-3 py-2.5 hover:border-zinc-700 transition-colors">
              <EventBadge type={ev.type || "Alert"} />
              <span className="font-black text-white text-xs">{ev.name || ev.symbol || "—"}</span>
              {ev.change && ev.change !== "0%" && (
                <span className={`text-xs font-bold ${ev.trend === "up" ? "text-green-400" : ev.trend === "down" ? "text-red-400" : "text-zinc-400"}`}>{ev.change}</span>
              )}
              {ev.mc && ev.mc !== "N/A" && <span className="text-[10px] text-zinc-500">MC {ev.mc}</span>}
              {ev.boostAmount && ev.boostAmount > 0 ? <span className="text-[10px] text-[#5100fd] font-bold">+{ev.boostAmount} boost</span> : null}
              <span className="text-zinc-600 text-[10px] ml-auto">{formatDate(ev.alertedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Token Trade History Card ─────────────────────────────────────────────────

function TokenTradesCard({ address, tokenSymbol }: { address: string; tokenSymbol: string }) {
  const [trades, setTrades] = useState<TradeLog[]>([]);
  const [filter, setFilter] = useState<"all" | "buy" | "sell">("all");

  const reload = useCallback(() => {
    import("@/lib/browser-trade-history").then(({ getBrowserTrades }) => {
      setTrades((getBrowserTrades() as TradeLog[]).filter(t => t.tokenAddress === address));
    });
  }, [address]);

  useEffect(() => {
    reload();
    const h = () => reload();
    window.addEventListener("alertly:trade-logged", h);
    return () => window.removeEventListener("alertly:trade-logged", h);
  }, [reload]);

  if (trades.length === 0) return null;

  const totalBuy = trades.filter(t => t.action === "buy" && (t.status === "success" || t.status === "dry_run")).reduce((s, t) => s + t.amount, 0);
  const totalSell = trades.filter(t => t.action === "sell" && (t.status === "success" || t.status === "dry_run")).reduce((s, t) => s + t.amount, 0);
  const pnl = totalSell - totalBuy;
  const filtered = trades.filter(t => filter === "all" || t.action === filter);

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5">
      <SectionHeader
        icon={<BarChart2 className="w-4 h-4" />}
        label={`My Trades${tokenSymbol ? ` · $${tokenSymbol}` : ""}`}
        right={<span className={`text-xs font-black ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>P&L: {pnl >= 0 ? "+" : ""}{fmtSOL(pnl)} SOL</span>}
      />
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[["Invested", fmtSOL(totalBuy), "text-white"], ["Retrieved", fmtSOL(totalSell), "text-white"], ["Net P&L", `${pnl >= 0 ? "+" : ""}${fmtSOL(pnl)}`, pnl >= 0 ? "text-green-400" : "text-red-400"]].map(([label, value, color]) => (
          <div key={label as string} className="bg-zinc-900 rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-sm font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-zinc-600">SOL</p>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mb-3">
        {(["all", "buy", "sell"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${filter === f ? "bg-[#5100fd] text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white"}`}>{f}</button>
        ))}
      </div>
      {filtered.map(t => (
        <div key={t.id} className="flex items-center gap-3 py-3 border-b border-zinc-900 last:border-b-0 hover:bg-zinc-900/30 px-1 rounded-xl transition-colors">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex-shrink-0 ${t.action === "buy" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>{t.action}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-white">{t.tokenSymbol ? `$${t.tokenSymbol}` : shortAddr(t.tokenAddress)}</p>
            <p className="text-[10px] text-zinc-500">{(t.alertType || "MANUAL").replace(/_/g, " ")} · {timeAgo(t.createdAt)}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-black text-white">{fmtSOL(t.amount)} SOL</p>
            <p className={`text-[10px] font-bold ${t.status === "success" ? "text-green-500" : t.status === "dry_run" ? "text-yellow-500" : "text-red-400"}`}>{t.status}</p>
          </div>
          {t.txSig && (
            <a href={`https://solscan.io/tx/${t.txSig}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-zinc-600 hover:text-[#5100fd] transition-colors"><ExternalLink className="w-3.5 h-3.5" /></a>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TokenProfilePage({ params }: { params: { address: string } }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [holders, setHolders] = useState<number | null>(null);
  const [settings, setSettings] = useState<any>({ buyAmount: 0.5, slippage: 10 });
  const [tradeMode, setTradeMode] = useState<"buy" | "sell" | null>(null);
  const [openSOL, setOpenSOL] = useState(0);
  const [tradeTick, setTradeTick] = useState(0);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/token/${params.address}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);
      setProfile(data);
      setError(null);
      if (typeof data.holders === "number") setHolders(data.holders);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load token");
    } finally {
      setLoading(false);
    }
  }, [params.address]);

  // Compute open SOL position for sell mode
  useEffect(() => {
    import("@/lib/browser-trade-history").then(({ getBrowserTrades }) => {
      const all = getBrowserTrades() as TradeLog[];
      const token = all.filter(t => t.tokenAddress === params.address && (t.status === "success" || t.status === "dry_run"));
      const bought = token.filter(t => t.action === "buy").reduce((s, t) => s + t.amount, 0);
      const sold = token.filter(t => t.action === "sell").reduce((s, t) => s + t.amount, 0);
      setOpenSOL(Math.max(0, bought - sold));
    });
  }, [params.address, tradeTick]);

  useEffect(() => {
    loadProfile();
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d); }).catch(() => {});
  }, [loadProfile]);

  const pair = profile?.bestPair;
  const base = pair?.baseToken || {};
  const info = pair?.info || {};
  const allLinks = [...(Array.isArray(info.socials) ? info.socials : []), ...(Array.isArray(info.websites) ? info.websites : [])];
  const websiteUrl = allLinks.find((s: any) => s.type === "website" || s.label?.toLowerCase() === "website")?.url;
  const twitterUrl = allLinks.find((s: any) => s.type === "twitter" || s.label?.toLowerCase() === "twitter")?.url;
  const telegramUrl = allLinks.find((s: any) => s.type === "telegram" || s.label?.toLowerCase() === "telegram")?.url;

  const pairAddress = pair?.pairAddress;
  const chartUrl = pairAddress ? `https://dexscreener.com/solana/${pairAddress}?embed=1&theme=dark&trades=1&info=1` : null;
  const dexUrl = pair?.url || (pairAddress ? `https://dexscreener.com/solana/${pairAddress}` : null);
  const jupiterUrl = `https://jup.ag/swap/SOL-${params.address}`;

  const priceUsd = pair?.priceUsd ? Number(pair.priceUsd) : null;
  const change24h = pair?.priceChange?.h24;
  const changePos = Number(change24h) > 0;

  const tokenName = base.name || base.symbol || "Token";
  const tokenSymbol = base.symbol || "";
  const imageUrl = info?.imageUrl;
  const bannerUrl = info?.header;

  function toggleMode(m: "buy" | "sell") {
    setTradeMode(prev => prev === m ? null : m);
  }

  const LinkBtn = ({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-600 text-white text-[10px] font-black uppercase tracking-wider transition-colors">
      {icon}{label}
    </a>
  );

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="container mx-auto px-4 sm:px-6 pt-28 pb-16 max-w-6xl space-y-4">

        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="w-9 h-9 rounded-full border-2 border-[#5100fd] border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && error && !pair && (
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-8 text-center space-y-3">
            <p className="text-red-400 font-black uppercase tracking-widest text-xs">Unable to load token data</p>
            <p className="text-zinc-500 text-sm">{error}</p>
            <a href={jupiterUrl} target="_blank" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition-colors">
              <ExternalLink className="w-4 h-4" /> Open on Jupiter
            </a>
          </div>
        )}

        {!loading && (
          <>
            {/* ── Token Header ── */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden">

              {/* Banner */}
              {bannerUrl && (
                <div className="relative w-full h-28 overflow-hidden">
                  <img src={bannerUrl} alt="banner" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-950/80" />
                </div>
              )}

              <div className="p-5">
                {/* Top row: image + name + links + trade buttons */}
                <div className="flex items-start gap-3">
                  {/* Token image */}
                  {imageUrl ? (
                    <img src={imageUrl} alt={tokenSymbol} className={`w-14 h-14 rounded-2xl object-cover flex-shrink-0 bg-zinc-900 ${bannerUrl ? "-mt-8 ring-2 ring-zinc-900" : ""}`}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className={`w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center font-black text-2xl text-white flex-shrink-0 ${bannerUrl ? "-mt-8 ring-2 ring-zinc-900" : ""}`}>
                      {(tokenSymbol || "?")[0]}
                    </div>
                  )}

                  {/* Name + address + price + socials */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      {/* Left: name + price */}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h1 className="text-xl font-black text-white leading-tight">{tokenName}</h1>
                          {tokenSymbol && <span className="text-zinc-500 text-xs font-bold">${tokenSymbol}</span>}
                          {/* Social links inline */}
                          {dexUrl && <a href={dexUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-[#5100fd] transition-colors" title="DexScreener"><ExternalLink className="w-3.5 h-3.5" /></a>}
                          {websiteUrl && <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-white transition-colors" title="Website"><Globe className="w-3.5 h-3.5" /></a>}
                          {twitterUrl && <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-white transition-colors" title="Twitter"><Twitter className="w-3.5 h-3.5" /></a>}
                          {telegramUrl && <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-white transition-colors" title="Telegram"><Send className="w-3.5 h-3.5" /></a>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 mb-1">
                          <span className="text-[10px] font-mono text-zinc-600">{shortAddr(params.address)}</span>
                          <CopyBtn text={params.address} />
                        </div>
                        {priceUsd !== null && (
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black text-white">{fmtPrice(priceUsd)}</span>
                            {change24h !== undefined && change24h !== null && (
                              <span className={`flex items-center gap-0.5 text-sm font-black ${changePos ? "text-green-400" : "text-red-400"}`}>
                                {changePos ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                {changePos ? "+" : ""}{Number(change24h).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Buy + Sell buttons */}
                      {pair && (
                        <div className="flex gap-2 flex-shrink-0 mt-1">
                          <button
                            onClick={() => toggleMode("buy")}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border ${tradeMode === "buy" ? "bg-[#5100fd] border-[#5100fd] text-white shadow-lg shadow-[#5100fd]/20" : "bg-zinc-900 border-zinc-700 text-white hover:border-[#5100fd]/50"}`}
                          >
                            <Zap className="w-3.5 h-3.5" /> Buy <ChevronDown className={`w-3 h-3 transition-transform ${tradeMode === "buy" ? "rotate-180" : ""}`} />
                          </button>
                          <button
                            onClick={() => toggleMode("sell")}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border ${tradeMode === "sell" ? "bg-red-500 border-red-500 text-white" : "bg-zinc-900 border-zinc-700 text-white hover:border-red-500/50"}`}
                          >
                            Sell <ChevronDown className={`w-3 h-3 transition-transform ${tradeMode === "sell" ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                {pair && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                    {pair.fdv && (
                      <div className="bg-zinc-900 rounded-xl px-3 py-2.5">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1">Market Cap</p>
                        <p className="text-sm font-black text-white">${Number(pair.fdv).toLocaleString()}</p>
                      </div>
                    )}
                    {pair?.liquidity?.usd && (
                      <div className="bg-zinc-900 rounded-xl px-3 py-2.5">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1">Liquidity</p>
                        <p className="text-sm font-black text-white">${Number(pair.liquidity.usd).toLocaleString()}</p>
                      </div>
                    )}
                    <div className="bg-zinc-900 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1">{holders !== null ? "Holders" : "Pairs"}</p>
                      <p className={`text-sm font-black ${holders !== null ? "text-[#5100fd]" : "text-white"}`}>
                        {holders !== null ? (holders >= 1000 ? "1,000+" : holders.toLocaleString()) : (profile?.pairsCount || 1)}
                      </p>
                    </div>
                    {pair?.volume?.h24 && (
                      <div className="bg-zinc-900 rounded-xl px-3 py-2.5">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1">Vol 24h</p>
                        <p className="text-sm font-black text-white">${Number(pair.volume.h24).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Trade Drawer (inline, animated) */}
                {tradeMode && (
                  <TradeDrawer
                    mode={tradeMode}
                    address={params.address}
                    tokenSymbol={tokenSymbol}
                    tokenName={tokenName}
                    settings={settings}
                    openSOL={openSOL}
                    onClose={() => setTradeMode(null)}
                    onTraded={() => setTradeTick(t => t + 1)}
                  />
                )}

                {/* Bottom links row — only Jupiter left (others are inline above) */}
                {pair && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-zinc-900">
                    {dexUrl && (
                      <a href={dexUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5100fd]/10 border border-[#5100fd]/30 hover:bg-[#5100fd]/20 text-[#5100fd] text-[10px] font-black uppercase tracking-wider transition-colors">
                        <ExternalLink className="w-3 h-3" /> DexScreener
                      </a>
                    )}
                    <a href={jupiterUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-wider transition-colors">
                      <Zap className="w-3 h-3" /> Jupiter
                    </a>
                    {websiteUrl && <LinkBtn href={websiteUrl} icon={<Globe className="w-3 h-3" />} label="Website" />}
                    {twitterUrl && <LinkBtn href={twitterUrl} icon={<Twitter className="w-3 h-3" />} label="Twitter" />}
                    {telegramUrl && <LinkBtn href={telegramUrl} icon={<Send className="w-3 h-3" />} label="Telegram" />}
                  </div>
                )}

                {!pair && (
                  <div className="mt-4">
                    <p className="text-zinc-500 text-sm">No DexScreener pair found yet for this token.</p>
                    <a href={jupiterUrl} target="_blank" className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-black uppercase tracking-widest">
                      <ExternalLink className="w-4 h-4" /> Open on Jupiter
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* ── Alert History (full width) ── */}
            <AlertHistoryCard address={params.address} />

            {/* ── My Trades for this token ── */}
            <TokenTradesCard address={params.address} tokenSymbol={tokenSymbol} />

            {/* ── DexScreener Chart ── */}
            {chartUrl && (
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden">
                <iframe src={chartUrl} width="100%" height="660" className="block" loading="lazy" />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
