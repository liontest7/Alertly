"use client"

import { Card } from "@/components/ui/card"
import { TrendingUp, Trash2, Info } from "lucide-react"
import { useState, useEffect } from "react"
import type { CopyTrader, CopyTraderMode } from "@/lib/browser-copy-trading"

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="flex items-center justify-center w-4 h-4 text-zinc-500 hover:text-blue-400 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {show && (
        <span className="absolute left-5 top-0 z-50 w-56 rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-[10px] text-zinc-300 leading-relaxed shadow-xl whitespace-normal pointer-events-none">
          {text}
        </span>
      )}
    </span>
  )
}

export function CopyTradingMiniCard() {
  const [traders, setTraders] = useState<CopyTrader[]>([])
  const [address, setAddress] = useState("")
  const [buyAmount, setBuyAmount] = useState("0.5")
  const [mode, setMode] = useState<CopyTraderMode>("trade_and_alert")
  const [loading, setLoading] = useState(false)
  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [copyAlerts, setCopyAlerts] = useState<{ traderAddress: string; tokenAddress: string }[]>([])

  async function refreshTraders() {
    const { getCopyTraders } = await import("@/lib/browser-copy-trading")
    setTraders(getCopyTraders())
  }

  async function ensureWatcher(traderList: CopyTrader[]) {
    if (!globalEnabled) return
    if (traderList.filter((t) => t.enabled).length === 0) return
    const { startCopyTradingWatcher, isCopyTradingWatcherRunning } = await import("@/lib/browser-copy-trading")
    if (!isCopyTradingWatcherRunning()) startCopyTradingWatcher()
  }

  useEffect(() => {
    refreshTraders()

    const onChanged = () => {
      import("@/lib/browser-copy-trading").then(({ getCopyTraders }) => {
        const list = getCopyTraders()
        setTraders(list)
        ensureWatcher(list)
      })
    }
    window.addEventListener("alertly:copy-traders-changed", onChanged)

    const onCopyAlert = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setCopyAlerts((prev) => [detail, ...prev].slice(0, 5))
    }
    window.addEventListener("alertly:copy-alert", onCopyAlert)

    return () => {
      window.removeEventListener("alertly:copy-traders-changed", onChanged)
      window.removeEventListener("alertly:copy-alert", onCopyAlert)
    }
  }, [])

  async function handleGlobalToggle() {
    const next = !globalEnabled
    setGlobalEnabled(next)
    if (!next) {
      const { stopCopyTradingWatcher } = await import("@/lib/browser-copy-trading")
      stopCopyTradingWatcher()
    } else {
      ensureWatcher(traders)
    }
  }

  async function handleAdd() {
    if (!address.trim()) return
    setLoading(true)
    try {
      const { saveCopyTrader, startCopyTradingWatcher } = await import("@/lib/browser-copy-trading")
      saveCopyTrader({
        address: address.trim(),
        buyAmount: mode === "alert_only" ? 0 : parseFloat(buyAmount) || 0.5,
        mode,
        enabled: true,
      })
      if (globalEnabled) startCopyTradingWatcher()
      setAddress("")
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove(addr: string) {
    const { removeCopyTrader } = await import("@/lib/browser-copy-trading")
    removeCopyTrader(addr)
  }

  async function handleToggle(addr: string, enabled: boolean) {
    const { updateCopyTrader, startCopyTradingWatcher } = await import("@/lib/browser-copy-trading")
    updateCopyTrader(addr, { enabled })
    if (enabled && globalEnabled) startCopyTradingWatcher()
  }

  const isAlertOnly = mode === "alert_only"
  const activeCount = traders.filter((t) => t.enabled).length

  return (
    <Card className="bg-zinc-950 border-zinc-900 p-5 rounded-[2rem] shadow-xl hover:border-zinc-800/50 transition-all group text-white">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-[12px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#5100fd]" /> Copy Trading
          <InfoTooltip text="Runs in this browser only. Keep this tab open. Wallet keys are stored locally and never sent to our servers." />
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${activeCount > 0 && globalEnabled ? "bg-green-500 animate-pulse" : "bg-zinc-600"}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {activeCount > 0 && globalEnabled ? `${activeCount} Live` : "Idle"}
            </span>
          </div>
          <button
            onClick={handleGlobalToggle}
            title={globalEnabled ? "Copy Trading ON — click to pause all" : "Copy Trading OFF — click to resume"}
            className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-all shadow-lg ${globalEnabled ? "bg-[#5100fd]" : "bg-zinc-800"}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-md ${globalEnabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      {traders.length > 0 && (
        <div className="space-y-2">
          {traders.map((trader) => (
            <div
              key={trader.address}
              className="flex justify-between items-center p-3 rounded-xl bg-zinc-900 border border-zinc-800"
            >
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black font-mono text-zinc-300">
                  {trader.address.slice(0, 8)}…{trader.address.slice(-4)}
                </span>
                <div className="flex gap-1.5">
                  <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                    {trader.mode === "trade_and_alert" ? "Trade & Alert" : "Alert Only"}
                  </span>
                  {trader.mode === "trade_and_alert" && (
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-[#5100fd]/20 border border-[#5100fd]/30 text-[#5100fd]">
                      {trader.buyAmount} SOL
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(trader.address, !trader.enabled)}
                  className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border transition-all ${
                    trader.enabled
                      ? "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-green-500/30 hover:text-green-400"
                  }`}
                >
                  {trader.enabled ? "ON" : "OFF"}
                </button>
                <button
                  onClick={() => handleRemove(trader.address)}
                  className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {traders.length === 0 && (
        <p className="text-[12px] text-zinc-500 font-bold italic text-center mt-1 mb-1">No active copy traders</p>
      )}

      {copyAlerts.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Recent Copy Signals</p>
          {copyAlerts.map((a, i) => (
            <div key={i} className="flex justify-between items-center px-2 py-1.5 rounded-lg bg-[#5100fd]/10 border border-[#5100fd]/20 text-[9px]">
              <span className="font-mono text-zinc-300">{a.tokenAddress.slice(0, 8)}…{a.tokenAddress.slice(-4)}</span>
              <span className="text-[#5100fd] font-black uppercase">Copied</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2.5 pt-3 mt-3 border-t border-zinc-900">
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Target Wallet</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Solana Address"
            className="w-full bg-black border border-zinc-800 rounded-xl p-2.5 text-[10px] text-white focus:outline-none focus:border-[#5100fd] font-mono"
          />
        </div>

        <div className={`grid gap-2.5 ${!isAlertOnly ? "grid-cols-2" : "grid-cols-1"}`}>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as CopyTraderMode)}
              className="w-full bg-black border border-zinc-800 rounded-xl p-2.5 text-[10px] text-white focus:outline-none focus:border-[#5100fd] font-bold appearance-none cursor-pointer"
            >
              <option value="trade_and_alert">Trade & Alert</option>
              <option value="alert_only">Alert Only</option>
            </select>
          </div>
          {!isAlertOnly && (
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Amount (SOL)</label>
              <input
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="0.5"
                min="0.01"
                step="0.1"
                className="w-full bg-black border border-zinc-800 rounded-xl p-2.5 text-[10px] text-white focus:outline-none focus:border-[#5100fd] font-bold"
              />
            </div>
          )}
        </div>

        {!isAlertOnly && (
          <p className="text-[10px] text-amber-400/70">Trade & Alert uses your Sniper wallet — keep this tab open.</p>
        )}

        <button
          onClick={handleAdd}
          disabled={loading || !address.trim()}
          className="w-full bg-[#5100fd] hover:bg-[#6610ff] disabled:opacity-50 disabled:cursor-not-allowed h-10 rounded-xl text-[10px] font-black text-white uppercase tracking-widest shadow-lg shadow-[#5100fd]/20 transition-all"
        >
          {loading ? "PROCESSING..." : "ACTIVATE COPY"}
        </button>
      </div>
    </Card>
  )
}
