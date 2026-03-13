"use client"

import { Zap, Settings, Copy, Check, Eye, EyeOff, Download, Upload, Trash2, AlertTriangle, Info, RefreshCw } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import type { BrowserWallet } from "@/lib/browser-wallet"

async function walletLib() {
  const m = await import("@/lib/browser-wallet")
  return m
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function InfoBanner({ type, children }: { type: "warning" | "info" | "danger"; children: React.ReactNode }) {
  const styles = {
    warning: "bg-amber-950/40 border-amber-500/30 text-amber-300",
    info: "bg-blue-950/40 border-blue-500/30 text-blue-300",
    danger: "bg-red-950/40 border-red-500/30 text-red-300",
  }
  const icons = {
    warning: <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />,
    info: <Info className="w-3 h-3 shrink-0 mt-0.5" />,
    danger: <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />,
  }
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[10px] leading-relaxed ${styles[type]}`}>
      {icons[type]}
      <span>{children}</span>
    </div>
  )
}

export function SniperConfigWallet({ settings, onToggle, user }: { settings: any; onToggle: () => void; user: any }) {
  const router = useRouter()
  const [wallet, setWallet] = useState<BrowserWallet | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showKey, setShowKey] = useState(false)
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
    try {
      const lib = await walletLib()
      const w = await lib.generateBrowserWallet()
      setWallet(w)
      setBalance(0)
      window.dispatchEvent(new CustomEvent("alertly:wallet-changed", { detail: w }))
    } catch (e) {
      console.error(e)
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
          <InfoBanner type="info">
            Your trading wallet is generated and stored <strong>only in this browser</strong>. The private key never reaches our servers. Keep this tab open for Auto-Trade to work.
          </InfoBanner>

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
          {/* Address + balance */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Address</span>
              <div className="flex items-center gap-1.5">
                {loadingBalance ? (
                  <RefreshCw className="w-3 h-3 text-zinc-500 animate-spin" />
                ) : (
                  <button onClick={() => fetchBalance(wallet.address)} title="Refresh balance">
                    <RefreshCw className="w-3 h-3 text-zinc-500 hover:text-white transition-colors" />
                  </button>
                )}
                <span className="text-[11px] font-bold text-white">
                  {balance !== null ? `${balance.toFixed(4)} SOL` : "—"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-zinc-300 truncate">{shortAddr(wallet.address)}</span>
              <button
                onClick={copyAddr}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-all"
              >
                {addrCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {addrCopied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Action row */}
          <div className="grid grid-cols-3 gap-1.5">
            <a
              href={`https://solscan.io/account/${wallet.address}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-white text-[10px] font-bold py-2 transition-all"
            >
              Solscan ↗
            </a>
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
            <InfoBanner type="info">
              Stored <strong>only in this browser</strong>. Use <em>Export</em> to save a backup. Keep this tab open while Auto-Trade is active.
            </InfoBanner>
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
                <button onClick={handleRemove} className="rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold py-1.5 transition-all">
                  Yes, Remove
                </button>
                <button onClick={() => setShowRemoveConfirm(false)} className="rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 text-[10px] font-bold py-1.5 transition-all">
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
          <div className="mt-2">
            <InfoBanner type="info">
              Auto-Trade is <strong>ON</strong>. New alerts will trigger trades automatically in this browser. Keep this tab open.
            </InfoBanner>
          </div>
        )}
        {settings.autoTrade && !wallet && (
          <div className="mt-2">
            <InfoBanner type="warning">
              Generate or import a wallet above to activate Auto-Trade.
            </InfoBanner>
          </div>
        )}
      </div>

    </div>
  )
}
