import { Card } from "@/components/ui/card"
import { TrendingUp, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CopyTradingMiniCard() {
  // Real data structure for future sync
  const traders = [
    { address: "7xKp...4nNz", profit: "+12.4%", status: "Live" },
    { address: "3bRt...9wQx", profit: "+8.2%", status: "Active" }
  ];

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
        {traders.map((trader, i) => (
          <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-zinc-900 border border-zinc-800 group-hover:border-zinc-700 transition-all">
            <div className="flex flex-col">
              <span className="text-[11px] font-black font-mono text-white">{trader.address}</span>
              <span className="text-[9px] text-white font-black uppercase tracking-tighter">{trader.status}</span>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-green-400">{trader.profit}</span>
            </div>
          </div>
        ))}
        
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-white uppercase tracking-widest">Buy Amount (SOL)</label>
            <input type="number" placeholder="0.5" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-[11px] text-white focus:outline-none focus:border-[#5100fd]" />
          </div>
          <div className="space-y-1 flex items-end">
            <Button 
              variant="ghost" 
              className="w-full h-10 rounded-xl border border-dashed border-zinc-800 text-[10px] font-black text-white hover:text-white hover:border-[#5100fd] hover:bg-[#5100fd]/5 transition-all group/btn"
            >
              <UserPlus className="w-3 h-3 mr-2 group-hover/btn:scale-110 transition-transform" /> ADD WALLET
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
