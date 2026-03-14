"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ExternalLink, Copy, Check, Zap, Globe, Twitter, Send,
  Clock, TrendingUp, TrendingDown, Minus, Loader2, BarChart2,
  RefreshCw, ChevronDown, ChevronUp, AlertTriangle,
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

function shortAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtSOL(n: number) {
  return n.toFixed(4);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-zinc-500 hover:text-white transition-colors"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[#5100fd]">{icon}</span>
      <h2 className="text-xs font-black uppercase tracking-widest text-white">{label}</h2>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

// ─── Event Type Badge ─────────────────────────────────────────────────────────

function EventBadge({ type }: { type: string }) {
  const upper = (type || "").toUpperCase();
  const isBoost = upper.includes("BOOST");
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
        isBoost
          ? "bg-[#5100fd] text-white"
          : "bg-blue-600/90 text-white"
      }`}
    >
      {isBoost ? "DEX BOOST" : "DEX LISTING"}
    </span>
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
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5">
      <SectionHeader
        icon={<Clock className="w-4 h-4" />}
        label="Alert History"
        right={
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
            updates every 30s
          </span>
        }
      />

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8">
          <Clock className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
          <p className="text-xs text-zinc-500">No alerts recorded for this token yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev, idx) => (
            <div
              key={ev.fingerprint || idx}
              className="flex flex-wrap items-center gap-2 bg-zinc-900/50 border border-zinc-900 rounded-xl px-3 py-2.5 hover:border-zinc-700 transition-colors"
            >
              <EventBadge type={ev.type || "Alert"} />
              <span className="font-black text-white text-xs">
                {ev.name || ev.symbol || "—"}
              </span>
              {ev.change && ev.change !== "0%" && (
                <span
                  className={`text-xs font-bold ${
                    ev.trend === "up"
                      ? "text-green-400"
                      : ev.trend === "down"
                      ? "text-red-400"
                      : "text-zinc-400"
                  }`}
                >
                  {ev.change}
                </span>
              )}
              {ev.mc && ev.mc !== "N/A" && (
                <span className="text-[10px] text-zinc-500">MC {ev.mc}</span>
              )}
              {ev.boostAmount && ev.boostAmount > 0 ? (
                <span className="text-[10px] text-[#5100fd] font-bold">
                  +{ev.boostAmount} boost
                </span>
              ) : null}
              <span className="text-zinc-600 text-[10px] ml-auto">
                {formatDate(ev.alertedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Trade Row (matches TradesPanel HistoryRow style exactly) ─────────────────

function TradeRow({ t }: { t: TradeLog }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-zinc-900 last:border-b-0 hover:bg-zinc-900/30 px-1 rounded-xl transition-colors">
      <div className="flex-shrink-0">
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
            t.action === "buy"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {t.action}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-white">
          {t.tokenSymbol ? `$${t.tokenSymbol}` : shortAddr(t.tokenAddress)}
        </p>
        <p className="text-[10px] text-zinc-500">
          {(t.alertType || "MANUAL").replace(/_/g, " ")} · {timeAgo(t.createdAt)}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-black text-white">{fmtSOL(t.amount)} SOL</p>
        <p
          className={`text-[10px] font-bold ${
            t.status === "success"
              ? "text-green-500"
              : t.status === "dry_run"
              ? "text-yellow-500"
              : "text-red-400"
          }`}
        >
          {t.status}
        </p>
      </div>
      {t.txSig && (
        <a
          href={`https://solscan.io/tx/${t.txSig}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-zinc-500 hover:text-[#5100fd] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}

// ─── Token Trades Card ────────────────────────────────────────────────────────

function TokenTradesCard({
  address,
  tokenSymbol,
}: {
  address: string;
  tokenSymbol: string;
}) {
  const [trades, setTrades] = useState<TradeLog[]>([]);
  const [filter, setFilter] = useState<"all" | "buy" | "sell">("all");

  const reload = useCallback(() => {
    import("@/lib/browser-trade-history").then(({ getBrowserTrades }) => {
      const all = getBrowserTrades() as TradeLog[];
      setTrades(all.filter((t) => t.tokenAddress === address));
    });
  }, [address]);

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener("alertly:trade-logged", handler);
    return () => window.removeEventListener("alertly:trade-logged", handler);
  }, [reload]);

  if (trades.length === 0) return null;

  const totalBuy = trades
    .filter((t) => t.action === "buy" && (t.status === "success" || t.status === "dry_run"))
    .reduce((s, t) => s + t.amount, 0);
  const totalSell = trades
    .filter((t) => t.action === "sell" && (t.status === "success" || t.status === "dry_run"))
    .reduce((s, t) => s + t.amount, 0);
  const pnl = totalSell - totalBuy;

  const filtered = trades.filter(
    (t) => filter === "all" || t.action === filter
  );

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5">
      <SectionHeader
        icon={<BarChart2 className="w-4 h-4" />}
        label={`My Trades${tokenSymbol ? ` · $${tokenSymbol}` : ""}`}
        right={
          <span
            className={`text-xs font-black ${
              pnl >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            P&L: {pnl >= 0 ? "+" : ""}{fmtSOL(pnl)} SOL
          </span>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-zinc-900 rounded-xl p-3 text-center">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Invested</p>
          <p className="text-sm font-black text-white">{fmtSOL(totalBuy)}</p>
          <p className="text-[10px] text-zinc-600">SOL</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-3 text-center">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Retrieved</p>
          <p className="text-sm font-black text-white">{fmtSOL(totalSell)}</p>
          <p className="text-[10px] text-zinc-600">SOL</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-3 text-center">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Net P&L</p>
          <p className={`text-sm font-black ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {pnl >= 0 ? "+" : ""}{fmtSOL(pnl)}
          </p>
          <p className="text-[10px] text-zinc-600">SOL</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-3">
        {(["all", "buy", "sell"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
              filter === f
                ? "bg-[#5100fd] text-white"
                : "bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div>
        {filtered.map((t) => (
          <TradeRow key={t.id} t={t} />
        ))}
      </div>
    </div>
  );
}

// ─── Quick Buy Panel ──────────────────────────────────────────────────────────

function QuickBuyPanel({
  address,
  tokenName,
  tokenSymbol,
  settings,
}: {
  address: string;
  tokenName: string;
  tokenSymbol: string;
  settings: any;
}) {
  const [wallet, setWallet] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const [buyAmount, setBuyAmount] = useState<number>(settings?.buyAmount ?? 0.5);
  const [slippage, setSlippage] = useState<number>(settings?.slippage ?? 10);
  const [trading, setTrading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    txSig?: string;
  } | null>(null);

  useEffect(() => {
    import("@/lib/browser-wallet").then(({ getBrowserWallet, getWalletBalanceSol }) => {
      const w = getBrowserWallet();
      setWallet(w);
      if (w?.address) {
        setLoadingBal(true);
        getWalletBalanceSol(w.address)
          .then(setBalance)
          .catch(() => {})
          .finally(() => setLoadingBal(false));
      }
    });
  }, []);

  async function executeTrade() {
    if (!wallet) return;
    setTrading(true);
    setResult(null);
    try {
      const { executeBrowserTrade, slippagePctToBps } = await import("@/lib/browser-trade");
      const { saveBrowserTrade } = await import("@/lib/browser-trade-history");
      const res = await executeBrowserTrade(wallet, address, buyAmount, slippagePctToBps(slippage));
      saveBrowserTrade({
        tokenAddress: address,
        alertType: "MANUAL",
        action: "buy",
        amount: buyAmount,
        slippage,
        status: res.success ? "success" : "failed",
        txSig: res.txSig,
        message: res.message,
        tokenName,
        tokenSymbol,
      });
      setResult(res);
      if (res.success) {
        import("@/lib/browser-wallet").then(({ getWalletBalanceSol }) => {
          getWalletBalanceSol(wallet.address).then(setBalance).catch(() => {});
        });
      }
    } catch (e) {
      setResult({
        success: false,
        message: e instanceof Error ? e.message : "Trade failed",
      });
    } finally {
      setTrading(false);
    }
  }

  if (!wallet) {
    return (
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5">
        <SectionHeader
          icon={<Zap className="w-4 h-4" />}
          label="Quick Buy"
        />
        <div className="text-center py-4 space-y-3">
          <AlertTriangle className="w-8 h-8 text-zinc-700 mx-auto" />
          <p className="text-xs text-zinc-400">
            No sniper wallet found. Generate one in the Dashboard to trade directly.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#5100fd] text-white text-xs font-black uppercase tracking-widest hover:bg-[#5100fd]/80 transition-colors"
          >
            <Zap className="w-3.5 h-3.5" /> Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5">
      <SectionHeader
        icon={<Zap className="w-4 h-4" />}
        label="Quick Buy"
      />

      {/* Wallet balance */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-black mb-0.5">
            Wallet Balance
          </p>
          <p className="text-[10px] font-mono text-zinc-600">{shortAddr(wallet.address)}</p>
        </div>
        <p className="text-base font-black text-white">
          {loadingBal ? (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
          ) : balance !== null ? (
            `${balance.toFixed(4)} SOL`
          ) : (
            "— SOL"
          )}
        </p>
      </div>

      {/* Size presets */}
      <div className="mb-3">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-2">
          Size
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {[0.1, 0.5, 1, 2].map((v) => (
            <button
              key={v}
              onClick={() => setBuyAmount(v)}
              className={`py-2 rounded-xl text-xs font-black transition-colors border ${
                buyAmount === v
                  ? "bg-[#5100fd] border-[#5100fd] text-white"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={buyAmount}
            onChange={(e) => setBuyAmount(parseFloat(e.target.value) || 0.1)}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-[#5100fd] transition-colors"
            placeholder="Custom SOL"
          />
          <span className="text-[10px] text-zinc-600 font-bold">SOL</span>
        </div>
      </div>

      {/* Slippage */}
      <div className="mb-4">
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-2">
          Slip
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {[5, 10, 15, 25].map((v) => (
            <button
              key={v}
              onClick={() => setSlippage(v)}
              className={`py-2 rounded-xl text-xs font-black transition-colors border ${
                slippage === v
                  ? "bg-[#5100fd] border-[#5100fd] text-white"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white"
              }`}
            >
              {v}%
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={executeTrade}
        disabled={trading}
        className="w-full py-3 rounded-xl bg-[#5100fd] hover:bg-[#5100fd]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#5100fd]/20"
      >
        {trading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Executing…
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" /> Buy {tokenSymbol ? `$${tokenSymbol}` : "Token"} ·{" "}
            {buyAmount} SOL
          </>
        )}
      </button>

      {result && (
        <div
          className={`mt-3 rounded-xl px-3 py-2.5 text-xs font-bold border ${
            result.success
              ? "bg-green-500/10 border-green-500/20 text-green-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          {result.success ? "✓ " : "✗ "}
          {result.message}
          {result.success && result.txSig && (
            <a
              href={`https://solscan.io/tx/${result.txSig}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 underline text-zinc-400 font-normal"
            >
              View tx
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TokenProfilePage({
  params,
}: {
  params: { address: string };
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [holders, setHolders] = useState<number | null>(null);
  const [settings, setSettings] = useState<any>({ buyAmount: 0.5, slippage: 10 });

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

  useEffect(() => {
    loadProfile();
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setSettings(d); })
      .catch(() => {});
  }, [loadProfile]);

  // Derived token data
  const pair = profile?.bestPair;
  const base = pair?.baseToken || {};
  const info = pair?.info || {};
  const socials: any[] = Array.isArray(info.socials) ? info.socials : [];
  const infoLinks: any[] = Array.isArray(info.websites) ? info.websites : [];
  const allLinks = [...socials, ...infoLinks];
  const websiteUrl = allLinks.find(
    (s: any) => s.type === "website" || s.label?.toLowerCase() === "website"
  )?.url;
  const twitterUrl = allLinks.find(
    (s: any) => s.type === "twitter" || s.label?.toLowerCase() === "twitter"
  )?.url;
  const telegramUrl = allLinks.find(
    (s: any) => s.type === "telegram" || s.label?.toLowerCase() === "telegram"
  )?.url;

  const pairAddress = pair?.pairAddress;
  const chartUrl = pairAddress
    ? `https://dexscreener.com/solana/${pairAddress}?embed=1&theme=dark&trades=1&info=1`
    : null;
  const dexUrl =
    pair?.url ||
    (pairAddress ? `https://dexscreener.com/solana/${pairAddress}` : null);
  const jupiterUrl = `https://jup.ag/swap/SOL-${params.address}`;

  const priceUsd = pair?.priceUsd ? Number(pair.priceUsd) : null;
  const change24h = pair?.priceChange?.h24;
  const changePos = change24h > 0;
  const changeZero = change24h === undefined || change24h === null;

  const tokenName = base.name || base.symbol || "Token";
  const tokenSymbol = base.symbol || "";
  const imageUrl = info?.imageUrl;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="container mx-auto px-4 sm:px-6 pt-28 pb-16 max-w-6xl space-y-4">

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="w-9 h-9 rounded-full border-2 border-[#5100fd] border-t-transparent animate-spin" />
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && !pair && (
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-8 text-center space-y-3">
            <p className="text-red-400 font-black uppercase tracking-widest text-xs">
              Unable to load token data
            </p>
            <p className="text-zinc-500 text-sm">{error}</p>
            <a
              href={jupiterUrl}
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> Open on Jupiter
            </a>
          </div>
        )}

        {/* ── Content ── */}
        {!loading && (
          <>
            {/* ── Token Header ── */}
            {pair ? (
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  {/* Image */}
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={tokenSymbol}
                      className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 bg-zinc-900"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center font-black text-2xl text-white flex-shrink-0">
                      {(tokenSymbol || "?")[0]}
                    </div>
                  )}

                  {/* Name + price */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h1 className="text-2xl font-black text-white leading-tight">
                        {tokenName}
                      </h1>
                      {tokenSymbol && (
                        <span className="text-zinc-500 text-sm font-bold">
                          ${tokenSymbol}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-mono text-zinc-600">
                        {shortAddr(params.address)}
                      </span>
                      <CopyButton text={params.address} />
                    </div>

                    {priceUsd !== null && (
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-white">
                          ${priceUsd < 0.000001
                            ? priceUsd.toExponential(2)
                            : priceUsd < 0.001
                            ? priceUsd.toFixed(8).replace(/0+$/, "")
                            : priceUsd < 1
                            ? priceUsd.toPrecision(4)
                            : priceUsd.toLocaleString()}
                        </span>
                        {!changeZero && (
                          <span
                            className={`flex items-center gap-1 text-sm font-black ${
                              changePos ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {changePos ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : (
                              <TrendingDown className="w-4 h-4" />
                            )}
                            {changePos ? "+" : ""}
                            {Number(change24h).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
                  {pair.fdv && (
                    <div className="bg-zinc-900 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1">
                        Market Cap
                      </p>
                      <p className="text-sm font-black text-white">
                        ${Number(pair.fdv).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {pair?.liquidity?.usd && (
                    <div className="bg-zinc-900 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1">
                        Liquidity
                      </p>
                      <p className="text-sm font-black text-white">
                        ${Number(pair.liquidity.usd).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {holders !== null ? (
                    <div className="bg-zinc-900 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1">
                        Holders
                      </p>
                      <p className="text-sm font-black text-[#5100fd]">
                        {holders >= 1000 ? "1,000+" : holders.toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-zinc-900 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1">
                        Pairs
                      </p>
                      <p className="text-sm font-black text-white">
                        {profile?.pairsCount || 1}
                      </p>
                    </div>
                  )}
                  {pair?.volume?.h24 && (
                    <div className="bg-zinc-900 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-1">
                        Vol 24h
                      </p>
                      <p className="text-sm font-black text-white">
                        ${Number(pair.volume.h24).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action links */}
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-zinc-900">
                  {dexUrl && (
                    <a
                      href={dexUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5100fd] hover:bg-[#5100fd]/80 text-white text-xs font-black uppercase tracking-widest transition-colors shadow-lg shadow-[#5100fd]/20"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> DexScreener
                    </a>
                  )}
                  <a
                    href={jupiterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-widest transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" /> Jupiter
                  </a>
                  {websiteUrl && (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-widest transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" /> Website
                    </a>
                  )}
                  {twitterUrl && (
                    <a
                      href={twitterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-widest transition-colors"
                    >
                      <Twitter className="w-3.5 h-3.5" /> Twitter
                    </a>
                  )}
                  {telegramUrl && (
                    <a
                      href={telegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-xs font-black uppercase tracking-widest transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" /> Telegram
                    </a>
                  )}
                </div>
              </div>
            ) : (
              /* no pair found but still show error-less state */
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
                <p className="text-zinc-500 text-sm">
                  No DexScreener pair found yet for this token.
                </p>
                <a
                  href={jupiterUrl}
                  target="_blank"
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-black uppercase tracking-widest"
                >
                  <ExternalLink className="w-4 h-4" /> Open on Jupiter
                </a>
              </div>
            )}

            {/* ── Middle: Alert history + Quick buy ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <AlertHistoryCard address={params.address} />
              </div>
              <div>
                <QuickBuyPanel
                  address={params.address}
                  tokenName={tokenName}
                  tokenSymbol={tokenSymbol}
                  settings={settings}
                />
              </div>
            </div>

            {/* ── Token trade history (only if trades exist) ── */}
            <TokenTradesCard
              address={params.address}
              tokenSymbol={tokenSymbol}
            />

            {/* ── DexScreener chart ── */}
            {chartUrl && (
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden">
                <iframe
                  src={chartUrl}
                  width="100%"
                  height="660"
                  className="block"
                  loading="lazy"
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
