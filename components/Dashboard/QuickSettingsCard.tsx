import { Card } from "@/components/ui/card"
import { Zap, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

function MiniSetting({ label, value, color = "text-white" }: { label: string, value: string, color?: string }) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-700 transition-all group">
      <p className="text-[9px] text-zinc-500 uppercase font-bold mb-1 tracking-wider group-hover:text-zinc-400">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  )
}

export function QuickSettingsCard({ settings, onToggle }: { settings: any, onToggle: () => void }) {
  const router = useRouter();
  return (
    <Card className="bg-zinc-950 border-zinc-900 p-6 rounded-[2rem]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" /> Quick Settings
        </h3>
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/onboarding')}
            className="h-7 px-2 text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-tighter"
          >
            <Settings className="w-3 h-3 mr-1" /> Edit All
          </Button>
          <button 
            onClick={onToggle}
            className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-all shadow-inner ${settings.autoTrade ? 'bg-green-500' : 'bg-zinc-800'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${settings.autoTrade ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <MiniSetting label="Buy" value={`${settings.buyAmount} SOL`} />
        <MiniSetting label="Slippage" value={`${settings.slippage}%`} />
        <MiniSetting label="Stop Loss" value={`${settings.stopLoss}%`} color="text-red-500" />
        <MiniSetting label="Take Profit" value={`+${settings.takeProfit}%`} color="text-green-500" />
      </div>
    </Card>
  )
}
