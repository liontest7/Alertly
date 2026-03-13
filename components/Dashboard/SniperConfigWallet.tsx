"use client"

import { Zap, Settings, Copy, Check, Eye, EyeOff, Download, Upload, Trash2, Info, RefreshCw, Send, AlertTriangle } from "lucide-react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import type { BrowserWallet } from "@/lib/browser-wallet"

async function walletLib() {
  const m = await import("@/lib/browser-wallet")
  return m
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 12)}…${addr.slice(-8)}`
}

function InfoBanner({ type, children }: { type: "danger" | "warning"; children: React.ReactNode }) {
  const styles = type === "danger"
    ? "bg-red-500/10 border border-red-500/30 text-red-300"
    : "bg-amber-500/10 border border-amber-500/30 text-amber-300"
  return (
    <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[10px] leading-relaxed ${styles}`}>
      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleShow = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 6,
        left: Math.max(8, rect.left - 120),
      })
    }
    setShow(true)
  }

  return (
    <span className="inline-flex items-center">
      <button
        ref={btnRef}
        onMouseEnter={handleShow}
        onMouseLeave={() => setShow(false)}
        onFocus={handleShow}
        onBlur={() => setShow(false)}
        className="flex items-center justify-center w-4 h-4 rounded-full text-zinc-500 hover:text-blue-400 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {show && pos && (
        <span
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 99999 }}
          className="w-64 rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-[10px] text-zinc-300 leading-relaxed shadow-xl whitespace-normal pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  )
}

