import { Card } from "@/components/ui/card"
import { Zap, Settings, Shield, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

function MiniSetting({ label, value, color = "text-white" }: { label: string, value: string, color?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-[#5100fd]/50 transition-all group">
      <p className="text-[9px] text-white uppercase font-black mb-1 tracking-wider group-hover:text-[#5100fd] transition-colors">{label}</p>
      <p className={`text-sm font-black ${color}`}>{value}</p>
    </div>
  )
}

function StatusIndicator({ active, label }: { active: boolean, label?: string }) {
  return (
    <div className="flex items-center gap-2 bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">
      <span className="text-[8px] font-black text-white uppercase tracking-tighter">{label}</span>
      <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-[#5100fd] shadow-[0_0_8px_#5100fd]' : 'bg-zinc-700'}`} />
    </div>
  )
}

export function QuickSettingsCard({ settings, onToggle }: { settings: any, onToggle: () => void }) {
  const router = useRouter();
  
  return (
    <Card className="bg-zinc-950 border-zinc-900 p-6 rounded-[2rem] space-y-6 shadow-2xl">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#5100fd]" /> Sniper Config
        </h3>
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/onboarding')}
            className="h-8 px-4 text-[10px] font-black text-white hover:bg-zinc-900 uppercase tracking-tighter bg-zinc-900 border border-zinc-800 rounded-lg"
          >
            <Settings className="w-3 h-3 mr-1" /> Full Setup
          </Button>
          <button 
            onClick={onToggle}
            className={`w-12 h-6 rounded-full flex items-center px-1 transition-all shadow-2xl ${settings.autoTrade ? 'bg-[#5100fd]' : 'bg-zinc-800'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-md ${settings.autoTrade ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <MiniSetting label="Entry Size" value={`${settings.buyAmount} SOL`} />
        <MiniSetting label="Slippage" value={`${settings.slippage}%`} />
        <MiniSetting label="Stop Loss" value={`-${settings.stopLoss}%`} color="text-red-500" />
        <MiniSetting label="Take Profit" value={`+${settings.takeProfit}%`} color="text-green-500" />
      </div>

      <div className="pt-4 border-t border-zinc-900 space-y-4">
        <div className="flex items-center justify-between text-[10px] font-black text-white uppercase tracking-widest">
          <div className="flex items-center gap-2"><Target className="w-3 h-3 text-[#5100fd]" /> Active Trackers</div>
          <div className="flex flex-wrap gap-2 justify-end">
            <StatusIndicator active={settings.volumeSpikeEnabled} label="Vol" />
            <StatusIndicator active={settings.whaleAlertEnabled} label="Whl" />
            <StatusIndicator active={settings.dexBoostEnabled} label="Bst" />
            <StatusIndicator active={settings.dexListingEnabled} label="Lst" />
          </div>
        </div>
      </div>
    </Card>
  )
}
