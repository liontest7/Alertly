import { Button } from "@/components/ui/button"
import { Zap, Settings, Key, ArrowDownCircle, ArrowUpCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export function SniperConfigWallet({ settings, onToggle, user }: { settings: any, onToggle: () => void, user: any }) {
  const router = useRouter();
  const [tradingWallet, setTradingWallet] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [importKey, setImportKey] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (user) {
      fetch('/api/trading-wallet')
        .then(res => res.json())
        .then(data => setTradingWallet(data))
        .catch(() => {});
    }
  }, [user]);

  const generateWallet = async () => {
    setWalletError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/trading-wallet/generate', { method: 'POST' });
      const data = await res.json();
      if (res.ok) setTradingWallet(data);
      else setWalletError(data?.message || "Failed to create wallet");
    } catch {
      setWalletError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importKey) return;
    setWalletError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/trading-wallet/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privateKey: importKey })
      });
      const data = await res.json();
      if (res.ok) {
        setTradingWallet(data);
        setImportKey("");
        setShowImport(false);
      } else {
        setWalletError(data?.message || "Failed to import wallet");
      }
    } catch {
      setWalletError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 p-5 bg-zinc-950">

      {/* Header — title + icon-only settings + toggle, all on one line */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#5100fd]" /> Sniper Configuration
        </h3>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push('/onboarding?page=trading')}
            title="Settings"
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-[#5100fd] hover:border-[#5100fd] transition-all"
          >
            <Settings className="w-3.5 h-3.5 text-white" />
          </button>
          <button
            onClick={onToggle}
            className={`w-12 h-6 rounded-full flex items-center px-1 transition-all shadow-2xl ${settings.autoTrade ? 'bg-[#5100fd]' : 'bg-zinc-800'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-md ${settings.autoTrade ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Wallet — always on top */}
      <div className="space-y-2.5">
        {walletError && (
          <div className="text-[10px] text-red-400 bg-red-900/20 border border-red-500/20 rounded-lg p-2">
            {walletError}
          </div>
        )}

        {!tradingWallet ? (
          !showImport ? (
            <div className="space-y-2">
              <p className="text-[12px] text-white font-semibold">Generate or import your trading wallet</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={generateWallet}
                  disabled={loading}
                  className="bg-[#5100fd] hover:bg-[#6610ff] h-10 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg shadow-[#5100fd]/20"
                >
                  {loading ? 'GENERATING...' : 'CREATE WALLET'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowImport(true)}
                  className="border-zinc-800 bg-zinc-900 h-10 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-zinc-800"
                >
                  IMPORT KEY
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Private Key</label>
              <input
                type="password"
                value={importKey}
                onChange={(e) => setImportKey(e.target.value)}
                placeholder="Paste private key here"
                className="w-full bg-black border border-zinc-800 rounded-lg p-2.5 text-[10px] text-white focus:outline-none focus:border-[#5100fd] font-mono shadow-inner"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowImport(false)}
                  className="flex-1 border-zinc-800 bg-zinc-900 h-9 rounded-lg text-[9px] font-black uppercase"
                >
                  BACK
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={loading || !importKey}
                  className="flex-[2] bg-[#5100fd] hover:bg-[#6610ff] h-9 rounded-lg text-[9px] font-black uppercase"
                >
                  {loading ? 'IMPORTING...' : 'CONFIRM'}
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-2">
            {/* Address */}
            <div className="p-2.5 rounded-lg bg-black border border-zinc-800">
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">Address</p>
              <p className="text-[10px] font-mono text-zinc-300 break-all">{tradingWallet.address}</p>
            </div>

            {/* Deposit / Withdraw / Key — all in one row */}
            <div className="grid grid-cols-3 gap-1.5">
              <Button
                variant="outline"
                className="h-9 rounded-lg border-zinc-800 bg-zinc-900 text-[8px] font-black text-white hover:bg-zinc-800 flex items-center justify-center gap-1 uppercase"
              >
                <ArrowDownCircle className="w-3 h-3 text-green-500" /> Deposit
              </Button>
              <Button
                variant="outline"
                className="h-9 rounded-lg border-zinc-800 bg-zinc-900 text-[8px] font-black text-white hover:bg-zinc-800 flex items-center justify-center gap-1 uppercase"
              >
                <ArrowUpCircle className="w-3 h-3 text-[#5100fd]" /> Withdraw
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowKey(!showKey)}
                className="h-9 rounded-lg border border-zinc-800 bg-zinc-900 text-[8px] font-black text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center gap-1 uppercase"
              >
                <Key className="w-3 h-3" /> Key
              </Button>
            </div>

            {showKey && (
              <div className="p-2 bg-red-500/5 border border-red-500/20 rounded-lg">
                <p className="text-[8px] font-mono text-red-400 break-all select-all">
                  {tradingWallet.privateKey || "Click export to decrypt..."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-900" />

      {/* Trading Parameters — 4 in one row */}
      <div>
        <p className="text-[11px] text-white uppercase font-black tracking-widest mb-2">Trading Parameters</p>
        <div className="grid grid-cols-4 gap-1.5">
          <div
            onClick={() => router.push('/onboarding')}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 hover:border-[#5100fd]/50 transition-all cursor-pointer group flex flex-col items-center text-center"
          >
            <p className="text-[10px] text-white uppercase font-black mb-1.5 tracking-widest group-hover:text-[#5100fd] transition-colors">Size</p>
            <p className="text-sm font-black text-white leading-none">{settings.buyAmount} <span className="text-[10px] text-zinc-400">SOL</span></p>
          </div>
          <div
            onClick={() => router.push('/onboarding')}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 hover:border-[#5100fd]/50 transition-all cursor-pointer group flex flex-col items-center text-center"
          >
            <p className="text-[10px] text-white uppercase font-black mb-1.5 tracking-widest group-hover:text-[#5100fd] transition-colors">Slip</p>
            <p className="text-sm font-black text-white leading-none">{settings.slippage}<span className="text-[10px] text-zinc-400">%</span></p>
          </div>
          <div
            onClick={() => router.push('/onboarding')}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 hover:border-[#5100fd]/50 transition-all cursor-pointer group flex flex-col items-center text-center"
          >
            <p className="text-[10px] text-white uppercase font-black mb-1.5 tracking-widest group-hover:text-[#5100fd] transition-colors">SL</p>
            <p className="text-sm font-black text-red-500 leading-none">-{settings.stopLoss}<span className="text-[10px]">%</span></p>
          </div>
          <div
            onClick={() => router.push('/onboarding')}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 hover:border-[#5100fd]/50 transition-all cursor-pointer group flex flex-col items-center text-center"
          >
            <p className="text-[10px] text-white uppercase font-black mb-1.5 tracking-widest group-hover:text-[#5100fd] transition-colors">TP</p>
            <p className="text-sm font-black text-green-500 leading-none">+{settings.takeProfit}<span className="text-[10px]">%</span></p>
          </div>
        </div>
      </div>

    </div>
  )
}
