import { Card } from "@/components/ui/card"
import { Wallet, Key, ArrowDownCircle, ArrowUpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

export function WalletMiniCard({ user }: { user: any }) {
  const [tradingWallet, setTradingWallet] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

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
    } finally {
      setLoading(false);
    }
  };

  const [importKey, setImportKey] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showKey, setShowKey] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 text-white">
      <h3 className="text-sm font-black uppercase tracking-widest mb-6 flex items-center gap-2">
        <Wallet className="w-4 h-4 text-[#5100fd]" /> Sniper Wallet
      </h3>
      <div className="grid grid-cols-2 gap-3 mb-6 pb-6 border-b border-zinc-900">
        <div className="bg-zinc-900 rounded-xl p-3">
          <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Total Balance</p>
          <p className="text-base font-black text-white">0.0000 SOL</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-3">
          <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">PNL (24h)</p>
          <p className="text-base font-black text-green-500">+0.00%</p>
        </div>
      </div>
      <div className="space-y-6">
        {walletError && (
          <div className="text-[11px] text-red-400 bg-red-900/20 border border-red-500/20 rounded-xl p-3">
            {walletError}
          </div>
        )}
        {!tradingWallet ? (
          <div className="space-y-4">
            {!showImport ? (
              <div className="space-y-3">
                <p className="text-[12px] text-white font-medium leading-relaxed opacity-80">
                  Generate a new secure trading wallet or import your existing one.
                </p>
                <div className="grid grid-cols-1 gap-3 pt-2">
                  <Button 
                    onClick={generateWallet}
                    disabled={loading}
                    className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-12 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-[#5100fd]/20"
                  >
                    {loading ? 'GENERATING...' : 'CREATE NEW WALLET'}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setShowImport(true)}
                    className="w-full border-zinc-800 bg-zinc-900 h-12 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-zinc-800"
                  >
                    IMPORT PRIVATE KEY
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-70">Private Key (Hex or Base58)</label>
                  <input 
                    type="password"
                    value={importKey}
                    onChange={(e) => setImportKey(e.target.value)}
                    placeholder="Paste private key here"
                    className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-[11px] text-white focus:outline-none focus:border-[#5100fd] font-mono shadow-inner"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => setShowImport(false)}
                    className="flex-1 border-zinc-800 bg-zinc-900 h-10 rounded-xl text-[10px] font-black uppercase"
                  >
                    BACK
                  </Button>
                  <Button 
                    onClick={handleImport}
                    disabled={loading || !importKey}
                    className="flex-[2] bg-[#5100fd] hover:bg-[#6610ff] h-10 rounded-xl text-[10px] font-black uppercase"
                  >
                    {loading ? 'IMPORTING...' : 'CONFIRM IMPORT'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-black border border-zinc-800 space-y-2 shadow-inner">
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Active Sniper Address</p>
              <p className="text-[11px] font-mono text-white break-all select-all font-bold">{tradingWallet.address}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-11 rounded-xl border-zinc-800 bg-zinc-900 text-[10px] font-black text-white hover:bg-zinc-800 flex items-center justify-center gap-2">
                <ArrowDownCircle className="w-3.5 h-3.5 text-green-500" /> DEPOSIT
              </Button>
              <Button variant="outline" className="h-11 rounded-xl border-zinc-800 bg-zinc-900 text-[10px] font-black text-white hover:bg-zinc-800 flex items-center justify-center gap-2">
                <ArrowUpCircle className="w-3.5 h-3.5 text-[#5100fd]" /> WITHDRAW
              </Button>
            </div>

            <div className="pt-2 border-t border-zinc-900">
              <Button 
                variant="ghost" 
                onClick={() => setShowKey(!showKey)}
                className="w-full h-10 text-[10px] font-black text-white/60 hover:text-white flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <Key className="w-3 h-3" /> {showKey ? 'HIDE' : 'SHOW'} PRIVATE KEY
              </Button>
              {showKey && (
                <div className="mt-2 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <p className="text-[9px] font-mono text-red-400 break-all select-all font-bold">
                    {tradingWallet.privateKey || "Click export to decrypt..."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
