"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, ArrowRight, Settings, Shield, Target, Bell } from "lucide-react"

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
    autoTrade: false,
    buyAmount: 0.5,
    maxBuyPerToken: 2.0,
    maxSlippage: 10,
    takeProfit: 50,
    stopLoss: 25,
    minLiquidity: 0,
    minHolders: 0,
    dexBoostEnabled: true,
    dexListingEnabled: true,
    boostLevels: ["Level 1", "Level 2", "Level 3", "Level 4", "Top Boost"]
  })

  useEffect(() => {
    const saved = localStorage.getItem('alertly_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {}
    }

    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data && !data.message) {
          setSettings(prev => ({
            ...prev,
            autoTrade: data.autoTrade ?? prev.autoTrade,
            buyAmount: data.buyAmount ?? prev.buyAmount,
            maxBuyPerToken: data.maxBuyPerToken ?? prev.maxBuyPerToken,
            maxSlippage: data.slippage ?? prev.maxSlippage,
            takeProfit: data.takeProfit ?? prev.takeProfit,
            stopLoss: data.stopLoss ?? prev.stopLoss,
            minLiquidity: data.minLiquidity ?? prev.minLiquidity,
            minHolders: data.minHolders ?? prev.minHolders,
            dexBoostEnabled: data.dexBoostEnabled ?? prev.dexBoostEnabled,
            dexListingEnabled: data.dexListingEnabled ?? prev.dexListingEnabled,
            boostLevels: data.selectedBoostLevel === "all"
              ? ["Level 1", "Level 2", "Level 3", "Level 4", "Top Boost"]
              : (data.selectedBoostLevel ? [data.selectedBoostLevel] : prev.boostLevels),
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleComplete = async () => {
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.setItem('alertly_config', JSON.stringify(settings));

    const allBoostLevels = ["Level 1", "Level 2", "Level 3", "Level 4", "Top Boost"];
    const allSelected = allBoostLevels.every(l => settings.boostLevels.includes(l));

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
          minHolders: settings.minHolders,
          dexBoostEnabled: settings.dexBoostEnabled,
          dexListingEnabled: settings.dexListingEnabled,
          selectedBoostLevel: allSelected ? "all" : (settings.boostLevels[0] || "all"),
        })
      });
      router.push("/dashboard")
    } catch (err) {
      console.error("Failed to save onboarding settings", err);
      router.push("/dashboard")
    }
  }

  const toggleBoostLevel = (level: string) => {
    setSettings(prev => ({
      ...prev,
      boostLevels: prev.boostLevels.includes(level)
        ? prev.boostLevels.filter(l => l !== level)
        : [...prev.boostLevels, level]
    }))
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white flex items-start justify-center pt-24 pb-8 px-4 md:px-8 font-sans selection:bg-[#5100fd]/40">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(81,0,253,0.05),transparent_50%)] pointer-events-none" />
      
      <Card className="max-w-3xl w-full bg-[#080808] border-zinc-900/50 p-8 md:p-12 rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-y-auto relative z-10 backdrop-blur-3xl border">
        {step === 1 && (
          <div className="space-y-10 py-4 text-center">
            <div className="flex items-center justify-center mb-8">
              <div className="p-1 bg-[#5100fd] rounded-full shadow-[0_0_30px_rgba(81,0,253,0.4)] border-2 border-[#5100fd]">
                <Image src="/images/logo.png" alt="Logo" width={80} height={80} className="rounded-full" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                Alertly
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
              <div className="px-3 py-1 bg-zinc-900 rounded-full border border-zinc-800 flex gap-2">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Page 1 / 2</span>
              </div>
            </div>
            
            <div className="space-y-8">
              {/* Alert Monitors */}
              <div className="space-y-5">
                <Label className="text-zinc-500 uppercase text-[11px] font-black tracking-[0.2em] flex items-center gap-2">
                  <Target className="w-3.5 h-3.5" /> Alert Monitors
                </Label>
                <div className="grid grid-cols-2 gap-4">

                  {/* DEX Boosts */}
                  <div className="space-y-4">
                    <MonitorToggle 
                      label="DEX Boosts" 
                      active={settings.dexBoostEnabled} 
                      onToggle={() => setSettings({...settings, dexBoostEnabled: !settings.dexBoostEnabled})} 
                    />
                    {settings.dexBoostEnabled && (
                      <div className="pl-4 space-y-3 animate-in fade-in slide-in-from-left-2 duration-300 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-xl">
                        <Label className="text-[10px] font-black text-white uppercase tracking-widest block mb-2">Boost Levels:</Label>
                        <div className="flex flex-wrap gap-2">
                          {["Level 1", "Level 2", "Level 3", "Level 4", "Top Boost"].map(level => (
                            <button 
                              key={level} 
                              type="button" 
                              onClick={() => toggleBoostLevel(level)}
                              className={`px-4 py-2 rounded-xl border text-[11px] font-black transition-all ${
                                settings.boostLevels.includes(level)
                                ? 'bg-[#5100fd] border-[#5100fd] text-white shadow-[0_0_20px_rgba(81,0,253,0.5)]'
                                : 'bg-zinc-800 border-zinc-700 text-white hover:border-zinc-500'
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-zinc-500">All levels selected by default</p>
                      </div>
                    )}
                  </div>

                  {/* DEX Listings */}
                  <div className="space-y-4">
                    <MonitorToggle 
                      label="DEX Listings" 
                      active={settings.dexListingEnabled} 
                      onToggle={() => setSettings({...settings, dexListingEnabled: !settings.dexListingEnabled})} 
                    />
                    {settings.dexListingEnabled && (
                      <div className="pl-4 space-y-3 animate-in fade-in slide-in-from-left-2 duration-300 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-xl">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black text-white uppercase tracking-wider block">Listing Options:</Label>
                          <p className="text-[9px] text-zinc-400 leading-relaxed">Alert when a token pays for a DexScreener token profile (new paid DEX listing).</p>
                          <div className="flex flex-wrap gap-2 pt-2">
                            <span className="px-3 py-1.5 rounded-lg border border-[#5100fd]/40 bg-[#5100fd]/10 text-[10px] font-black text-[#5100fd]">
                              All Paid Listings
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Filtering Engine */}
              <div className="space-y-5">
                <Label className="text-zinc-500 uppercase text-[11px] font-black tracking-[0.2em] flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> Filtering Engine
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label className="text-white uppercase text-[10px] font-black tracking-widest">Min Liquidity ($)</Label>
                    <Input 
                      type="number" 
                      value={settings.minLiquidity} 
                      onChange={(e) => setSettings({...settings, minLiquidity: parseInt(e.target.value) || 0})}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl h-12 text-base font-black text-white focus:border-[#5100fd] focus:ring-2 focus:ring-[#5100fd]/20 transition-all pl-5 shadow-inner"
                    />
                    <p className="text-[9px] text-zinc-500">Default: 0 (show all)</p>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-white uppercase text-[10px] font-black tracking-widest">Min Holders</Label>
                    <Input 
                      type="number" 
                      value={settings.minHolders} 
                      onChange={(e) => setSettings({...settings, minHolders: Math.max(0, parseInt(e.target.value) || 0)})}
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl h-12 text-base font-black text-white focus:border-[#5100fd] focus:ring-2 focus:ring-[#5100fd]/20 transition-all pl-5 shadow-inner"
                    />
                    <p className="text-[9px] text-zinc-500">Default: 0 (show all)</p>
                  </div>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => setStep(3)}
              className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-16 rounded-2xl font-black text-white text-base shadow-[0_20px_40px_rgba(81,0,253,0.3)] transition-all hover:scale-[1.01] active:scale-[0.98]"
            >
              NEXT: TRADING ENGINE <ArrowRight className="ml-3 w-5 h-5" />
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-white tracking-tighter flex items-center gap-3">
                 <div className="p-2 bg-[#5100fd]/10 rounded-lg"><Zap className="w-6 h-6 text-[#5100fd]" /></div> TRADING ENGINE
              </h2>
              <div className="px-3 py-1 bg-zinc-900 rounded-full border border-zinc-800 flex gap-2">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Page 2 / 2</span>
              </div>
            </div>

            <div className="space-y-8">
              {/* Auto Trade Toggle */}
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
                    <span className="text-[10px] text-zinc-500 font-medium">Synced across Web, Bot & Extension</span>
                  </div>
                  <div className={`w-14 h-7 rounded-full flex items-center px-1 transition-all duration-500 ${settings.autoTrade ? 'bg-green-500' : 'bg-zinc-800'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white transition-all duration-500 shadow-xl ${settings.autoTrade ? 'translate-x-7' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>

              {settings.autoTrade && (
                <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-white uppercase text-[10px] font-black tracking-widest">Buy Amount (SOL)</Label>
                      <div className="relative group">
                        <Input 
                          type="number" 
                          step="0.1" 
                          value={settings.buyAmount} 
                          onChange={(e) => setSettings({...settings, buyAmount: parseFloat(e.target.value)})}
                          className="bg-zinc-900 border border-zinc-800 rounded-2xl h-14 text-lg font-black text-white focus:border-[#5100fd] focus:ring-2 focus:ring-[#5100fd]/20 transition-all pl-5 shadow-2xl"
                        />
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/50 uppercase">SOL</div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {[0.1, 0.5, 1.0, 2.0].map(val => (
                          <button 
                            key={val} 
                            onClick={() => setSettings({...settings, buyAmount: val})}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${settings.buyAmount === val ? 'bg-[#5100fd] border-[#5100fd] text-white shadow-lg' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'}`}
                          >
                            {val} SOL
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-white uppercase text-[10px] font-black tracking-widest">Max Slippage</Label>
                      <div className="relative group">
                        <Input 
                          type="number" 
                          value={settings.maxSlippage} 
                          onChange={(e) => setSettings({...settings, maxSlippage: parseFloat(e.target.value)})}
                          className="bg-zinc-900 border border-zinc-800 rounded-2xl h-14 text-lg font-black text-white focus:border-[#5100fd] focus:ring-2 focus:ring-[#5100fd]/20 transition-all pl-5 shadow-2xl"
                        />
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/50 uppercase">%</div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-white uppercase text-[10px] font-black tracking-widest">Take Profit</Label>
                      <div className="relative">
                        <Input 
                          type="number" 
                          value={settings.takeProfit} 
                          onChange={(e) => setSettings({...settings, takeProfit: parseFloat(e.target.value)})}
                          className="bg-zinc-900 border border-zinc-800 rounded-2xl h-14 text-lg font-black text-green-500 focus:border-[#5100fd] focus:ring-2 focus:ring-[#5100fd]/20 transition-all pl-5 shadow-2xl"
                        />
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/50 uppercase">%</div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-white uppercase text-[10px] font-black tracking-widest">Stop Loss</Label>
                      <div className="relative">
                        <Input 
                          type="number" 
                          value={settings.stopLoss} 
                          onChange={(e) => setSettings({...settings, stopLoss: parseFloat(e.target.value)})}
                          className="bg-zinc-900 border border-zinc-800 rounded-2xl h-14 text-lg font-black text-red-500 focus:border-[#5100fd] focus:ring-2 focus:ring-[#5100fd]/20 transition-all pl-5 shadow-2xl"
                        />
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/50 uppercase">%</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-6 rounded-[2rem] bg-[#5100fd]/5 border border-[#5100fd]/20 flex items-start gap-4">
                <Bell className="w-5 h-5 text-[#5100fd] shrink-0 mt-1" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white uppercase tracking-wider">Sync Notifications</p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">Alerts are delivered in real-time to your Web Dashboard, Telegram Bot, and Browser Extension simultaneously. Nothing is stored — only connected users receive alerts.</p>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button 
                onClick={() => setStep(2)}
                variant="outline"
                className="flex-1 bg-transparent border-zinc-800 hover:bg-zinc-900 h-16 rounded-2xl font-black text-zinc-400 text-base transition-all"
              >
                BACK
              </Button>
              <Button 
                onClick={handleComplete}
                className="flex-[2] bg-[#5100fd] hover:bg-[#6610ff] h-16 rounded-2xl font-black text-white text-base shadow-[0_20px_40px_rgba(81,0,253,0.3)] transition-all hover:scale-[1.01] active:scale-[0.98]"
              >
                SAVE & START
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
