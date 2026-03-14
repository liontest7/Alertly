"use client";

import { useEffect, useState, useCallback } from "react";
import { ExternalLink, Copy, Check, Zap, Globe, Twitter, Send, Clock, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";

type TokenProfileResponse = {
  address: string;
  bestPair: any;
  pairsCount: number;
  pairs: any[];
  message?: string;
};

type AlertEvent = {
  fingerprint?: string;
  type?: string;
  name?: string;
  symbol?: string;
  change?: string;
  trend?: string;
  alertedAt?: string;
  mc?: string;
  liquidity?: string;
  boostAmount?: number;
};

type TradeLog = {
  id: string;
  tokenAddress: string;
  action: "buy" | "sell";
  amount: number;
  slippage: number;
  status: "success" | "failed" | "dry_run";
  txSig?: string | null;
  message?: string | null;
  createdAt: string;
  tokenName?: string;
  tokenSymbol?: string;
};

function shortAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-zinc-500 hover:text-white transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-zinc-900/60 border border-zinc-800 rounded-xl px-4 py-2.5 min-w-[90px]">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{label}</span>
      <span className={`text-sm font-black ${color || "text-white"}`}>{value}</span>
    </div>
  );
}

function EventTypeBadge({ type }: { type: string }) {
  const upper = (type || "").toUpperCase().replace(/ /g, "_");
  const isBoost = upper.includes("BOOST");
  const isListing = upper.includes("LISTING");
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
      isBoost ? "bg-[#5100fd] text-white" : isListing ? "bg-blue-600 text-white" : "bg-zinc-700 text-zinc-200"
    }`}>
      {isBoost ? "DEX BOOST" : isListing ? "DEX LISTING" : type}
    </span>
  );
}

function QuickTradePanel({ address, tokenName, tokenSymbol, settings }: { address: string; tokenName: string; tokenSymbol: string; settings: any }) {
  const [wallet, setWallet] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [buyAmount, setBuyAmount] = useState(settings?.buyAmount ?? 0.5);
  const [slippage, setSlippage] = useState(settings?.slippage ?? 10);
  const [trading, setTrading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; txSig?: string } | null>(null);

  useEffect(() => {
    import("@/lib/browser-wallet").then(({ getBrowserWallet, getWalletBalanceSol }) => {
      const w = getBrowserWallet();
      setWallet(w);
      if (w?.address) {
        getWalletBalanceSol(w.address).then(setBalance).catch(() => {});
      }
    });
  }, []);

  const executeTrade = async () => {
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
      setResult({ success: false, message: e instanceof Error ? e.message : "Trade failed" });
    } finally {
      setTrading(false);
    }
  };

  if (!wallet) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-3">
        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Quick Buy</h3>
        <p className="text-zinc-500 text-xs">No sniper wallet found. Generate one in the Dashboard to trade directly.</p>
        <a href="/dashboard" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5100fd] text-white text-xs font-bold hover:bg-[#5100fd]/80 transition-colors">
          <Zap className="w-3.5 h-3.5" /> Go to Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-[#5100fd]">Quick Buy</h3>
        <span className="text-[10px] text-zinc-500 font-mono">{shortAddr(wallet.address)}</span>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 flex items-center justify-between">
        <span className="text-[11px] text-zinc-400">Wallet Balance</span>
        <span className="text-sm font-black text-white">{balance !== null ? `${balance.toFixed(4)} SOL` : "—"}</span>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Amount (SOL)</label>
        <div className="flex gap-1.5">
          {[0.1, 0.5, 1].map(v => (
            <button key={v} onClick={() => setBuyAmount(v)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${buyAmount === v ? "bg-[#5100fd] border-[#5100fd] text-white" : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
              {v}
            </button>
          ))}
          <input
            type="number" min="0.01" step="0.01" value={buyAmount}
            onChange={e => setBuyAmount(parseFloat(e.target.value) || 0.1)}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2 text-xs text-white text-center focus:outline-none focus:border-[#5100fd]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Slippage %</label>
        <div className="flex gap-1.5">
          {[5, 10, 25].map(v => (
            <button key={v} onClick={() => setSlippage(v)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${slippage === v ? "bg-[#5100fd] border-[#5100fd] text-white" : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
              {v}%
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={executeTrade}
        disabled={trading || !wallet}
        className="w-full py-3 rounded-xl bg-[#5100fd] hover:bg-[#5100fd]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm transition-colors flex items-center justify-center gap-2"
      >
        {trading ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> Executing…</>
        ) : (
          <><Zap className="w-4 h-4" /> Buy {tokenSymbol || "Token"}</>
        )}
      </button>

      {result && (
        <div className={`rounded-xl px-3 py-2 text-xs font-bold ${result.success ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
          {result.success ? "✓ " : "✗ "}{result.message}
          {result.success && result.txSig && (
            <a href={`https://solscan.io/tx/${result.txSig}`} target="_blank" className="ml-2 underline text-zinc-400 font-normal">
              View tx
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function TradeHistoryPanel({ address }: { address: string }) {
  const [trades, setTrades] = useState<TradeLog[]>([]);

  useEffect(() => {
    import("@/lib/browser-trade-history").then(({ getBrowserTrades }) => {
      const all = getBrowserTrades();
      setTrades(all.filter(t => t.tokenAddress === address));
    });

    const handler = () => {
      import("@/lib/browser-trade-history").then(({ getBrowserTrades }) => {
        const all = getBrowserTrades();
        setTrades(all.filter((t: TradeLog) => t.tokenAddress === address));
      });
    };
    window.addEventListener("alertly:trade-logged", handler);
    return () => window.removeEventListener("alertly:trade-logged", handler);
  }, [address]);

  if (trades.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-3">
      <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Your Trades</h3>
      <div className="space-y-2">
        {trades.map(t => (
          <div key={t.id} className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs">
            <span className={`font-black uppercase w-8 ${t.action === "buy" ? "text-green-400" : "text-red-400"}`}>{t.action}</span>
            <span className="text-white font-bold">{t.amount} SOL</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.status === "success" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
              {t.status}
            </span>
            <span className="text-zinc-500 ml-auto">{formatDate(t.createdAt)}</span>
            {t.txSig && (
              <a href={`https://solscan.io/tx/${t.txSig}`} target="_blank" className="text-zinc-500 hover:text-white transition-colors">
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TokenProfilePage({ params }: { params: { address: string } }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<TokenProfileResponse | null>(null);
  const [events, setEvents] = useState<AlertEvent[]>([]);
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

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/alerts/events?address=${params.address}&limit=20`);
      const data = await res.json().catch(() => ({ events: [] }));
      if (Array.isArray(data?.events)) setEvents(data.events);
    } catch {}
  }, [params.address]);

  useEffect(() => {
    loadProfile();
    loadEvents();
    fetch("/api/settings").then(r => r.ok ? r.json() : null).then(d => { if (d) setSettings(d); }).catch(() => {});

    const eventsInterval = setInterval(loadEvents, 30000);
    return () => clearInterval(eventsInterval);
  }, [loadProfile, loadEvents]);

  const pair = profile?.bestPair;
  const base = pair?.baseToken || {};
  const info = pair?.info || {};
  const socials: any[] = Array.isArray(info.socials) ? info.socials : [];
  const links: any[] = [...(Array.isArray(info.websites) ? info.websites : []), ...(Array.isArray(info.links) ? info.links : [])];
  const allLinks = [...socials, ...links];
  const websiteUrl = allLinks.find((s: any) => s.type === "website" || s.label?.toLowerCase() === "website")?.url;
  const twitterUrl = allLinks.find((s: any) => s.type === "twitter" || s.label?.toLowerCase() === "twitter")?.url;
  const telegramUrl = allLinks.find((s: any) => s.type === "telegram" || s.label?.toLowerCase() === "telegram")?.url;

  const pairAddress = pair?.pairAddress;
  const chartUrl = pairAddress ? `https://dexscreener.com/solana/${pairAddress}?embed=1&theme=dark&trades=1&info=1` : null;
  const dexUrl = pair?.url || (pairAddress ? `https://dexscreener.com/solana/${pairAddress}` : null);
  const jupiterUrl = `https://jup.ag/swap/SOL-${params.address}`;

  const priceUsd = pair?.priceUsd ? `$${Number(pair.priceUsd).toPrecision(4)}` : null;
  const change24h = pair?.priceChange?.h24;
  const changeColor = change24h > 0 ? "text-green-400" : change24h < 0 ? "text-red-400" : "text-zinc-400";
  const ChangIcon = change24h > 0 ? TrendingUp : change24h < 0 ? TrendingDown : Minus;

  const tokenName = base.name || base.symbol || "Token";
  const tokenSymbol = base.symbol || "";
  const imageUrl = info?.imageUrl || (params.address ? `https://dd.dexscreener.com/ds-data/tokens/solana/${params.address}.png` : null);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="container mx-auto px-4 sm:px-6 pt-28 pb-16 space-y-4 max-w-6xl">

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-[#5100fd] border-t-transparent animate-spin" />
          </div>
        ) : error && !pair ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center space-y-3">
            <p className="text-red-400 font-bold">Unable to load token data</p>
            <p className="text-zinc-500 text-sm">{error}</p>
            <a href={jupiterUrl} target="_blank" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 text-white text-sm font-bold hover:bg-zinc-700 transition-colors">
              <ExternalLink className="w-4 h-4" /> Open on Jupiter
            </a>
          </div>
        ) : (
          <>
            {/* ── Header ── */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex items-start gap-4">
                {imageUrl ? (
                  <img src={imageUrl} alt={tokenSymbol} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0 bg-zinc-900" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center font-black text-xl flex-shrink-0">{tokenSymbol[0] || "?"}</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-black truncate">{tokenName}</h1>
                    {tokenSymbol && <span className="text-zinc-500 text-sm font-bold">${tokenSymbol}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-zinc-500 text-xs font-mono">{shortAddr(params.address)}</span>
                    <CopyButton text={params.address} />
                  </div>
                  {priceUsd && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-white font-black">{priceUsd}</span>
                      {change24h !== undefined && (
                        <span className={`flex items-center gap-0.5 text-sm font-bold ${changeColor}`}>
                          <ChangIcon className="w-3.5 h-3.5" />
                          {change24h > 0 ? "+" : ""}{Number(change24h).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Key stats — minimal since chart shows everything */}
              {pair && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {pair.fdv && <StatPill label="Market Cap" value={`$${Number(pair.fdv).toLocaleString()}`} />}
                  {pair?.liquidity?.usd && <StatPill label="Liquidity" value={`$${Number(pair.liquidity.usd).toLocaleString()}`} />}
                  {holders != null && <StatPill label="Holders" value={holders >= 1000 ? "1,000+" : holders.toLocaleString()} color="text-[#5100fd]" />}
                  <StatPill label="Pairs" value={String(profile?.pairsCount || 1)} />
                </div>
              )}

              {/* Action links */}
              <div className="flex flex-wrap gap-2 mt-4">
                {dexUrl && (
                  <a href={dexUrl} target="_blank" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5100fd] hover:bg-[#5100fd]/80 text-white text-xs font-bold transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> DexScreener
                  </a>
                )}
                <a href={jupiterUrl} target="_blank" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors">
                  <Zap className="w-3.5 h-3.5" /> Jupiter
                </a>
                {websiteUrl && (
                  <a href={websiteUrl} target="_blank" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors">
                    <Globe className="w-3.5 h-3.5" /> Website
                  </a>
                )}
                {twitterUrl && (
                  <a href={twitterUrl} target="_blank" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors">
                    <Twitter className="w-3.5 h-3.5" /> Twitter
                  </a>
                )}
                {telegramUrl && (
                  <a href={telegramUrl} target="_blank" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors">
                    <Send className="w-3.5 h-3.5" /> Telegram
                  </a>
                )}
              </div>
            </div>

            {/* ── Main grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Alert events */}
              <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#5100fd]" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-zinc-300">Alert History</h2>
                  <span className="ml-auto text-[10px] text-zinc-600">Updates every 30s</span>
                </div>
                {events.length === 0 ? (
                  <p className="text-zinc-600 text-sm">No alerts recorded for this token yet.</p>
                ) : (
                  <div className="space-y-2">
                    {events.map((ev, idx) => (
                      <div key={ev.fingerprint || idx} className="flex flex-wrap items-center gap-2 bg-zinc-900/40 border border-zinc-800/60 rounded-xl px-3 py-2.5 text-xs">
                        <EventTypeBadge type={ev.type || "Alert"} />
                        <span className="font-bold text-white">{ev.name || ev.symbol || "—"}</span>
                        {ev.change && ev.change !== "0%" && (
                          <span className={ev.trend === "up" ? "text-green-400 font-bold" : ev.trend === "down" ? "text-red-400 font-bold" : "text-zinc-400"}>
                            {ev.change}
                          </span>
                        )}
                        {ev.mc && ev.mc !== "N/A" && <span className="text-zinc-500">MC {ev.mc}</span>}
                        <span className="text-zinc-600 ml-auto">{formatDate(ev.alertedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick trade */}
              <div className="space-y-4">
                <QuickTradePanel
                  address={params.address}
                  tokenName={tokenName}
                  tokenSymbol={tokenSymbol}
                  settings={settings}
                />
                <TradeHistoryPanel address={params.address} />
              </div>
            </div>

            {/* ── DexScreener chart ── */}
            {chartUrl && (
              <div className="rounded-2xl border border-zinc-800 overflow-hidden">
                <iframe
                  src={chartUrl}
                  width="100%"
                  height="640"
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
