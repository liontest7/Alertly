"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, ArrowRight, Settings, Shield, Target } from "lucide-react"

function MonitorToggle({ label, active, onToggle }: { label: string, active: boolean, onToggle: () => void }) {
  return (
    <button 
      onClick={onToggle}
      type="button"
      className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
        active 
          ? 'bg-[#5100fd]/10 border-[#5100fd] text-white shadow-[0_0_20px_rgba(81,0,253,0.1)]' 
          : 'bg-zinc-900/40 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:bg-zinc-900/60'
      }`}
    >
      <div className="flex flex-col items-start gap-1">
        <span className="text-[11px] font-black uppercase tracking-[0.15em]">{label}</span>
      </div>
      <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${active ? 'bg-[#5100fd] shadow-[0_0_10px_#5100fd] animate-pulse' : 'bg-zinc-800'}`} />
    </button>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [settings, setSettings] = useState({
    riskLevel: "medium",
    autoTrade: false,
    buyAmount: 0.5,
    maxBuyPerToken: 2.0,
    maxSlippage: 10,
    takeProfit: 50,
    stopLoss: 25,
    minLiquidity: 50000,
    volumeSpikeEnabled: true,
    whaleAlertEnabled: true,
    dexBoostEnabled: true,
    dexListingEnabled: true,
  })

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && !data.message) {
          setSettings(prev => ({
            ...prev,
            ...data,
            maxSlippage: data.slippage ?? prev.maxSlippage
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleComplete = async () => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoTrade: settings.autoTrade,
          buyAmount: settings.buyAmount,
          maxBuyPerToken: settings.maxBuyPerToken,
          slippage: settings.maxSlippage,
          takeProfit: settings.takeProfit,
          stopLoss: settings.stopLoss,
          minLiquidity: settings.minLiquidity,
          volumeSpikeEnabled: settings.volumeSpikeEnabled,
          whaleAlertEnabled: settings.whaleAlertEnabled,
          dexBoostEnabled: settings.dexBoostEnabled,
          dexListingEnabled: settings.dexListingEnabled,
        })
      });
      localStorage.setItem('onboarding_completed', 'true')
      router.push("/dashboard")
    } catch (err) {
      console.error("Failed to save onboarding settings", err);
      localStorage.setItem('onboarding_completed', 'true')
      router.push("/dashboard")
    }
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white flex items-center justify-center p-4 md:p-8 font-sans selection:bg-[#5100fd]/40">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(81,0,253,0.05),transparent_50%)] pointer-events-none" />
      
      <Card className="max-w-xl w-full bg-[#080808] border-zinc-900/50 p-8 md:p-12 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-y-auto max-h-[95vh] relative z-10 backdrop-blur-3xl border">
        {step === 1 && (
          <div className="space-y-10 py-4 text-center">
            <div className="relative inline-block">
               <div className="absolute inset-0 bg-[#5100fd]/30 blur-[30px] rounded-full animate-pulse" />
               <div className="relative w-24 h-24 bg-gradient-to-br from-[#5100fd] to-[#7c3aed] rounded-3xl flex items-center justify-center shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
                <Zap className="w-12 h-12 text-white fill-white/20" />
               </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white flex items-center justify-center gap-3">
                <Image src="/images/logo.png" alt="Logo" width={48} height={48} className="rounded-full" />
                <span>ALERTLY <span className="text-[#5100fd]">ALPHA</span></span>
              </h1>
              <p className="text-zinc-500 text-base md:text-lg leading-relaxed max-w-sm mx-auto font-medium">
                Professional-grade Solana trading intelligence. Set your parameters and dominate the DEX.
              </p>
            </div>

            <Button 
              onClick={() => setStep(2)}
              className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-16 rounded-2xl font-extrabold text-white text-lg shadow-[0_10px_30px_rgba(81,0,253,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_15px_40px_rgba(81,0,253,0.4)] active:scale-95"
            >
              INITIALIZE TERMINAL <ArrowRight className="ml-3 w-6 h-6" />
            </Button>
            
            <div className="flex items-center justify-center gap-6 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">
              <span>Real-time Sync</span>
              <div className="w-1 h-1 bg-zinc-800 rounded-full" />
              <span>Non-Custodial</span>
              <div className="w-1 h-1 bg-zinc-800 rounded-full" />
              <span>Anti-MEV</span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-10">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
                 <div className="p-2 bg-[#5100fd]/10 rounded-lg"><Settings className="w-6 h-6 text-[#5100fd]" /></div> CONFIGURATION
              </h2>
              <div className="px-3 py-1 bg-zinc-900 rounded-full border border-zinc-800">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Step 2 / 2</span>
              </div>
            </div>
            
            <div className="space-y-8">
              {/* Intelligence Monitors */}
              <div className="space-y-5">
                <Label className="text-zinc-500 uppercase text-[11px] font-black tracking-[0.2em] flex items-center gap-2">
                  <Target className="w-3.5 h-3.5" /> Intelligence Monitors
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <MonitorToggle 
                      label="Volume Spikes" 
                      active={settings.volumeSpikeEnabled} 
                      onToggle={() => setSettings({...settings, volumeSpikeEnabled: !settings.volumeSpikeEnabled})} 
                    />
                    {settings.volumeSpikeEnabled && (
                      <div className="pl-4 space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                        <Label className="text-[9px] font-bold text-zinc-500 uppercase">Alert on Pairs:</Label>
                        <div className="flex flex-wrap gap-2">
                          {["SOL", "USDC", "USDT"].map(pair => (
                            <button key={pair} type="button" className="px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[9px] font-bold text-zinc-400 hover:border-[#5100fd] transition-colors">
                              {pair}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <MonitorToggle 
                      label="Whale Movement" 
                      active={settings.whaleAlertEnabled} 
                      onToggle={() => setSettings({...settings, whaleAlertEnabled: !settings.whaleAlertEnabled})} 
                    />
                    {settings.whaleAlertEnabled && (
                      <div className="pl-4 space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                        <Label className="text-[9px] font-bold text-zinc-500 uppercase">Min Buy Amount:</Label>
                        <Input className="h-8 bg-zinc-900 border-zinc-800 text-xs text-white" placeholder="5000" type="number" />
                      </div>
                    )}
                  </div>
                  <MonitorToggle 
                    label="DEX Boosts" 
                    active={settings.dexBoostEnabled} 
                    onToggle={() => setSettings({...settings, dexBoostEnabled: !settings.dexBoostEnabled})} 
                  />
                  <MonitorToggle 
                    label="New Listings" 
                    active={settings.dexListingEnabled} 
                    onToggle={() => setSettings({...settings, dexListingEnabled: !settings.dexListingEnabled})} 
                  />
                </div>
              </div>

              {/* Risk Intelligence */}
              <div className="space-y-4">
                <Label className="text-zinc-500 uppercase text-[11px] font-black tracking-[0.2em] flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> Risk Intelligence
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {["Low", "Medium", "High"].map((level) => (
                    <Button
                      key={level}
                      variant="outline"
                      type="button"
                      onClick={() => setSettings({...settings, riskLevel: level.toLowerCase()})}
                      className={`rounded-2xl border-zinc-800 h-14 text-xs font-black transition-all duration-300 uppercase tracking-widest ${
                        settings.riskLevel === level.toLowerCase() 
                          ? 'bg-[#5100fd] border-[#5100fd] text-white shadow-[0_10px_20px_rgba(81,0,253,0.2)]' 
                          : 'bg-zinc-900/30 text-zinc-500 hover:text-white hover:bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Auto Trade */}
              <div className="space-y-4">
                <button 
                  type="button"
                  onClick={() => setSettings({...settings, autoTrade: !settings.autoTrade})}
                  className={`w-full flex items-center justify-between p-6 rounded-3xl border transition-all duration-500 group ${
                    settings.autoTrade 
                      ? 'bg-green-500/10 border-green-500/40 shadow-[0_0_40px_rgba(34,197,94,0.1)]' 
                      : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className={`text-sm font-black uppercase tracking-widest ${settings.autoTrade ? 'text-green-500' : 'text-white'}`}>Auto-Trade Execution</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Automatic buys based on your alpha filters</span>
                  </div>
                  <div className={`w-14 h-7 rounded-full flex items-center px-1 transition-all duration-500 ${settings.autoTrade ? 'bg-green-500' : 'bg-zinc-800'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white transition-all duration-500 shadow-xl ${settings.autoTrade ? 'translate-x-7' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>

              {settings.autoTrade && (
                <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="space-y-3">
                    <Label className="text-zinc-400 uppercase text-[10px] font-black tracking-widest">Buy Amount (SOL)</Label>
                    <div className="relative group">
                      <Input 
                        type="number" 
                        step="0.1" 
                        value={settings.buyAmount} 
                        onChange={(e) => setSettings({...settings, buyAmount: parseFloat(e.target.value)})}
                        className="bg-zinc-900/40 border-zinc-800 rounded-2xl h-14 text-base font-bold text-white focus:border-[#5100fd] focus:ring-0 transition-all pl-5"
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-600 uppercase">SOL</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-zinc-400 uppercase text-[10px] font-black tracking-widest">Max Slippage</Label>
                    <div className="relative group">
                      <Input 
                        type="number" 
                        value={settings.maxSlippage} 
                        onChange={(e) => setSettings({...settings, maxSlippage: parseFloat(e.target.value)})}
                        className="bg-zinc-900/40 border-zinc-800 rounded-2xl h-14 text-base font-bold text-white focus:border-[#5100fd] focus:ring-0 transition-all pl-5"
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-600 uppercase">%</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-zinc-400 uppercase text-[10px] font-black tracking-widest">Take Profit</Label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        value={settings.takeProfit} 
                        onChange={(e) => setSettings({...settings, takeProfit: parseFloat(e.target.value)})}
                        className="bg-zinc-900/40 border-zinc-800 rounded-2xl h-14 text-base font-bold text-green-500 focus:border-[#5100fd] focus:ring-0 transition-all pl-5"
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-600 uppercase">%</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-zinc-400 uppercase text-[10px] font-black tracking-widest">Stop Loss</Label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        value={settings.stopLoss} 
                        onChange={(e) => setSettings({...settings, stopLoss: parseFloat(e.target.value)})}
                        className="bg-zinc-900/40 border-zinc-800 rounded-2xl h-14 text-base font-bold text-red-500 focus:border-[#5100fd] focus:ring-0 transition-all pl-5"
                      />
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-zinc-600 uppercase">%</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button 
              onClick={handleComplete}
              className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-16 rounded-2xl font-black text-white text-base shadow-[0_20px_40px_rgba(81,0,253,0.3)] transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              SAVE CONFIGURATION & START TRADING
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
