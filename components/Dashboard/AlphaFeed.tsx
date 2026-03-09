import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, Loader2, Volume2, VolumeX, Zap } from "lucide-react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

function FilterChip({ label, active = false, onClick }: { label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all duration-200 shadow-sm ${
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastAlertCount, setLastAlertCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  
  // Play notification sound when new alerts arrive
  useEffect(() => {
    if (alerts.length > lastAlertCount && soundEnabled && lastAlertCount > 0) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const now = audioContext.currentTime;
        
        // Create a simple beep sound
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        osc.start(now);
        osc.stop(now + 0.1);
      } catch (e) {
        // Fallback to audio file
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        } catch (err) {}
      }
    }
    setLastAlertCount(alerts.length);
  }, [alerts.length, soundEnabled, lastAlertCount]);
  
  const dailyAlerts = alerts.filter(a => {
    const alertTime = a.alertedAt ? new Date(a.alertedAt).getTime() : 0;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return alertTime > oneDayAgo;
  }).length;

  const filteredAlerts = activeFilter === 'All' 
    ? alerts 
    : alerts.filter(a => a.type?.includes(activeFilter));

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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-[11px] font-black text-zinc-400">
              <span>Total: <span className="text-white">{alerts.length}</span></span>
              <span>|</span>
              <span>24h: <span className="text-[#5100fd]">{dailyAlerts}</span></span>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg hover:bg-zinc-900 transition text-zinc-400 hover:text-white"
              title={soundEnabled ? "Disable sound" : "Enable sound"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        <div className="max-h-[700px] overflow-y-auto divide-y divide-zinc-900/50 scrollbar-hide">
          {alerts.length === 0 ? (
            <div className="p-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#5100fd] mx-auto mb-4" />
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Scanning Solana Mainnet...</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="p-12 text-center">
              <Zap className="h-6 w-6 text-zinc-600 mx-auto mb-4" />
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">No alerts for this filter</p>
            </div>
          ) : filteredAlerts.map((token: any, i: number) => {
            const name = token.name || token.token || 'Unknown Token'
            return (
            <div key={`${token.address}-${i}`} className="group p-6 hover:bg-[#5100fd]/[0.03] transition-all flex items-center gap-4 md:gap-6 border-l-4 border-transparent hover:border-[#5100fd] cursor-pointer">
              <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-white shadow-lg overflow-hidden group-hover:border-[#5100fd]/50 transition-colors flex-shrink-0">
                {token.imageUrl ? (
                  <img src={token.imageUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-black text-[#5100fd]">{name?.[0]?.toUpperCase() || 'T'}</span>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div>
                      <span className="text-sm md:text-lg font-black text-white truncate tracking-tight">{name}</span>
                      {token.symbol && <span className="text-[9px] md:text-[10px] text-zinc-400 ml-1">({token.symbol})</span>}
                    </div>
                  </div>
                  <span className={`text-[9px] md:text-[10px] px-2.5 md:px-3 py-1 rounded-md font-black uppercase tracking-tighter shadow-lg whitespace-nowrap ${
                    token.type === 'DEX BOOST' ? 'bg-[#5100fd] text-white' :
                    token.type === 'DEX LISTING' ? 'bg-blue-600 text-white' :
                    token.type === 'VOL SPIKE' ? 'bg-purple-600 text-white' :
                    token.type === 'WHALE ALERT' ? 'bg-orange-600 text-white' :
                    token.type === 'LIQUIDITY ADDED' ? 'bg-cyan-600 text-white' :
                    'bg-zinc-800 text-white'
                  }`}>
                    {token.type}
                    {token.dexLevel && <span className="ml-1 text-[8px] font-bold">Lv{token.dexLevel}</span>}
                  </span>
                  <span className="text-[8px] md:text-[10px] text-zinc-400 font-black whitespace-nowrap tracking-widest">{token.alertedAt ? new Date(token.alertedAt).toLocaleTimeString() : "Live"}</span>
                </div>
                <div className="flex items-center gap-3 md:gap-4 text-[8px] md:text-[10px] flex-wrap">
                  <div className="flex flex-col">
                    <span className="text-[6px] md:text-[7px] text-zinc-500 uppercase font-black tracking-widest">MC</span>
                    <span className="text-white font-black">{token.mc && token.mc !== "-" && token.mc !== "Loading" ? token.mc : "N/A"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[6px] md:text-[7px] text-zinc-500 uppercase font-black tracking-widest">Liquidity</span>
                    <span className="text-white font-black">{token.liquidity && token.liquidity !== "-" && token.liquidity !== "Loading" ? token.liquidity : "N/A"}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[6px] md:text-[7px] text-zinc-500 uppercase font-black tracking-widest">Holders</span>
                    <span className="text-[#5100fd] font-black">{typeof token.holders === 'number' && token.holders > 0 ? token.holders.toLocaleString() : "N/A"}</span>
                  </div>
                  {token.vol && token.vol !== "-" && <div className="flex flex-col">
                    <span className="text-[6px] md:text-[7px] text-zinc-500 uppercase font-black tracking-widest">Vol 24h</span>
                    <span className="text-green-400 font-black">{token.vol}</span>
                  </div>}
                </div>
              </div>

              <div className="text-right hidden md:flex flex-col items-end flex-shrink-0">
                 <span className={`text-lg font-black block leading-none ${token.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                   {token.change || "0%"}
                 </span>
                 <span className="text-[9px] text-zinc-500 uppercase font-black tracking-tighter">24H</span>
              </div>
              
              <div className="flex gap-2 flex-shrink-0">
                <Button 
                  size="lg"
                  onClick={(e) => { e.stopPropagation(); handleQuickBuy(token); }}
                  disabled={executing === name}
                  className="bg-[#5100fd] hover:bg-[#4100cc] h-9 md:h-11 px-3 md:px-6 text-[9px] md:text-[10px] font-black rounded-lg text-white shadow-[0_0_20px_rgba(81,0,253,0.4)]"
                >
                  {executing === name ? <Loader2 className="w-3 h-3 animate-spin" /> : "BUY"}
                </Button>
                <Button
                  size="lg"
                  onClick={(e) => { e.stopPropagation(); token.address && router.push(`/token/${token.address}`); }}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 h-9 md:h-11 px-3 md:px-6 text-[9px] md:text-[10px] font-black rounded-lg text-white"
                >
                  VIEW
                </Button>
              </div>
            </div>
          )})}
          <div className="flex flex-wrap gap-2 px-6 pb-6 border-t border-zinc-900/50 pt-4">
            <FilterChip 
              label="All" 
              active={activeFilter === 'All'}
              onClick={() => setActiveFilter('All')}
            />
            <FilterChip 
              label="Boost" 
              active={activeFilter === 'DEX BOOST'}
              onClick={() => setActiveFilter('DEX BOOST')}
            />
            <FilterChip 
              label="Volume Spike" 
              active={activeFilter === 'VOL SPIKE'}
              onClick={() => setActiveFilter('VOL SPIKE')}
            />
            <FilterChip 
              label="Whale Alert" 
              active={activeFilter === 'WHALE ALERT'}
              onClick={() => setActiveFilter('WHALE ALERT')}
            />
            <FilterChip 
              label="Dex Listing" 
              active={activeFilter === 'DEX LISTING'}
              onClick={() => setActiveFilter('DEX LISTING')}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}