export function SniperConfigWallet({ settings, onToggle, user }: { settings: any; onToggle: () => void; user: any }) {
  const router = useRouter()
  const [wallet, setWallet] = useState<BrowserWallet | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [sendTo, setSendTo] = useState("")
  const [sendAmount, setSendAmount] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendTxId, setSendTxId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importKeyInput, setImportKeyInput] = useState("")
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [keyCopied, setKeyCopied] = useState(false)
  const [addrCopied, setAddrCopied] = useState(false)

  useEffect(() => {
    walletLib().then(lib => {
      setWallet(lib.getBrowserWallet())
    })
  }, [])

  const fetchBalance = useCallback(async (addr: string) => {
    setLoadingBalance(true)
    const lib = await walletLib()
    const bal = await lib.getWalletBalanceSol(addr)
    setBalance(bal)
    setLoadingBalance(false)
  }, [])

  useEffect(() => {
    if (wallet?.address) fetchBalance(wallet.address)
  }, [wallet?.address, fetchBalance])

  async function handleGenerate() {
    setGenerating(true)
    setGenerateError(null)
    try {
      const lib = await walletLib()
      const w = await lib.generateBrowserWallet()
      setWallet(w)
      setBalance(0)
      window.dispatchEvent(new CustomEvent("alertly:wallet-changed", { detail: w }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error("Generate wallet failed:", e)
      setGenerateError(msg)
    } finally {
      setGenerating(false)
    }
  }

  async function handleImport() {
    if (!importKeyInput.trim()) return
    setImportError(null)
    setImporting(true)
    try {
      const lib = await walletLib()
      const w = await lib.importBrowserWallet(importKeyInput)
      setWallet(w)
      setImportKeyInput("")
      setShowImport(false)
      window.dispatchEvent(new CustomEvent("alertly:wallet-changed", { detail: w }))
      fetchBalance(w.address)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Invalid key")
    } finally {
      setImporting(false)
    }
  }

  async function handleRemove() {
    const lib = await walletLib()
    lib.removeBrowserWallet()
    setWallet(null)
    setBalance(null)
    setShowRemoveConfirm(false)
    window.dispatchEvent(new CustomEvent("alertly:wallet-changed", { detail: null }))
  }

  async function handleSend() {
    if (!wallet || !sendTo.trim() || !sendAmount) return
    setSending(true)
    setSendError(null)
    setSendTxId(null)
    try {
      const lib = await walletLib()
      const txId = await lib.sendSol(wallet, sendTo.trim(), parseFloat(sendAmount))
      setSendTxId(txId)
      setSendTo("")
      setSendAmount("")
      setTimeout(() => fetchBalance(wallet.address), 3000)
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Transaction failed")
    } finally {
      setSending(false)
    }
  }

  function copyKey() {
    if (!wallet?.privateKey) return
    navigator.clipboard.writeText(wallet.privateKey).then(() => {
      setKeyCopied(true)
      setTimeout(() => setKeyCopied(false), 2000)
    })
  }

  function copyAddr() {
    if (!wallet?.address) return
    navigator.clipboard.writeText(wallet.address).then(() => {
      setAddrCopied(true)
      setTimeout(() => setAddrCopied(false), 1800)
    })
  }

  function downloadKey() {
    if (!wallet) return
    const data = JSON.stringify({ address: wallet.address, privateKey: wallet.privateKey, createdAt: wallet.createdAt }, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `alertly-wallet-${wallet.address.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4 p-5 bg-zinc-950">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#5100fd]" /> Sniper Configuration
          <InfoTooltip text="Your wallet is stored only in this browser. The private key never reaches our servers. Keep this tab open for Auto-Trade to work." />
        </h3>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push("/onboarding?page=trading")}
            title="Settings"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-[#5100fd] hover:border-[#5100fd] transition-all"
          >
            <Settings className="w-3.5 h-3.5 text-white" />
          </button>
          <button
            onClick={onToggle}
            disabled={!wallet}
            title={wallet ? (settings.autoTrade ? "Auto-Trade ON — click to disable" : "Auto-Trade OFF — click to enable") : "Generate a wallet first to enable Auto-Trade"}
            className={`w-12 h-6 rounded-full flex items-center px-1 transition-all shadow-2xl ${settings.autoTrade && wallet ? "bg-[#5100fd]" : "bg-zinc-800"} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-md ${settings.autoTrade && wallet ? "translate-x-6" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      {/* ── No wallet yet ── */}
      {!wallet && (
        <div className="space-y-3">
          {!showImport ? (
            <div className="space-y-2">
              <p className="text-[11px] text-zinc-400">Create a new wallet or import one you already own.</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-[#5100fd] hover:bg-[#6a1aff] text-white text-[11px] font-bold py-2.5 transition-all disabled:opacity-60"
                >
                  {generating ? "Generating…" : "Generate Wallet"}
                </button>
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 text-[11px] font-bold py-2.5 transition-all"
                >
                  <Upload className="w-3 h-3" /> Import Key
                </button>
              </div>
              {generateError && (
                <p className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{generateError}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-zinc-400 font-semibold">Paste your private key (base64 or JSON array):</p>
              <textarea
                value={importKeyInput}
                onChange={e => { setImportKeyInput(e.target.value); setImportError(null) }}
                placeholder="Private key…"
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-[11px] font-mono text-white resize-none focus:border-[#5100fd] outline-none"
              />
              {importError && <p className="text-[10px] text-red-400">{importError}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleImport}
                  disabled={importing || !importKeyInput.trim()}
                  className="rounded-xl bg-[#5100fd] hover:bg-[#6a1aff] text-white text-[11px] font-bold py-2 transition-all disabled:opacity-60"
                >
                  {importing ? "Importing…" : "Import"}
                </button>
                <button
                  onClick={() => { setShowImport(false); setImportKeyInput(""); setImportError(null) }}
                  className="rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-400 text-[11px] font-bold py-2 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Wallet exists ── */}
      {wallet && (
        <div className="space-y-2.5">
          {/* Wallet info — single row */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 flex items-center gap-2 min-w-0">
            {/* Address + copy */}
            <a
              href={`https://solscan.io/account/${wallet.address}`}
              target="_blank"
              rel="noreferrer"
              title="View on Solscan"
              className="font-mono text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors truncate min-w-0 flex-1"
            >
              {shortAddr(wallet.address)}
            </a>
            <button
              onClick={copyAddr}
              title={addrCopied ? "Copied!" : "Copy address"}
              className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
            >
              {addrCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
            {/* Divider */}
            <div className="w-px h-4 bg-zinc-700 flex-shrink-0" />
            {/* Balance */}
            <span className="text-sm font-black text-white whitespace-nowrap flex-shrink-0">
              {balance !== null ? balance.toFixed(2) : "—"}
              <span className="text-[10px] text-zinc-400 ml-1">SOL</span>
            </span>
            {/* Refresh */}
            {loadingBalance ? (
              <RefreshCw className="w-3 h-3 text-zinc-500 animate-spin flex-shrink-0" />
            ) : (
              <button onClick={() => fetchBalance(wallet.address)} title="Refresh balance" className="flex-shrink-0">
                <RefreshCw className="w-3 h-3 text-zinc-500 hover:text-white transition-colors" />
              </button>
            )}
          </div>

          {/* Action row: Send | View Key | Export */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => { setShowSend(v => !v); setSendError(null); setSendTxId(null) }}
              className={`flex items-center justify-center gap-1 rounded-xl border text-[10px] font-bold py-2 transition-all ${showSend ? "bg-[#5100fd]/20 border-[#5100fd]/50 text-[#5100fd]" : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white"}`}
            >
              <Send className="w-3 h-3" /> Send
            </button>
            <button
              onClick={() => setShowKey(v => !v)}
              className="flex items-center justify-center gap-1 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white text-[10px] font-bold py-2 transition-all"
            >
              {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showKey ? "Hide Key" : "View Key"}
            </button>
            <button
              onClick={downloadKey}
              className="flex items-center justify-center gap-1 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white text-[10px] font-bold py-2 transition-all"
            >
              <Download className="w-3 h-3" /> Export
            </button>
          </div>

          {/* Send form */}
          {showSend && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 space-y-2">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Send SOL</p>
              <input
                type="text"
                value={sendTo}
                onChange={e => { setSendTo(e.target.value); setSendError(null); setSendTxId(null) }}
                placeholder="Recipient address"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-[11px] font-mono text-white focus:border-[#5100fd] outline-none"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={sendAmount}
                  onChange={e => { setSendAmount(e.target.value); setSendError(null); setSendTxId(null) }}
                  placeholder="Amount (SOL)"
                  min="0"
                  step="0.001"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-[11px] text-white focus:border-[#5100fd] outline-none"
                />
                {balance !== null && (
                  <button
                    onClick={() => setSendAmount(Math.max(0, balance - 0.001).toFixed(4))}
                    className="text-[9px] font-bold text-[#5100fd] hover:text-white px-2 transition-colors whitespace-nowrap"
                  >
                    MAX
                  </button>
                )}
              </div>
              <button
                onClick={handleSend}
                disabled={sending || !sendTo.trim() || !sendAmount || parseFloat(sendAmount) <= 0}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#5100fd] hover:bg-[#6a1aff] disabled:opacity-50 text-white text-[11px] font-bold py-2 transition-all"
              >
                {sending ? "Sending…" : <><Send className="w-3 h-3" /> Send</>}
              </button>
              {sendError && (
                <p className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{sendError}</p>
              )}
              {sendTxId && (
                <div className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 space-y-1">
                  <p className="font-bold">Sent!</p>
                  <a
                    href={`https://solscan.io/tx/${sendTxId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono break-all underline hover:text-green-300"
                  >
                    View on Solscan ↗
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Private key reveal */}
          {showKey && (
            <div className="space-y-2">
              <InfoBanner type="danger">
                <strong>Never share your private key.</strong> Anyone who has it can access and drain your wallet.
              </InfoBanner>
              <div className="bg-zinc-900 border border-red-900/50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest">Private Key (base64)</span>
                  <button
                    onClick={copyKey}
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold transition-all"
                  >
                    {keyCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    {keyCopied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="font-mono text-[9px] text-red-300 break-all select-all leading-relaxed">
                  {wallet.privateKey}
                </p>
              </div>
              <InfoBanner type="warning">
                <strong>Back up this key now.</strong> If you clear your browser data or switch to a different browser, you will permanently lose access to this wallet and any funds inside it.
              </InfoBanner>
            </div>
          )}

          {/* Quiet storage reminder */}
          {!showKey && (
            <p className="text-[10px] text-zinc-500">Stored only in this browser. Use Export to back up your key.</p>
          )}

          {/* Remove */}
          {!showRemoveConfirm ? (
            <button
              onClick={() => setShowRemoveConfirm(true)}
              className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Remove wallet from this browser
            </button>
          ) : (
            <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-3 space-y-2">
              <p className="text-[10px] text-red-300 font-semibold">Back up your private key first. This cannot be undone.</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleRemove} className="rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold py-1.5 transition-all cursor-pointer">
                  Yes, Remove
                </button>
                <button onClick={() => setShowRemoveConfirm(false)} className="rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 text-[10px] font-bold py-1.5 transition-all cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-zinc-900" />

      {/* Trading Parameters */}
      <div>
        <p className="text-[11px] text-white uppercase font-black tracking-widest mb-2">Trading Parameters</p>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: "Size", value: `${settings.buyAmount}`, unit: "SOL", color: "text-white" },
            { label: "Slip", value: `${settings.slippage}`, unit: "%", color: "text-white" },
            { label: "SL", value: `-${settings.stopLoss}`, unit: "%", color: "text-red-500" },
            { label: "TP", value: `+${settings.takeProfit}`, unit: "%", color: "text-green-500" },
          ].map(p => (
            <div
              key={p.label}
              onClick={() => router.push("/onboarding")}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 hover:border-[#5100fd]/50 transition-all cursor-pointer group flex flex-col items-center text-center"
            >
              <p className="text-[10px] text-white uppercase font-black mb-1.5 tracking-widest group-hover:text-[#5100fd] transition-colors">
                {p.label}
              </p>
              <p className={`text-sm font-black leading-none ${p.color}`}>
                {p.value}<span className="text-[10px] text-zinc-400">{p.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {settings.autoTrade && wallet && (
          <p className="mt-1.5 text-[10px] text-green-400/80">● Auto-Trade ON — keep this tab open for trades to execute.</p>
        )}
        {settings.autoTrade && !wallet && (
          <p className="mt-1.5 text-[10px] text-amber-400/80">● Generate or import a wallet above to activate Auto-Trade.</p>
        )}
      </div>

    </div>
  )
}
