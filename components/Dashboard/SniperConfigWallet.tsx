import { Card } from "@/components/ui/card"
import { Zap, Settings, Target, Wallet, Key, ArrowDownCircle, ArrowUpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

function MiniSetting({ label, value, color = "text-white", onClick }: { label: string, value: string, color?: string, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 hover:border-[#5100fd]/50 transition-all group cursor-pointer"
    >
      <p className="text-[9px] text-zinc-400 uppercase font-black mb-1 tracking-widest group-hover:text-[#5100fd] transition-colors">{label}</p>
      <p className={`text-sm font-black ${color}`}>{value}</p>
    </div>
  )
}

function StatusIndicator({ active, label }: { active: boolean, label?: string }) {
  return (
    <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
      <span className="text-[8px] font-black text-zinc-400 uppercase tracking-wider">{label}</span>
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-[#5100fd] shadow-[0_0_10px_#5100fd]' : 'bg-zinc-700'}`} />
    </div>
  )
}

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
    } catch (err) {
      console.error(err);
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
    } catch (err) {
      console.error(err);
      setWalletError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 bg-zinc-950">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#5100fd]" /> Sniper Configuration
        </h3>
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/onboarding?page=trading')}
            className="h-9 px-4 text-[10px] font-black text-white hover:bg-[#5100fd] uppercase tracking-widest bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg transition-all"
          >
            <Settings className="w-3 h-3 mr-1.5" /> SETTINGS
          </Button>
          <button 
            onClick={onToggle}
            className={`w-12 h-6 rounded-full flex items-center px-1 transition-all shadow-2xl ${settings.autoTrade ? 'bg-[#5100fd]' : 'bg-zinc-800'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-md ${settings.autoTrade ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Trading Parameters */}
      <div>
        <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mb-3">Trading Parameters</p>
        <div className="grid grid-cols-2 gap-2">
          <MiniSetting label="Entry Size" value={`${settings.buyAmount} SOL`} onClick={() => router.push('/onboarding')} />
          <MiniSetting label="Slippage" value={`${settings.slippage}%`} onClick={() => router.push('/onboarding')} />
          <MiniSetting label="Stop Loss" value={`-${settings.stopLoss}%`} color="text-red-500" onClick={() => router.push('/onboarding')} />
          <MiniSetting label="Take Profit" value={`+${settings.takeProfit}%`} color="text-green-500" onClick={() => router.push('/onboarding')} />
        </div>
      </div>

      {/* Active Trackers */}
      <div className="pt-4 border-t border-zinc-900 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-3 h-3 text-[#5100fd]" />
            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Active Filters</span>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <StatusIndicator active={settings.volumeSpikeEnabled} label="Vol" />
            <StatusIndicator active={settings.whaleAlertEnabled} label="Whl" />
            <StatusIndicator active={settings.dexBoostEnabled} label="Bst" />
            <StatusIndicator active={settings.dexListingEnabled} label="Lst" />
          </div>
        </div>
      </div>

      {/* Wallet Section */}
      <div className="pt-4 border-t border-zinc-900 space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5 text-[#5100fd]" />
          <h4 className="text-xs font-black text-white uppercase tracking-widest">Sniper Wallet</h4>
        </div>

        {/* Balance & PNL */}
        {tradingWallet && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-900 rounded-lg p-3">
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-1">Balance</p>
              <p className="text-sm font-black text-white">0.0000 SOL</p>
            </div>
            <div className="bg-zinc-900 rounded-lg p-3">
              <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-1">PNL (All-Time)</p>
              <p className="text-sm font-black text-green-500">+0.00%</p>
            </div>
          </div>
        )}

        {/* Wallet Actions */}
        {walletError && (
          <div className="text-[10px] text-red-400 bg-red-900/20 border border-red-500/20 rounded-lg p-2">
            {walletError}
          </div>
        )}

        {!tradingWallet ? (
          !showImport ? (
            <div className="space-y-2">
              <p className="text-[11px] text-zinc-400 font-medium leading-relaxed">Generate or import your trading wallet</p>
              <div className="space-y-2">
                <Button 
                  onClick={generateWallet}
                  disabled={loading}
                  className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-11 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg shadow-[#5100fd]/20"
                >
                  {loading ? 'GENERATING...' : 'CREATE WALLET'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowImport(true)}
                  className="w-full border-zinc-800 bg-zinc-900 h-11 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800"
                >
                  IMPORT KEY
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-70">Private Key</label>
                <input 
                  type="password"
                  value={importKey}
                  onChange={(e) => setImportKey(e.target.value)}
                  placeholder="Paste private key here"
                  className="w-full bg-black border border-zinc-800 rounded-lg p-2.5 text-[10px] text-white focus:outline-none focus:border-[#5100fd] font-mono shadow-inner"
                />
              </div>
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
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-black border border-zinc-800 space-y-1 shadow-inner">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Address</p>
              <p className="text-[10px] font-mono text-zinc-300 break-all select-all">{tradingWallet.address.substring(0, 20)}...</p>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-10 rounded-lg border-zinc-800 bg-zinc-900 text-[9px] font-black text-white hover:bg-zinc-800 flex items-center justify-center gap-1">
                <ArrowDownCircle className="w-3 h-3 text-green-500" /> DEPOSIT
              </Button>
              <Button variant="outline" className="h-10 rounded-lg border-zinc-800 bg-zinc-900 text-[9px] font-black text-white hover:bg-zinc-800 flex items-center justify-center gap-1">
                <ArrowUpCircle className="w-3 h-3 text-[#5100fd]" /> WITHDRAW
              </Button>
            </div>

            <Button 
              variant="ghost" 
              onClick={() => setShowKey(!showKey)}
              className="w-full h-9 text-[9px] font-black text-zinc-500 hover:text-white flex items-center justify-center gap-1.5 uppercase tracking-widest"
            >
              <Key className="w-3 h-3" /> {showKey ? 'HIDE' : 'SHOW'} KEY
            </Button>
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
    </div>
  )
}
