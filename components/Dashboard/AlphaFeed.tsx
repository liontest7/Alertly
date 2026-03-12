import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Volume2, VolumeX, Zap, ExternalLink } from "lucide-react"
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

const TYPE_COLORS: Record<string, string> = {
  "DEX BOOST": "bg-[#5100fd] text-white",
  "DEX LISTING": "bg-blue-600 text-white",
  "VOLUME SPIKE": "bg-purple-600 text-white",
  "WHALE BUY": "bg-orange-500 text-white",
}

const FILTER_CHIPS = [
  { key: "All", label: "All" },
  { key: "DEX BOOST", label: "DEX Boost" },
  { key: "DEX LISTING", label: "DEX Listing" },
  { key: "VOLUME SPIKE", label: "Vol Spike" },
  { key: "WHALE BUY", label: "Whale" },
]

function shortAddr(addr?: string) {
  if (!addr) return ""
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

export function AlphaFeed({ alerts, loading, settings, user }: { alerts: any[], loading: boolean, settings: any, user: any }) {
  const router = useRouter();
  const [executing, setExecuting] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastAlertCount, setLastAlertCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  
  useEffect(() => {
    if (alerts.length > lastAlertCount && soundEnabled && lastAlertCount > 0) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const now = audioContext.currentTime;
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
      } catch {
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        } catch {}
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
    : alerts.filter(a => {
        const type = (a.type || "").toUpperCase();
        const filter = activeFilter.toUpperCase();
        return type === filter;
      });

  const handleQuickBuy = async (token: any) => {
    if (!user) {
      alert("Please connect your wallet to execute trades.");
      return;
    }
    if (!token.address) {
      alert("This alert does not include a valid token address.")
      return
    }
    const tokenName = token.symbol || token.name || shortAddr(token.address)
    setExecuting(token.address)
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
    } catch {
      alert("Trade execution failed.")
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
              <span>Total: <span className="text-white">{loading && alerts.length === 0 ? '...' : alerts.length}</span></span>
              <span>|</span>
              <span>24h: <span className="text-[#5100fd]">{loading && alerts.length === 0 ? '...' : dailyAlerts}</span></span>
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
          {loading && alerts.length === 0 ? (
            <div className="p-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#5100fd] mx-auto mb-4" />
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Scanning Solana Mainnet...</p>
            </div>
          ) : !loading && alerts.length === 0 ? (
            <div className="p-12 text-center">
              <Zap className="h-6 w-6 text-zinc-600 mx-auto mb-4" />
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">No alerts yet — listener is active</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="p-12 text-center">
              <Zap className="h-6 w-6 text-zinc-600 mx-auto mb-4" />
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">No alerts for this filter</p>
            </div>
          ) : filteredAlerts.map((token: any, i: number) => {
            const isLoading = token.name === "Loading...";
            const symbol = token.symbol;
            const name = !isLoading && token.name && token.name !== "Unknown Token" ? token.name : null;
            const displayPrimary = symbol || name || shortAddr(token.address);
            const displaySecondary = symbol && name && name !== symbol ? name : null;
            const typeColor = TYPE_COLORS[(token.type || "").toUpperCase()] || "bg-zinc-800 text-white";
            const isWhale = (token.type || "").toUpperCase() === "WHALE BUY";

            return (
              <div key={`${token.address}-${i}`} className="group p-5 hover:bg-[#5100fd]/[0.03] transition-all flex items-center gap-4 border-l-4 border-transparent hover:border-[#5100fd] cursor-pointer">
                {/* Token Logo */}
                <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-white shadow-lg overflow-hidden group-hover:border-[#5100fd]/50 transition-colors flex-shrink-0 relative">
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-black text-[#5100fd]">
                    {isLoading ? "·" : (displayPrimary)?.[0]?.toUpperCase() || "?"}
                  </span>
                  {token.imageUrl && (
                    <img 
                      src={token.imageUrl} 
                      alt={displayPrimary} 
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).remove(); }} 
                    />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      {isLoading ? (
                        <span className="inline-block h-4 w-24 rounded bg-zinc-800 animate-pulse" />
                      ) : (
                        <>
                          <span className="text-base font-black text-white truncate tracking-tight">
                            {displayPrimary}
                          </span>
                          {displaySecondary && (
                            <span className="text-[9px] text-zinc-500 truncate">{displaySecondary}</span>
                          )}
                        </>
                      )}
                    </div>
                    <span className={`text-[9px] px-2.5 py-0.5 rounded-md font-black uppercase tracking-tighter shadow-sm whitespace-nowrap ${typeColor}`}>
                      {token.type}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-black whitespace-nowrap tracking-widest ml-auto">
                      {token.alertedAt ? new Date(token.alertedAt).toLocaleTimeString() : "Live"}
                    </span>
                  </div>

                  {/* Token Metrics */}
                  <div className="flex items-center gap-3 text-[9px] flex-wrap mb-1">
                    <div className="flex flex-col">
                      <span className="text-[7px] text-zinc-500 uppercase font-black tracking-widest">MC</span>
                      <span className="text-white font-black">{token.mc && token.mc !== "N/A" ? token.mc : "—"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] text-zinc-500 uppercase font-black tracking-widest">Liquidity</span>
                      <span className="text-white font-black">{token.liquidity && token.liquidity !== "N/A" ? token.liquidity : "—"}</span>
                    </div>
                    {token.vol && token.vol !== "N/A" && (
                      <div className="flex flex-col">
                        <span className="text-[7px] text-zinc-500 uppercase font-black tracking-widest">Vol 24h</span>
                        <span className="text-green-400 font-black">{token.vol}</span>
                      </div>
                    )}
                    {token.priceUsd && (
                      <div className="flex flex-col">
                        <span className="text-[7px] text-zinc-500 uppercase font-black tracking-widest">Price</span>
                        <span className="text-zinc-300 font-black">{token.priceUsd}</span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-[7px] text-zinc-500 uppercase font-black tracking-widest">CA</span>
                      <span className="text-zinc-500 font-mono">{shortAddr(token.address)}</span>
                    </div>
                  </div>

                  {/* Whale-specific info */}
                  {isWhale && (token.walletBalance || token.wallet) && (
                    <div className="flex items-center gap-3 text-[9px] mt-1 bg-orange-500/10 rounded-lg px-2 py-1 border border-orange-500/20">
                      {token.wallet && (
                        <span className="text-orange-400 font-mono">
                          🐳 {shortAddr(token.wallet)}
                        </span>
                      )}
                      {token.walletBalance && (
                        <span className="text-orange-300 font-black">
                          {Number(token.walletBalance).toFixed(0)} SOL
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-right hidden md:flex flex-col items-end flex-shrink-0 gap-1">
                  <span className={`text-base font-black block leading-none ${
                    token.change?.startsWith("+") ? 'text-green-500' : 
                    token.change?.startsWith("-") ? 'text-red-500' : 'text-zinc-500'
                  }`}>
                    {token.change || "—"}
                  </span>
                  <span className="text-[8px] text-zinc-600 uppercase font-black tracking-tighter">24H</span>
                  {token.dexUrl && (
                    <a 
                      href={token.dexUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[8px] text-zinc-600 hover:text-[#5100fd] transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              
                <div className="flex gap-2 flex-shrink-0">
                  <Button 
                    size="lg"
                    onClick={(e) => { e.stopPropagation(); handleQuickBuy(token); }}
                    disabled={executing === token.address}
                    className="bg-[#5100fd] hover:bg-[#4100cc] h-9 px-4 text-[9px] font-black rounded-lg text-white shadow-[0_0_20px_rgba(81,0,253,0.4)]"
                  >
                    {executing === token.address ? <Loader2 className="w-3 h-3 animate-spin" /> : "BUY"}
                  </Button>
                  <Button
                    size="lg"
                    onClick={(e) => { e.stopPropagation(); token.address && router.push(`/token/${token.address}`); }}
                    className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 h-9 px-4 text-[9px] font-black rounded-lg text-white"
                  >
                    VIEW
                  </Button>
                </div>
              </div>
            )
          })}
          
          {/* Filter chips */}
          <div className="flex flex-wrap gap-2 px-6 pb-5 border-t border-zinc-900/50 pt-4">
            {FILTER_CHIPS.map(f => (
              <FilterChip 
                key={f.key}
                label={f.label}
                active={activeFilter === f.key}
                onClick={() => setActiveFilter(f.key)}
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
