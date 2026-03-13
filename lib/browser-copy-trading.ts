/**
 * Browser-based Copy Trading
 * Stores watched wallets in localStorage.
 * Polls Solana for new transactions on watched wallets.
 * When a swap is detected: fires an alert and/or executes a copy trade.
 * Requires the browser tab to be open — no server involvement.
 */

const COPY_TRADERS_KEY = "alertly_copy_traders_v1"
const SEEN_TXS_KEY = "alertly_copy_seen_txs_v1"
const MAX_SEEN_TXS = 500
const POLL_INTERVAL_MS = 8_000

export type CopyTraderMode = "trade_and_alert" | "alert_only"

export type CopyTrader = {
  address: string
  buyAmount: number
  mode: CopyTraderMode
  enabled: boolean
  addedAt: string
  label?: string
}

export function getCopyTraders(): CopyTrader[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(COPY_TRADERS_KEY)
    return raw ? (JSON.parse(raw) as CopyTrader[]) : []
  } catch {
    return []
  }
}

export function saveCopyTrader(trader: Omit<CopyTrader, "addedAt">): CopyTrader {
  const entry: CopyTrader = { ...trader, addedAt: new Date().toISOString() }
  const existing = getCopyTraders().filter((t) => t.address !== trader.address)
  const updated = [entry, ...existing]
  localStorage.setItem(COPY_TRADERS_KEY, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent("alertly:copy-traders-changed"))
  return entry
}

export function removeCopyTrader(address: string): void {
  const updated = getCopyTraders().filter((t) => t.address !== address)
  localStorage.setItem(COPY_TRADERS_KEY, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent("alertly:copy-traders-changed"))
}

export function updateCopyTrader(address: string, patch: Partial<CopyTrader>): void {
  const updated = getCopyTraders().map((t) => (t.address === address ? { ...t, ...patch } : t))
  localStorage.setItem(COPY_TRADERS_KEY, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent("alertly:copy-traders-changed"))
}

function getSeenTxs(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_TXS_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function addSeenTxs(sigs: string[]): void {
  const seen = getSeenTxs()
  for (const s of sigs) seen.add(s)
  const arr = Array.from(seen).slice(-MAX_SEEN_TXS)
  localStorage.setItem(SEEN_TXS_KEY, JSON.stringify(arr))
}

const SOL_MINT = "So11111111111111111111111111111111111111112"

async function getRecentSwapsForWallet(
  address: string,
  connection: import("@solana/web3.js").Connection,
  seen: Set<string>,
): Promise<{ tokenAddress: string; amountSol: number; sig: string }[]> {
  try {
    const { PublicKey } = await import("@solana/web3.js")
    const pubkey = new PublicKey(address)
    const sigs = await connection.getSignaturesForAddress(pubkey, { limit: 5 })
    const newSigs = sigs.filter((s) => !seen.has(s.signature) && !s.err)
    if (newSigs.length === 0) return []

    const results: { tokenAddress: string; amountSol: number; sig: string }[] = []

    for (const sigInfo of newSigs) {
      try {
        const tx = await connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        })
        if (!tx?.meta) continue

        const instructions = tx.transaction.message.instructions as any[]
        for (const ix of instructions) {
          if (ix.program !== "spl-token" && ix.programId?.toBase58() !== "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4") continue
          if (ix.parsed?.type === "transfer") continue
          const info = ix.parsed?.info
          if (!info) continue
          const mint = info.mint || info.tokenMint
          if (mint && mint !== SOL_MINT) {
            const preBalances = tx.meta.preBalances
            const postBalances = tx.meta.postBalances
            const accountIndex = tx.transaction.message.accountKeys.findIndex(
              (k: any) => k.pubkey?.toBase58?.() === address || k.toString?.() === address
            )
            if (accountIndex < 0) continue
            const solDiff = (preBalances[accountIndex] - postBalances[accountIndex]) / 1e9
            if (solDiff > 0.001) {
              results.push({ tokenAddress: mint, amountSol: solDiff, sig: sigInfo.signature })
            }
          }
        }
      } catch {}
    }

    addSeenTxs(newSigs.map((s) => s.signature))
    return results
  } catch {
    return []
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

export function startCopyTradingWatcher(): void {
  if (pollTimer) return
  if (typeof window === "undefined") return

  pollTimer = setInterval(async () => {
    const traders = getCopyTraders().filter((t) => t.enabled)
    if (traders.length === 0) return

    const { Connection } = await import("@solana/web3.js")
    const rpcUrl =
      (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOLANA_RPC_URL) ||
      "https://api.mainnet-beta.solana.com"
    const connection = new Connection(rpcUrl, "confirmed")
    const seen = getSeenTxs()

    for (const trader of traders) {
      const swaps = await getRecentSwapsForWallet(trader.address, connection, seen)
      for (const swap of swaps) {
        const alertAmount = trader.buyAmount > 0 ? trader.buyAmount : swap.amountSol

        if (trader.mode === "alert_only" || trader.mode === "trade_and_alert") {
          window.dispatchEvent(
            new CustomEvent("alertly:copy-alert", {
              detail: {
                traderAddress: trader.address,
                tokenAddress: swap.tokenAddress,
                amountSol: swap.amountSol,
                sig: swap.sig,
                mode: trader.mode,
              },
            }),
          )
        }

        if (trader.mode === "trade_and_alert") {
          const { getBrowserWallet } = await import("./browser-wallet")
          const { executeBrowserTrade, slippagePctToBps } = await import("./browser-trade")
          const { saveBrowserTrade } = await import("./browser-trade-history")
          const wallet = getBrowserWallet()
          if (!wallet) continue

          const result = await executeBrowserTrade(wallet, swap.tokenAddress, alertAmount, slippagePctToBps(10))
          saveBrowserTrade({
            tokenAddress: swap.tokenAddress,
            alertType: "COPY_TRADE",
            action: "buy",
            amount: alertAmount,
            slippage: 10,
            status: result.success ? "success" : "failed",
            txSig: result.txSig,
            message: result.message,
          })
        }
      }
    }
  }, POLL_INTERVAL_MS)
}

export function stopCopyTradingWatcher(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export function isCopyTradingWatcherRunning(): boolean {
  return pollTimer !== null
}
