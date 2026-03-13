const TRADE_HISTORY_KEY = "alertly_trade_history_v1"
const MAX_TRADES = 100

export type BrowserTradeLog = {
  id: string
  tokenAddress: string
  alertType: string
  action: "buy" | "sell"
  amount: number
  slippage: number
  status: "success" | "failed" | "dry_run"
  txSig?: string | null
  message?: string | null
  createdAt: string
  tokenName?: string
  tokenSymbol?: string
}

export function getBrowserTrades(): BrowserTradeLog[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(TRADE_HISTORY_KEY)
    if (!raw) return []
    return JSON.parse(raw) as BrowserTradeLog[]
  } catch {
    return []
  }
}

export function saveBrowserTrade(trade: Omit<BrowserTradeLog, "id" | "createdAt">): BrowserTradeLog {
  const entry: BrowserTradeLog = {
    ...trade,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  }
  const existing = getBrowserTrades()
  const updated = [entry, ...existing].slice(0, MAX_TRADES)
  try {
    localStorage.setItem(TRADE_HISTORY_KEY, JSON.stringify(updated))
  } catch {}
  window.dispatchEvent(new CustomEvent("alertly:trade-logged", { detail: entry }))
  return entry
}

export function clearBrowserTrades(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(TRADE_HISTORY_KEY)
}
