import { Card } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

export function CopyTradingMiniCard() {
  const [address, setAddress] = useState("");
  const [buyAmount, setBuyAmount] = useState("0.5");
  const [loading, setLoading] = useState(false);
  const [traders, setTraders] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/copy-trading')
      .then(res => res.json())
      .then(data => setTraders(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const addTrader = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch('/api/copy-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, buyAmount: parseFloat(buyAmount) })
      });
      if (res.ok) {
        setTraders([...traders, { address, profit: "0.0%", status: "Live" }]);
        setAddress("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-zinc-950 border-zinc-900 p-6 rounded-[2rem] shadow-xl hover:border-zinc-800/50 transition-all group">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[12px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#5100fd]" /> Copy Trading
        </h3>
        <div className="flex items-center gap-1.5">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
           <span className="text-[10px] font-black text-white uppercase tracking-widest">Live</span>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-[11px] text-white/90 leading-relaxed mb-4">
          Enter a wallet address to automatically mirror their trades with your custom allocation.
        </p>
        
        {traders.length > 0 ? (
          traders.map((trader, i) => (
            <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-zinc-900 border border-zinc-800 group-hover:border-zinc-700 transition-all">
              <div className="flex flex-col">
                <span className="text-[11px] font-black font-mono text-white">{trader.address}</span>
                <span className="text-[9px] text-white font-black uppercase tracking-tighter">{trader.status}</span>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-green-400">{trader.profit}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-[10px] text-white/40 italic text-center py-2">No active copy traders</p>
        )}
        
        <div className="space-y-3 mt-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-white uppercase tracking-widest">Wallet Address</label>
            <input 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter Solana Address" 
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-[11px] text-white focus:outline-none focus:border-[#5100fd] font-mono" 
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-white uppercase tracking-widest">Amount (SOL)</label>
              <input 
                type="number" 
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="0.5" 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-[11px] text-white focus:outline-none focus:border-[#5100fd]" 
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={addTrader}
                disabled={loading || !address}
                className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-11 rounded-xl text-[10px] font-black text-white uppercase tracking-widest"
              >
                {loading ? 'ADDING...' : 'ADD WALLET'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
