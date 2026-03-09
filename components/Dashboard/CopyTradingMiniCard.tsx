import { Card } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

export function CopyTradingMiniCard() {
  const [address, setAddress] = useState("");
  const [buyAmount, setBuyAmount] = useState("0.5");
  const [loading, setLoading] = useState(false);
  const [traders, setTraders] = useState<any[]>([]);
  const [mode, setMode] = useState<"both" | "alert" | "trade">("both");

  const addTrader = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch('/api/copy-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address, 
          buyAmount: parseFloat(buyAmount),
          mode 
        })
      });
      if (res.ok) {
        setTraders([...traders, { address, profit: "0.0%", status: "Live", mode }]);
        setAddress("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-zinc-950 border-zinc-900 p-6 rounded-[2rem] shadow-xl hover:border-zinc-800/50 transition-all group text-white">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[12px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#5100fd]" /> Copy Trading
        </h3>
        <div className="flex items-center gap-1.5">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
           <span className="text-[10px] font-black uppercase tracking-widest">Live</span>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-[11px] text-white font-medium leading-relaxed mb-4">
          Mirror wallet moves with custom allocation or get alerts only.
        </p>
        
        {traders.length > 0 ? (
          traders.map((trader, i) => (
            <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-zinc-900 border border-zinc-800 group-hover:border-zinc-700 transition-all">
              <div className="flex flex-col">
                <span className="text-[11px] font-black font-mono">{trader.address}</span>
                <div className="flex gap-2 mt-1">
                  <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">{trader.status}</span>
                  <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-[#5100fd]/20 border border-[#5100fd]/30 text-[#5100fd]">{trader.mode}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-green-400">{trader.profit}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-[10px] text-white font-bold italic text-center py-2 opacity-50">No active copy traders</p>
        )}
        
        <div className="space-y-4 mt-6 pt-4 border-t border-zinc-900">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white">Target Wallet</label>
            <input 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Solana Address" 
              className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-[11px] text-white focus:outline-none focus:border-[#5100fd] font-mono shadow-inner" 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white">Amount (SOL)</label>
              <input 
                type="number" 
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="0.5" 
                className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-[11px] text-white focus:outline-none focus:border-[#5100fd] font-bold shadow-inner" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white">Mode</label>
              <select 
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-[11px] text-white focus:outline-none focus:border-[#5100fd] font-bold appearance-none cursor-pointer"
              >
                <option value="both">Trade & Alert</option>
                <option value="trade">Trade Only</option>
                <option value="alert">Alert Only</option>
              </select>
            </div>
          </div>

          <Button 
            onClick={addTrader}
            disabled={loading || !address}
            className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-12 rounded-xl text-[11px] font-black text-white uppercase tracking-widest shadow-lg shadow-[#5100fd]/20 mt-2"
          >
            {loading ? 'PROCESSING...' : 'ACTIVATE COPY'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
