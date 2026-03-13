import { Card } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function CopyTradingMiniCard() {
  const [address, setAddress] = useState("");
  const [buyAmount, setBuyAmount] = useState("0.5");
  const [loading, setLoading] = useState(false);
  const [traders, setTraders] = useState<any[]>([]);
  const [mode, setMode] = useState<"both" | "alert" | "trade">("both");

  const isAlertOnly = mode === "alert";

  const addTrader = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch('/api/copy-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          buyAmount: isAlertOnly ? 0 : parseFloat(buyAmount),
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
    <Card className="bg-zinc-950 border-zinc-900 p-5 rounded-[2rem] shadow-xl hover:border-zinc-800/50 transition-all group text-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[12px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#5100fd]" /> Copy Trading
        </h3>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest">Live</span>
        </div>
      </div>

      {traders.length > 0 ? (
        <div className="space-y-2 mb-3">
          {traders.map((trader, i) => (
            <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="flex flex-col">
                <span className="text-[10px] font-black font-mono text-zinc-300">{trader.address.slice(0, 8)}…{trader.address.slice(-4)}</span>
                <div className="flex gap-1.5 mt-1">
                  <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">{trader.status}</span>
                  <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-[#5100fd]/20 border border-[#5100fd]/30 text-[#5100fd]">{trader.mode}</span>
                </div>
              </div>
              <span className="text-sm font-black text-green-400">{trader.profit}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-zinc-600 font-bold italic text-center mb-2">No active copy traders</p>
      )}

      <div className="space-y-2.5 pt-3 border-t border-zinc-900">
        {/* Target Wallet */}
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Target Wallet</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Solana Address"
            className="w-full bg-black border border-zinc-800 rounded-xl p-2.5 text-[10px] text-white focus:outline-none focus:border-[#5100fd] font-mono"
          />
        </div>

        {/* Mode + Amount — same row */}
        <div className={`grid gap-2.5 ${!isAlertOnly ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="w-full bg-black border border-zinc-800 rounded-xl p-2.5 text-[10px] text-white focus:outline-none focus:border-[#5100fd] font-bold appearance-none cursor-pointer"
            >
              <option value="both">Trade & Alert</option>
              <option value="trade">Trade Only</option>
              <option value="alert">Alert Only</option>
            </select>
          </div>

          {!isAlertOnly && (
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Amount (SOL)</label>
              <input
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="0.5"
                className="w-full bg-black border border-zinc-800 rounded-xl p-2.5 text-[10px] text-white focus:outline-none focus:border-[#5100fd] font-bold"
              />
            </div>
          )}
        </div>

        <Button
          onClick={addTrader}
          disabled={loading || !address}
          className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-10 rounded-xl text-[10px] font-black text-white uppercase tracking-widest shadow-lg shadow-[#5100fd]/20"
        >
          {loading ? 'PROCESSING...' : 'ACTIVATE COPY'}
        </Button>
      </div>
    </Card>
  )
}
