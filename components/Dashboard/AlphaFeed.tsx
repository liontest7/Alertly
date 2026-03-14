"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Volume2, VolumeX, Zap, ExternalLink, Bell, BellOff, Trash2, Bot } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

function FilterChip({ label, active = false, onClick }: { label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-all duration-200 shadow-sm ${
      active 
        ? 'bg-[#5100fd] border-[#5100fd] text-white shadow-[#5100fd]/20' 
        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 hover:bg-zinc-900'
    }`}>
      {label}
    </button>
  )
}

const TYPE_COLORS: Record<string, string> = {
  "DEX BOOST": "bg-[#5100fd] text-white",
  "DEX_BOOST": "bg-[#5100fd] text-white",
  "DEX LISTING": "bg-blue-600 text-white",
  "DEX_LISTING": "bg-blue-600 text-white",
}

const TYPE_LABELS: Record<string, string> = {
  "DEX_BOOST": "DEX BOOST",
  "DEX_LISTING": "DEX LISTING",
}

const FILTER_CHIPS = [
  { key: "All", label: "All" },
  { key: "DEX BOOST", label: "DEX Boost" },
  { key: "DEX LISTING", label: "DEX Listing" },
]

function shortAddr(addr?: string) {
  if (!addr) return ""
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

function normalizeType(raw: string): string {
  const upper = (raw || "").toUpperCase();
  return TYPE_LABELS[upper] || upper.replace(/_/g, " ");
}

export function AlphaFeed({ 
  alerts, 
  loading, 
  settings, 
  user,
  alertsEnabled,
  onToggleAlerts,
  togglingAlerts,
  onClearFeed,
}: { 
  alerts: any[], 
  loading: boolean, 
  settings: any, 
  user: any,
  alertsEnabled?: boolean,
  onToggleAlerts?: () => void,
  togglingAlerts?: boolean,
  onClearFeed?: () => void,
}) {
  const router = useRouter();
  const [executing, setExecuting] = useState<string | null>(null);
  const [autoTrading, setAutoTrading] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastAlertCount, setLastAlertCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [tradeToast, setTradeToast] = useState<{ message: string; success: boolean } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTradedRef = useRef<Set<string>>(new Set());
  const prevAlertsRef = useRef<any[]>([]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showTradeToast = (message: string, success: boolean) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setTradeToast({ message, success });
    toastTimerRef.current = setTimeout(() => setTradeToast(null), 5000);
  };
  
  useEffect(() => {
    if (alerts.length > lastAlertCount && soundEnabled && lastAlertCount > 0) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const now = audioContext.currentTime;
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } catch {
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        } catch {}
      }
    }
    setLastAlertCount(alerts.length);
  }, [alerts.length, soundEnabled, lastAlertCount]);

  useEffect(() => {
    if (!settings?.autoTrade) {
      prevAlertsRef.current = alerts;
      return;
    }
    const newAlerts = alerts.filter(a =>
      !prevAlertsRef.current.some((p: any) => p.address === a.address && p.type === a.type)
    );
    prevAlertsRef.current = alerts;
    if (newAlerts.length === 0) return;

    (async () => {
      const { getBrowserWallet } = await import("@/lib/browser-wallet");
      const { executeBrowserTrade, slippagePctToBps } = await import("@/lib/browser-trade");
      const bwallet = getBrowserWallet();
      if (!bwallet) return;

      for (const alert of newAlerts) {
        if (!alert.address) continue;
        const key = `${alert.address}|${alert.type}`;
        if (autoTradedRef.current.has(key)) continue;
        autoTradedRef.current.add(key);

        setAutoTrading(alert.address);
        const result = await executeBrowserTrade(
          bwallet,
          alert.address,
          settings.buyAmount ?? 0.5,
          slippagePctToBps(settings.slippage ?? 10),
        );
        setAutoTrading(null);

        const { saveBrowserTrade } = await import("@/lib/browser-trade-history");
        saveBrowserTrade({
          tokenAddress: alert.address,
          alertType: alert.type || "UNKNOWN",
          action: "buy",
          amount: settings.buyAmount ?? 0.5,
          slippage: settings.slippage ?? 10,
          status: result.success ? "success" : "failed",
          txSig: result.txSig,
          message: result.message,
          tokenName: alert.name,
          tokenSymbol: alert.symbol,
        });
      }
    })().catch(() => { setAutoTrading(null); });
  }, [alerts, settings?.autoTrade, settings?.buyAmount, settings?.slippage]);


  const dailyAlerts = alerts.filter(a => {
    const ts = a.clientSeenAt || a.alertedAt;
    const alertTime = ts ? new Date(ts).getTime() : 0;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return alertTime > oneDayAgo;
  }).length;

  const filteredAlerts = activeFilter === 'All' 
    ? alerts 
    : alerts.filter(a => {
        const type = normalizeType(a.type);
        return type === activeFilter.toUpperCase();
      });

  const handleQuickBuy = async (token: any) => {
    if (!token.address) {
      showTradeToast("This alert does not have a valid token address.", false);
      return
    }
    const { getBrowserWallet } = await import("@/lib/browser-wallet");
    const bwallet = getBrowserWallet();
    if (!bwallet) {
      showTradeToast("No trading wallet found. Generate or import a wallet in the Sniper Configuration panel first.", false);
      return
    }
    const tokenName = token.symbol || token.name || shortAddr(token.address)
    setExecuting(token.address)
    try {
      const { executeBrowserTrade, slippagePctToBps } = await import("@/lib/browser-trade");
      const result = await executeBrowserTrade(
        bwallet,
        token.address,
        settings.buyAmount ?? 0.5,
        slippagePctToBps(settings.slippage ?? 10),
      )
      const { saveBrowserTrade } = await import("@/lib/browser-trade-history");
      saveBrowserTrade({
        tokenAddress: token.address,
        alertType: token.type || "MANUAL",
        action: "buy",
        amount: settings.buyAmount ?? 0.5,
        slippage: settings.slippage ?? 10,
        status: result.success ? "success" : "failed",
        txSig: result.txSig,
        message: result.message,
        tokenName: token.name,
        tokenSymbol: token.symbol,
      });
      if (result.success) {
        showTradeToast(`Bought ${tokenName} — Tx: ${result.txSig?.substring(0, 16)}...`, true);
      } else {
        showTradeToast(`Trade failed: ${result.message}`, false);
      }
    } catch {
      showTradeToast("Trade execution failed. Check your wallet balance and try again.", false);
    } finally {
      setExecuting(null)
    }
  }

  return (
    <div className="space-y-6">
      {tradeToast && (
        <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-black max-w-sm transition-all ${
          tradeToast.success
            ? 'bg-green-950 border-green-500/40 text-green-300'
            : 'bg-red-950 border-red-500/40 text-red-300'
        }`}>
          <span>{tradeToast.success ? '✓' : '✗'}</span>
          <span>{tradeToast.message}</span>
          <button onClick={() => setTradeToast(null)} className="ml-2 opacity-60 hover:opacity-100 text-xs">✕</button>
        </div>
      )}
      <Card className="bg-zinc-950 border-zinc-900 overflow-hidden shadow-2xl rounded-[2rem]">
        {/* Header + Filters — single row */}
        <div className="px-6 py-4 border-b border-zinc-900 flex flex-wrap items-center gap-3 bg-zinc-950/20">
          {/* Live dot + title */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-white uppercase italic">Live Feed</h2>
          </div>

          {/* Filter chips inline */}
          <div className="flex items-center gap-2 flex-1">
            {FILTER_CHIPS.map(f => (
              <FilterChip
                key={f.key}
                label={f.label}
                active={activeFilter === f.key}
                onClick={() => setActiveFilter(f.key)}
              />
            ))}
          </div>

          {/* Stats + controls */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 text-sm font-black text-zinc-400">
              <span>Total: <span className="text-white">{loading && alerts.length === 0 ? '...' : alerts.length}</span></span>
              <span className="text-zinc-700">|</span>
              <span>24h: <span className="text-[#5100fd]">{loading && alerts.length === 0 ? '...' : dailyAlerts}</span></span>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Sound ON — click to mute" : "Sound OFF — click to enable"}
              className={`p-2.5 rounded-xl border transition-all ${
                soundEnabled
                  ? 'bg-[#5100fd]/10 border-[#5100fd]/40 text-[#5100fd]'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-500'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            {onClearFeed && (
              <button
                onClick={() => setShowClearConfirm(true)}
                title="Clear feed"
                className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/60"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            {user && onToggleAlerts && (
              <button
                onClick={onToggleAlerts}
                disabled={togglingAlerts}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                  alertsEnabled
                    ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400'
                }`}
              >
                {togglingAlerts ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : alertsEnabled ? (
                  <Bell className="w-4 h-4" />
                ) : (
                  <BellOff className="w-4 h-4" />
                )}
                {alertsEnabled !== false ? "Alerts ON" : "Alerts OFF"}
              </button>
            )}
          </div>
        </div>
        
        <div className="overflow-y-auto scrollbar-feed" style={{ maxHeight: 'calc(100vh - 50px)' }}>
          {loading && alerts.length === 0 ? (
            <div className="p-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#5100fd] mx-auto mb-4" />
              <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Scanning Solana Mainnet...</p>
            </div>
          ) : !loading && alerts.length === 0 ? (
            <div className="p-12 text-center">
              <Zap className="h-6 w-6 text-zinc-600 mx-auto mb-4" />
              <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">No alerts yet — listener is active</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="p-12 text-center">
              <Zap className="h-6 w-6 text-zinc-600 mx-auto mb-4" />
              <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">No alerts for this filter</p>
            </div>
          ) : filteredAlerts.map((token: any, i: number) => {
            const isLoading = token.name === "Loading...";
            const symbol = token.symbol;
            const name = !isLoading && token.name && token.name !== "Unknown Token" ? token.name : null;
            const displayPrimary = symbol || name || shortAddr(token.address);
            const displaySecondary = symbol && name && name !== symbol ? name : null;
            const normalizedType = normalizeType(token.type);
            const typeColor = TYPE_COLORS[normalizedType] || TYPE_COLORS[(token.type || "").toUpperCase()] || "bg-zinc-800 text-white";
            const isBoost = normalizedType === "DEX BOOST";

            return (
              <div
                key={`${token.fingerprint || token.address}-${i}`}
                onClick={() => token.address && router.push(`/token/${token.address}`)}
                className="group p-4 hover:bg-[#5100fd]/[0.05] transition-all flex items-center gap-4 border-b border-zinc-900 border-l-4 border-l-transparent hover:border-l-[#5100fd] cursor-pointer last:border-b-0"
              >
                {/* Token Logo */}
                <div className="rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden group-hover:border-[#5100fd]/50 transition-colors flex-shrink-0 relative" style={{ width: 60, height: 60, minWidth: 60, minHeight: 60 }}>
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-black text-[#5100fd]">
                    {isLoading ? "·" : (displayPrimary)?.[0]?.toUpperCase() || "?"}
                  </span>
                  {token.imageUrl && (
                    <img
                      src={token.imageUrl}
                      alt={displayPrimary}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).remove(); }}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Row 1: name + type badge + boost amount + time */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-baseline gap-2 min-w-0">
                      {isLoading ? (
                        <span className="inline-block h-5 w-24 rounded bg-zinc-800 animate-pulse" />
                      ) : (
                        <>
                          <span className="text-lg font-black text-white truncate tracking-tight">{displayPrimary}</span>
                          {displaySecondary && <span className="text-xs text-zinc-500 truncate">{displaySecondary}</span>}
                        </>
                      )}
                    </div>

                    {/* Type badge */}
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-black uppercase tracking-tight shadow-sm whitespace-nowrap ${typeColor}`}>
                      {normalizedType}
                    </span>

                    {/* Boost amount badge */}
                    {isBoost && (token.boostAmount != null || token.totalBoostAmount != null) && (
                      <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-black whitespace-nowrap" style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.55)', color: '#fbbf24' }}>
                        ⚡ {token.boostAmount != null ? `+${token.boostAmount.toLocaleString()}` : ""}
                        {token.totalBoostAmount != null && token.totalBoostAmount > (token.boostAmount ?? 0) && (
                          <span className="opacity-70">/ {token.totalBoostAmount.toLocaleString()} total</span>
                        )}
                      </span>
                    )}

                    <span className="text-xs text-zinc-500 font-black whitespace-nowrap tracking-widest ml-auto">
                      {(token.clientSeenAt || token.alertedAt)
                        ? new Date(token.clientSeenAt || token.alertedAt).toLocaleTimeString()
                        : "Live"}
                    </span>
                  </div>

                  {/* Row 2: metrics */}
                  <div className="flex items-center gap-4 text-xs flex-wrap mb-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">MC</span>
                      <span className="text-sm text-white font-black">{token.mc && token.mc !== "N/A" ? token.mc : "—"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Liquidity</span>
                      <span className="text-sm text-white font-black">{token.liquidity && token.liquidity !== "N/A" ? token.liquidity : "—"}</span>
                    </div>
                    {token.vol && token.vol !== "N/A" && (
                      <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Vol 24h</span>
                        <span className="text-sm text-green-400 font-black">{token.vol}</span>
                      </div>
                    )}
                    {token.priceUsd && (
                      <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Price</span>
                        <span className="text-sm text-zinc-300 font-black">{token.priceUsd}</span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">CA</span>
                      <span className="text-xs text-zinc-500 font-mono">{shortAddr(token.address)}</span>
                    </div>
                  </div>
                </div>

                {/* Change % + external link */}
                <div className="text-right hidden md:flex flex-col items-end flex-shrink-0 gap-1">
                  <span className={`text-lg font-black block leading-none ${
                    token.change?.startsWith("+") ? 'text-green-500' :
                    token.change?.startsWith("-") ? 'text-red-500' : 'text-zinc-500'
                  }`}>
                    {token.change || "—"}
                  </span>
                  <span className="text-[10px] text-zinc-600 uppercase font-black tracking-tighter">24H</span>
                  {token.dexUrl && (
                    <a
                      href={token.dexUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[10px] text-zinc-600 hover:text-[#5100fd] transition-colors mt-0.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="lg"
                    onClick={(e) => { e.stopPropagation(); handleQuickBuy(token); }}
                    disabled={executing === token.address || autoTrading === token.address}
                    className="bg-[#5100fd] hover:bg-[#4100cc] h-10 px-5 text-xs font-black rounded-lg text-white shadow-[0_0_20px_rgba(81,0,253,0.4)]"
                  >
                    {executing === token.address || autoTrading === token.address
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : "BUY"
                    }
                  </Button>
                  <Button
                    size="lg"
                    onClick={(e) => { e.stopPropagation(); token.address && router.push(`/token/${token.address}`); }}
                    className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 h-10 px-5 text-xs font-black rounded-lg text-white"
                  >
                    VIEW
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowClearConfirm(false)}
        >
          <div
            className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-black text-base uppercase tracking-tight mb-1">Clear Feed</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  This will remove all alerts currently stored in your browser cache. New alerts will continue to arrive live — only your local history will be wiped.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 text-xs font-black uppercase tracking-widest hover:text-white hover:border-zinc-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowClearConfirm(false);
                  onClearFeed?.();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/40 text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-500/20 hover:border-red-500/70 transition-all"
              >
                Clear Feed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
