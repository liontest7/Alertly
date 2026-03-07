import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, Loader2 } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

function FilterChip({ label, active = false }: { label: string, active?: boolean }) {
  return (
    <button className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all duration-200 shadow-sm ${
      active 
        ? 'bg-[#5100fd] border-[#5100fd] text-white shadow-[#5100fd]/20' 
        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 hover:bg-zinc-900'
    }`}>
      {label}
    </button>
  )
}

export function AlphaFeed({ alerts, loading, settings, user }: { alerts: any[], loading: boolean, settings: any, user: any }) {
  const router = useRouter();
  const [executing, setExecuting] = useState<string | null>(null);

  const handleQuickBuy = async (token: any) => {
    if (!user) {
      alert("Please connect your wallet to execute trades.");
      return;
    }
    const tokenName = token.name || token.token
    if (!token.address) {
      alert("This alert does not include a valid token address.")
      return
    }

    setExecuting(tokenName)
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'buy',
          tokenAddress: token.address,
          amount: settings.buyAmount,
          slippage: settings.slippage
        })
      })
      const data = await res.json()
      if (data.success) {
        alert(`Trade Successful!\nToken: ${tokenName}\nTransaction: ${data.txSig.substring(0, 16)}...`)
      } else {
        alert(`Trade failed: ${data.message}`)
      }
    } catch (err) {
      alert("Trade execution failed. Check console for details.")
    } finally {
      setExecuting(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-950 border-zinc-900 overflow-hidden shadow-2xl rounded-[2rem]">
        <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
            <h2 className="text-sm font-black tracking-tight text-white uppercase">Live Alpha Feed</h2>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/onboarding')}
            className="text-[10px] font-black text-white hover:text-[#5100fd] uppercase tracking-widest bg-zinc-900/50 border border-zinc-800 rounded-lg px-3"
          >
            <Settings className="w-3 h-3 mr-1.5" /> Edit Configuration
          </Button>
        </div>
        
        <div className="max-h-[700px] overflow-y-auto divide-y divide-zinc-900/50">
          {alerts.length === 0 ? (
            <div className="p-8 text-sm text-zinc-500">
              {loading ? "Loading live alerts..." : "No live alerts matched your filters yet."}
            </div>
          ) : alerts.map((token: any, i: number) => {
            const name = token.name || token.token
            return (
            <div key={i} className="group p-6 hover:bg-white/[0.02] transition-all flex items-center gap-8">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-white shadow-inner overflow-hidden">
                {token.imageUrl ? (
                  <img src={token.imageUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                  name?.[0] || 'T'
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-base font-bold text-white truncate">{name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                    token.type === 'DEX BOOST' ? 'bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]' :
                    token.type === 'DEX LISTING' ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]' :
                    token.type === 'VOL SPIKE' ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' :
                    token.type === 'WHALE ALERT' ? 'bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.4)]' :
                    'bg-zinc-800 text-white'
                  }`}>
                    {token.type}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono ml-auto">2s ago</span>
                </div>
                <div className="flex items-center gap-8 text-[11px] text-white font-mono">
                  <span className="text-white font-black">{token.mc} MC</span>
                  <span className="text-white font-black">{token.liquidity} Liq</span>
                  <span className="text-white font-black">{token.holders} Boosts</span>
                </div>
              </div>

              <div className="text-right">
                 <span className={`text-sm font-bold block ${token.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                   {token.change}
                 </span>
              </div>
              
              <div className="opacity-0 group-hover:opacity-100 transition-all ml-4">
                <Button 
                  size="lg"
                  onClick={() => handleQuickBuy(token)}
                  disabled={executing === name}
                  className="bg-[#5100fd] border border-[#5100fd]/50 hover:bg-[#6610ff] h-10 px-6 text-xs font-bold rounded-xl text-white"
                >
                  {executing === name ? <Loader2 className="w-3 h-3 animate-spin" /> : "QUICK BUY"}
                </Button>
              </div>
            </div>
          )})}
          <div className="flex flex-wrap gap-2 px-6 pb-6">
            <FilterChip label="All" active />
            <FilterChip label="Boost" />
            <FilterChip label="Volume Spike" />
            <FilterChip label="Whale Alert" />
            <FilterChip label="Dex Listing" />
          </div>
        </div>
      </Card>
    </div>
  )
}
