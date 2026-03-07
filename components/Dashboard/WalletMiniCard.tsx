import { Card } from "@/components/ui/card"
import { Wallet, Key, ArrowDownCircle, ArrowUpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

export function WalletMiniCard({ user }: { user: any }) {
  const [tradingWallet, setTradingWallet] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetch('/api/trading-wallet')
        .then(res => res.json())
        .then(data => setTradingWallet(data))
        .catch(() => {});
    }
  }, [user]);

  const generateWallet = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trading-wallet/generate', { method: 'POST' });
      const data = await res.json();
      if (res.ok) setTradingWallet(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-zinc-950 border-zinc-900 p-6 rounded-[2rem] shadow-xl">
      <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
        <Wallet className="w-4 h-4 text-[#5100fd]" /> Sniper Wallet
      </h3>
      <div className="space-y-6">
        {!tradingWallet ? (
          <div className="space-y-4 text-center py-4">
            <p className="text-[12px] text-white/80 leading-relaxed">
              Create a dedicated trading wallet for automated sniper execution. 
              You will have full control over the private keys.
            </p>
            <Button 
              onClick={generateWallet}
              disabled={loading}
              className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-12 rounded-xl text-[11px] font-black text-white uppercase tracking-widest"
            >
              {loading ? 'GENERATING...' : 'GENERATE TRADING WALLET'}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-black border border-zinc-800 space-y-2">
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Wallet Address</p>
              <p className="text-[11px] font-mono text-white break-all select-all">{tradingWallet.address}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-11 rounded-xl border-zinc-800 bg-zinc-900 text-[10px] font-black text-white hover:bg-zinc-800 flex items-center gap-2">
                <ArrowDownCircle className="w-3.5 h-3.5 text-green-500" /> DEPOSIT
              </Button>
              <Button variant="outline" className="h-11 rounded-xl border-zinc-800 bg-zinc-900 text-[10px] font-black text-white hover:bg-zinc-800 flex items-center gap-2">
                <ArrowUpCircle className="w-3.5 h-3.5 text-[#5100fd]" /> WITHDRAW
              </Button>
            </div>

            <Button variant="ghost" className="w-full h-10 text-[10px] font-black text-white/40 hover:text-white flex items-center justify-center gap-2 uppercase tracking-widest">
              <Key className="w-3 h-3" /> Export Private Key
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
