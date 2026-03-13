"use client"

import { useState, useEffect, useCallback } from "react"
import {
  TrendingUp, TrendingDown, ExternalLink, Pencil, Check, X,
  RefreshCw, Loader2, ChevronDown, ChevronUp, BarChart2,
} from "lucide-react"

// ─── Cookie helpers (same base64url pattern as filter settings) ────────────────

const POSITIONS_COOKIE = "alertly_positions_v1"

type PositionMeta = { sl: number; tp: number }

function encodePositionsCookie(data: Record<string, PositionMeta>): string {
  const json = JSON.stringify(data)
  const bytes = new TextEncoder().encode(json)
  const binStr = Array.from(bytes, (b) => String.fromCodePoint(b)).join("")
  const b64 = btoa(binStr)
  const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  return encodeURIComponent(b64url)
}

function decodePositionsCookie(value: string): Record<string, PositionMeta> {
  try {
    const url = decodeURIComponent(value)
    const b64 = url.replace(/-/g, "+").replace(/_/g, "/")
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return {}
  }
}

function readPositionsMeta(): Record<string, PositionMeta> {
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|;)\\s*${POSITIONS_COOKIE}=([^;]+)`)
    )
    if (!match) return {}
    return decodePositionsCookie(match[1])
  } catch {
    return {}
  }
}

function writePositionsMeta(data: Record<string, PositionMeta>) {
  const encoded = encodePositionsCookie(data)
  const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${POSITIONS_COOKIE}=${encoded}; path=/; expires=${expires}; SameSite=Lax`
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TradeLog = {
  id: string
  tokenAddress: string
  alertType: string
  action: string
  amount: number
  slippage: number
  status: string
  txSig?: string | null
  message?: string | null
  createdAt: string
}

type TokenPrice = {
  priceUsd: number
  priceNative: number
  symbol: string
  name: string
  liquidity?: number
}

