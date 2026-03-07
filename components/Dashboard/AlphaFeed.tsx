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
            <h2 className="text-sm font-black tracking-tight text-white uppercase italic">Live Alpha Feed</h2>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/onboarding')}
            className="text-[10px] font-black text-white hover:text-white hover:bg-[#5100fd] uppercase tracking-widest bg-zinc-900 border border-zinc-800 rounded-lg px-4 h-8 transition-all"
          >
            <Settings className="w-3 h-3 mr-1.5" /> Configure Bot
          </Button>
        </div>
        
        <div className="max-h-[700px] overflow-y-auto divide-y divide-zinc-900/50 scrollbar-hide">
          {alerts.length === 0 ? (
            <div className="p-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#5100fd] mx-auto mb-4" />
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Scanning Solana Mainnet...</p>
            </div>
          ) : alerts.map((token: any, i: number) => {
            const name = token.name || token.token
            return (
            <div key={i} className="group p-6 hover:bg-[#5100fd]/[0.03] transition-all flex items-center gap-8 border-l-4 border-transparent hover:border-[#5100fd]">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-white shadow-2xl overflow-hidden group-hover:border-[#5100fd]/50 transition-colors">
                {token.imageUrl ? (
                  <img src={token.imageUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-black text-[#5100fd]">{name?.[0] || 'T'}</span>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg font-black text-white truncate tracking-tight">{name}</span>
                  <span className={`text-[10px] px-3 py-1 rounded-md font-black uppercase tracking-tighter shadow-lg ${
                    token.type === 'DEX BOOST' ? 'bg-[#5100fd] text-white' :
                    token.type === 'DEX LISTING' ? 'bg-blue-600 text-white' :
                    token.type === 'VOL SPIKE' ? 'bg-purple-600 text-white' :
                    token.type === 'WHALE ALERT' ? 'bg-orange-600 text-white' :
                    'bg-zinc-800 text-white'
                  }`}>
                    {token.type}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-black ml-auto uppercase tracking-widest">Just Now</span>
                </div>
                <div className="flex items-center gap-6 text-[12px]">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Market Cap</span>
                    <span className="text-white font-black">{token.mc}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Liquidity</span>
                    <span className="text-white font-black">{token.liquidity}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Active Boosts</span>
                    <span className="text-[#5100fd] font-black">{token.holders}x</span>
                  </div>
                </div>
              </div>

              <div className="text-right hidden md:block">
                 <span className={`text-lg font-black block leading-none ${token.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                   {token.change}
                 </span>
                 <span className="text-[9px] text-zinc-500 uppercase font-black tracking-tighter">24H Change</span>
              </div>
              
              <div className="opacity-0 group-hover:opacity-100 transition-all ml-4 translate-x-4 group-hover:translate-x-0">
                <Button 
                  size="lg"
                  onClick={() => handleQuickBuy(token)}
                  disabled={executing === name}
                  className="bg-[#5100fd] hover:bg-[#4100cc] h-12 px-8 text-[11px] font-black rounded-xl text-white shadow-[0_0_20px_rgba(81,0,253,0.4)]"
                >
                  {executing === name ? <Loader2 className="w-4 h-4 animate-spin" /> : "INSTANT BUY"}
                </Button>
              </div>
            </div>
          )})}
          <div className="flex flex-wrap gap-2 px-6 py-6 bg-zinc-950/50">
            <FilterChip label="All Activity" active />
            <FilterChip label="Dex Boosts" />
            <FilterChip label="Volume" />
            <FilterChip label="Whales" />
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
