import { Card } from "@/components/ui/card"
import { TrendingUp, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CopyTradingMiniCard() {
  // Real data structure for future sync
  const traders = [
    { address: "7xKp...4nNz", profit: "+234.8%", status: "Live" },
    { address: "3bRt...9wQx", profit: "+156.2%", status: "Active" }
  ];

  return (
    <Card className="bg-zinc-950 border-zinc-900 p-6 rounded-[2rem] shadow-xl hover:border-zinc-800/50 transition-all group">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#5100fd]" /> Copy Intelligence
        </h3>
        <div className="flex items-center gap-1.5">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
           <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Beta</span>
        </div>
      </div>
      <div className="space-y-3">
        {traders.map((trader, i) => (
          <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-zinc-900/30 border border-zinc-900 group-hover:border-zinc-800/50 transition-all">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-zinc-400">{trader.address}</span>
              <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-tighter">{trader.status}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-green-500">{trader.profit}</span>
            </div>
          </div>
        ))}
        
        <Button 
          variant="ghost" 
          className="w-full h-12 rounded-xl border border-dashed border-zinc-800 text-[10px] font-black text-zinc-500 hover:text-white hover:border-[#5100fd] hover:bg-[#5100fd]/5 mt-2 transition-all group/btn"
        >
          <UserPlus className="w-3 h-3 mr-2 group-hover/btn:scale-110 transition-transform" /> ADD ALPHA WALLET
        </Button>
      </div>
    </Card>
  )
}