type OpenPosition = {
  tokenAddress: string
  totalBuySOL: number
  totalSellSOL: number
  openSOL: number
  trades: TradeLog[]
  price?: TokenPrice
  loadingPrice?: boolean
  priceError?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

function fmtSOL(n: number) {
  return n.toFixed(4)
}

function fmtUsd(n: number) {
  if (n === 0) return "$0.00"
  if (n < 0.01) return `$${n.toFixed(6)}`
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function derivePositions(trades: TradeLog[]): OpenPosition[] {
  const map: Record<string, OpenPosition> = {}

  for (const t of trades) {
    if (t.status !== "success" && t.status !== "dry_run") continue
    if (!map[t.tokenAddress]) {
      map[t.tokenAddress] = {
        tokenAddress: t.tokenAddress,
        totalBuySOL: 0,
        totalSellSOL: 0,
        openSOL: 0,
        trades: [],
      }
    }
    const p = map[t.tokenAddress]
    if (t.action === "buy") p.totalBuySOL += t.amount
    if (t.action === "sell") p.totalSellSOL += t.amount
    p.trades.push(t)
  }

  return Object.values(map)
    .map((p) => ({ ...p, openSOL: Math.max(0, p.totalBuySOL - p.totalSellSOL) }))
    .filter((p) => p.openSOL > 0.00001)
    .sort((a, b) => b.openSOL - a.openSOL)
}

// ─── PNL Badge ────────────────────────────────────────────────────────────────

function PnlBadge({ pct }: { pct: number }) {
  const pos = pct >= 0
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black border ${
      pos
        ? "bg-green-500/10 border-green-500/30 text-green-400"
        : "bg-red-500/10 border-red-500/30 text-red-400"
    }`}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pos ? "+" : ""}{pct.toFixed(1)}%
    </span>
  )
}

// ─── Open Position Card ───────────────────────────────────────────────────────

function PositionCard({
  pos, meta, onMetaChange, onTrade, settings,
}: {
  pos: OpenPosition
  meta: PositionMeta
  onMetaChange: (addr: string, m: PositionMeta) => void
  onTrade: (tokenAddress: string, action: "buy" | "sell", amount: number) => Promise<void>
  settings: any
}) {
  const [editing, setEditing] = useState(false)
  const [editSl, setEditSl] = useState(String(meta.sl))
  const [editTp, setEditTp] = useState(String(meta.tp))
  const [expanded, setExpanded] = useState(false)
  const [trading, setTrading] = useState<string | null>(null)

  const symbol = pos.price?.symbol || pos.price?.name || shortAddr(pos.tokenAddress)
  const currentPriceUsd = pos.price?.priceUsd ?? 0
  const pnlPct = pos.price && !pos.priceError ? null : null // only show if we have reliable token balance

  function saveEdit() {
    const sl = Math.max(0, Math.min(100, parseFloat(editSl) || 0))
    const tp = Math.max(0, Math.min(1000, parseFloat(editTp) || 0))
    onMetaChange(pos.tokenAddress, { sl, tp })
    setEditing(false)
  }

  async function execTrade(action: "buy" | "sell", pct: number) {
    const key = `${action}-${pct}`
    setTrading(key)
    try {
      const baseAmount = action === "buy"
        ? (settings?.buyAmount ?? 0.1) * (pct / 100)
        : pos.openSOL * (pct / 100)
      await onTrade(pos.tokenAddress, action, parseFloat(baseAmount.toFixed(4)))
    } finally {
      setTrading(null)
    }
  }

  const statusBg = pos.loadingPrice
    ? "border-l-zinc-700"
    : pos.priceError
    ? "border-l-zinc-600"
    : "border-l-[#5100fd]"

  return (
    <div className={`bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden border-l-4 ${statusBg} mb-3`}>
      {/* Header row */}
      <div className="p-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-black text-white text-base tracking-tight truncate">{symbol}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#5100fd]/15 text-[#5100fd] border border-[#5100fd]/30 uppercase tracking-widest">
              OPEN
            </span>
            {pos.price?.liquidity && (
              <span className="text-[10px] text-zinc-500 font-mono">
                Liq {fmtUsd(pos.price.liquidity)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-600 font-mono">{shortAddr(pos.tokenAddress)}</p>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-zinc-500 hover:text-white transition-colors mt-1"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Stats row */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Invested</p>
          <p className="text-sm font-black text-white">{fmtSOL(pos.totalBuySOL)} <span className="text-zinc-500 font-normal text-[10px]">SOL</span></p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Retrieved</p>
          <p className="text-sm font-black text-white">{fmtSOL(pos.totalSellSOL)} <span className="text-zinc-500 font-normal text-[10px]">SOL</span></p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Price Now</p>
          {pos.loadingPrice ? (
            <Loader2 className="w-3 h-3 animate-spin text-zinc-500 mx-auto" />
          ) : pos.priceError ? (
            <p className="text-sm text-zinc-600 font-bold">N/A</p>
          ) : (
            <p className="text-sm font-black text-white">{fmtUsd(currentPriceUsd)}</p>
          )}
        </div>
      </div>

      {/* SL/TP row */}
      <div className="px-4 pb-3 flex items-center gap-3">
        {editing ? (
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-red-400 font-black uppercase tracking-wider">SL</span>
              <input
                value={editSl}
                onChange={(e) => setEditSl(e.target.value)}
                className="w-14 bg-zinc-900 border border-red-500/30 rounded-lg text-xs text-white font-mono px-2 py-1 outline-none text-center"
                placeholder="25"
              />
              <span className="text-zinc-500 text-xs">%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-green-400 font-black uppercase tracking-wider">TP</span>
              <input
                value={editTp}
                onChange={(e) => setEditTp(e.target.value)}
                className="w-14 bg-zinc-900 border border-green-500/30 rounded-lg text-xs text-white font-mono px-2 py-1 outline-none text-center"
                placeholder="50"
              />
              <span className="text-zinc-500 text-xs">%</span>
            </div>
            <button onClick={saveEdit} className="p-1.5 bg-green-500/15 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/25 transition-colors">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setEditing(false); setEditSl(String(meta.sl)); setEditTp(String(meta.tp)); }} className="p-1.5 bg-zinc-900 border border-zinc-700 text-zinc-400 rounded-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-red-400 font-black uppercase">SL</span>
              <span className="text-xs font-mono text-white bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg">{meta.sl}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-green-400 font-black uppercase">TP</span>
              <span className="text-xs font-mono text-white bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-lg">{meta.tp}%</span>
            </div>
            <button
              onClick={() => { setEditing(true); setEditSl(String(meta.sl)); setEditTp(String(meta.tp)); }}
              className="p-1.5 bg-zinc-900 border border-zinc-700 text-zinc-400 rounded-lg hover:text-white hover:border-zinc-500 transition-colors ml-1"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <a
              href={`https://dexscreener.com/solana/${pos.tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto p-1.5 bg-zinc-900 border border-zinc-700 text-zinc-400 rounded-lg hover:text-white transition-colors"
              title="View on DexScreener"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 flex gap-2 flex-wrap">
        <button
          onClick={() => execTrade("buy", 50)}
          disabled={!!trading}
          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-xl bg-[#5100fd]/10 border border-[#5100fd]/30 text-[#5100fd] hover:bg-[#5100fd]/20 transition-colors disabled:opacity-50"
        >
          {trading === "buy-50" ? <Loader2 className="w-3 h-3 animate-spin" /> : "+50%"}
        </button>
        <button
          onClick={() => execTrade("buy", 100)}
          disabled={!!trading}
          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-xl bg-[#5100fd]/10 border border-[#5100fd]/30 text-[#5100fd] hover:bg-[#5100fd]/20 transition-colors disabled:opacity-50"
        >
          {trading === "buy-100" ? <Loader2 className="w-3 h-3 animate-spin" /> : "+100%"}
        </button>

        <div className="w-px bg-zinc-800 mx-1" />

        <button
          onClick={() => execTrade("sell", 25)}
          disabled={!!trading}
          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
        >
          {trading === "sell-25" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sell 25%"}
        </button>
        <button
          onClick={() => execTrade("sell", 50)}
          disabled={!!trading}
          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
        >
          {trading === "sell-50" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sell 50%"}
        </button>
        <button
          onClick={() => execTrade("sell", 100)}
          disabled={!!trading}
          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
        >
          {trading === "sell-100" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sell All"}
        </button>
      </div>

      {/* Expanded: trade history for this token */}
      {expanded && (
        <div className="border-t border-zinc-900 px-4 py-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-black mb-2">Trade History for this token</p>
          <div className="space-y-1.5">
            {pos.trades.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  t.action === "buy"
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}>{t.action}</span>
                <span className="font-mono text-white">{fmtSOL(t.amount)} SOL</span>
                <span className={`text-[10px] font-bold ${
                  t.status === "success" ? "text-green-500" : t.status === "dry_run" ? "text-yellow-500" : "text-red-400"
                }`}>{t.status}</span>
                <span className="text-zinc-600 ml-auto">{timeAgo(t.createdAt)}</span>
                {t.txSig && (
                  <a href={`https://solscan.io/tx/${t.txSig}`} target="_blank" rel="noopener noreferrer" className="text-[#5100fd] hover:text-white">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── History Row ──────────────────────────────────────────────────────────────

function HistoryRow({ t }: { t: TradeLog }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-zinc-900 last:border-b-0 hover:bg-zinc-900/30 px-1 rounded-xl transition-colors">
      <div className="flex-shrink-0">
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
          t.action === "buy"
            ? "bg-green-500/10 text-green-400 border border-green-500/20"
            : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>{t.action}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-zinc-300 truncate">{shortAddr(t.tokenAddress)}</p>
        <p className="text-[10px] text-zinc-600">{t.alertType?.replace("_", " ")} · {timeAgo(t.createdAt)}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-black text-white">{fmtSOL(t.amount)} SOL</p>
        <p className={`text-[10px] font-bold ${
          t.status === "success" ? "text-green-500" : t.status === "dry_run" ? "text-yellow-500" : "text-red-400"
        }`}>{t.status}</p>
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
  )
}

// ─── Main TradesPanel ─────────────────────────────────────────────────────────

export function TradesPanel({ user, settings }: { user: any; settings: any }) {
  const [tab, setTab] = useState<"open" | "history">("open")
  const [trades, setTrades] = useState<TradeLog[]>([])
  const [loading, setLoading] = useState(true)
  const [positions, setPositions] = useState<OpenPosition[]>([])
  const [positionsMeta, setPositionsMeta] = useState<Record<string, PositionMeta>>({})
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [historyFilter, setHistoryFilter] = useState<"all" | "buy" | "sell">("all")
  const [tradeMsg, setTradeMsg] = useState<{ msg: string; ok: boolean } | null>(null)

  const loadTrades = useCallback(async () => {
    setRefreshing(true)
    try {
      const { getBrowserTrades } = await import("@/lib/browser-trade-history")
      const raw = getBrowserTrades()
      setTrades(raw)
      setLastRefresh(new Date())

      const derived = derivePositions(raw)
      setPositions(derived.map((p) => ({ ...p, loadingPrice: true })))

      if (derived.length > 0) {
        const addrs = derived.map((p) => p.tokenAddress).join(",")
        const priceRes = await fetch(`/api/trades/price?addresses=${addrs}`)
        if (priceRes.ok) {
          const { prices } = await priceRes.json()
          setPositions(
            derived.map((p) => ({
              ...p,
              loadingPrice: false,
              priceError: !prices[p.tokenAddress],
              price: prices[p.tokenAddress] ?? undefined,
            }))
          )
        } else {
          setPositions(derived.map((p) => ({ ...p, loadingPrice: false, priceError: true })))
        }
      }
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const saved = readPositionsMeta()
    setPositionsMeta(saved)
    loadTrades()

    const onTradeLogged = () => loadTrades()
    window.addEventListener("alertly:trade-logged", onTradeLogged)

    const interval = setInterval(async () => {
      if (positions.length === 0) return
      const addrs = positions.map((p) => p.tokenAddress).join(",")
      try {
        const res = await fetch(`/api/trades/price?addresses=${addrs}`)
        if (!res.ok) return
        const { prices } = await res.json()
        setPositions((prev) =>
          prev.map((p) => ({
            ...p,
            loadingPrice: false,
            priceError: !prices[p.tokenAddress],
            price: prices[p.tokenAddress] ?? p.price,
          }))
        )
      } catch {}
    }, 30000)

    return () => {
      window.removeEventListener("alertly:trade-logged", onTradeLogged)
      clearInterval(interval)
    }
  }, [])

  function handleMetaChange(addr: string, meta: PositionMeta) {
    const next = { ...positionsMeta, [addr]: meta }
    setPositionsMeta(next)
    writePositionsMeta(next)
  }

  async function handleTrade(tokenAddress: string, action: "buy" | "sell", amount: number) {
    try {
      const { getBrowserWallet } = await import("@/lib/browser-wallet")
      const { executeBrowserTrade, slippagePctToBps } = await import("@/lib/browser-trade")
      const { saveBrowserTrade } = await import("@/lib/browser-trade-history")
      const wallet = getBrowserWallet()
      if (!wallet) {
        setTradeMsg({ msg: "No trading wallet — generate one in Sniper Config", ok: false })
        setTimeout(() => setTradeMsg(null), 4000)
        return
      }
      const slippage = settings?.slippage ?? 10
      const result = await executeBrowserTrade(wallet, tokenAddress, amount, slippagePctToBps(slippage))
      saveBrowserTrade({
        tokenAddress,
        alertType: "MANUAL",
        action,
        amount,
        slippage,
        status: result.success ? "success" : "failed",
        txSig: result.txSig,
        message: result.message,
      })
      if (result.success) {
        setTradeMsg({ msg: `${action === "buy" ? "Bought" : "Sold"} ${amount} SOL ✓`, ok: true })
        setTimeout(() => loadTrades(), 500)
      } else {
        setTradeMsg({ msg: result.message || "Trade failed", ok: false })
      }
    } catch {
      setTradeMsg({ msg: "Trade error", ok: false })
    }
    setTimeout(() => setTradeMsg(null), 4000)
  }

  const historyFiltered = trades.filter((t) => historyFilter === "all" || t.action === historyFilter)

  const realizedMap: Record<string, number> = {}
  trades.forEach((t) => {
    if (t.status !== "success" && t.status !== "dry_run") return
    if (!realizedMap[t.tokenAddress]) realizedMap[t.tokenAddress] = 0
    realizedMap[t.tokenAddress] += t.action === "sell" ? t.amount : -t.amount
  })

  const totalRealizedPnl = Object.values(realizedMap).reduce((sum, v) => sum + v, 0)
  const totalBuys = trades.filter((t) => t.action === "buy" && t.status === "success").length
  const totalSells = trades.filter((t) => t.action === "sell" && t.status === "success").length

  return (
    <div className="bg-zinc-950 border border-zinc-900 overflow-hidden shadow-2xl rounded-[2rem]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-900 flex items-center gap-3 bg-zinc-950/20">
        <div className="p-2.5 rounded-xl bg-[#5100fd]/10 border border-[#5100fd]/20">
          <BarChart2 className="w-4 h-4 text-[#5100fd]" />
        </div>
        <h2 className="text-xl font-black tracking-tight text-white uppercase italic flex-1">My Trades</h2>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs font-bold text-zinc-400">
          <span>Open: <span className="text-white">{positions.length}</span></span>
          <span className="text-zinc-700">|</span>
          <span>P&L:
            <span className={`ml-1 ${totalRealizedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalRealizedPnl >= 0 ? "+" : ""}{fmtSOL(totalRealizedPnl)} SOL
            </span>
          </span>
          <button
            onClick={loadTrades}
            disabled={refreshing}
            className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-900 px-6">
        {(["open", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
              tab === t
                ? "border-[#5100fd] text-[#5100fd]"
                : "border-transparent text-zinc-500 hover:text-white"
            }`}
          >
            {t === "open" ? `Open Positions (${positions.length})` : `History (${trades.length})`}
          </button>
        ))}
      </div>

      {/* Trade message toast */}
      {tradeMsg && (
        <div className={`mx-6 mt-4 px-4 py-2.5 rounded-xl text-sm font-bold border ${
          tradeMsg.ok
            ? "bg-green-500/10 border-green-500/30 text-green-400"
            : "bg-red-500/10 border-red-500/30 text-red-400"
        }`}>
          {tradeMsg.msg}
        </div>
      )}

      {/* Content */}
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 50px)" }}>
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#5100fd] mx-auto mb-4" />
            <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Loading trades…</p>
          </div>
        ) : tab === "open" ? (
          <div className="p-4">
            {positions.length === 0 ? (
              <div className="p-10 text-center">
                <TrendingUp className="w-8 h-8 text-zinc-700 mx-auto mb-4" />
                <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">No open positions</p>
                <p className="text-xs text-zinc-600 mt-2">Trades from auto-trading will appear here</p>
              </div>
            ) : (
              <>
                {positions.map((pos) => (
                  <PositionCard
                    key={pos.tokenAddress}
                    pos={pos}
                    meta={positionsMeta[pos.tokenAddress] ?? { sl: settings?.stopLoss ?? 25, tp: settings?.takeProfit ?? 50 }}
                    onMetaChange={handleMetaChange}
                    onTrade={handleTrade}
                    settings={settings}
                  />
                ))}
                {lastRefresh && (
                  <p className="text-center text-[10px] text-zinc-700 mt-2 font-mono">
                    Prices auto-refresh every 30s · Last: {lastRefresh.toLocaleTimeString()}
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="px-4 pt-3 pb-4">
            {/* Sub-filter */}
            <div className="flex gap-2 mb-4">
              {(["all", "buy", "sell"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setHistoryFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                    historyFilter === f
                      ? "bg-[#5100fd] border-[#5100fd] text-white"
                      : "bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {f === "all" ? `All (${trades.length})` : f === "buy" ? `Buys (${totalBuys})` : `Sells (${totalSells})`}
                </button>
              ))}
            </div>

            {historyFiltered.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-bold text-zinc-600 uppercase tracking-widest">No trades yet</p>
              </div>
            ) : (
              <div>
                {historyFiltered.map((t) => <HistoryRow key={t.id} t={t} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
