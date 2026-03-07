"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, ArrowRight, Settings } from "lucide-react"

function MonitorToggle({ label, active, onToggle }: { label: string, active: boolean, onToggle: () => void }) {
  return (
    <button 
      onClick={onToggle}
      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
        active 
          ? 'bg-[#5100fd]/10 border-[#5100fd] text-white' 
          : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700'
      }`}
    >
      <span className="text-[10px] font-bold uppercase">{label}</span>
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-[#5100fd] animate-pulse' : 'bg-zinc-700'}`} />
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
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <Card className="max-w-md w-full bg-zinc-950 border-zinc-900 p-8 rounded-[2rem] shadow-2xl overflow-y-auto max-h-[90vh]">
        {step === 1 && (
          <div className="space-y-6">
            <div className="w-16 h-16 bg-[#5100fd]/20 rounded-2xl flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-[#5100fd]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Welcome to Alertly</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Let's set up your trading terminal. These settings can be changed anytime in your dashboard.
            </p>
            <Button 
              onClick={() => setStep(2)}
              className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-12 rounded-xl font-bold text-white transition-all hover:scale-[1.02]"
            >
              Get Started <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
               <Settings className="w-5 h-5 text-[#5100fd]" /> Trading Preferences
            </h2>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Risk Profile</Label>
                <div className="grid grid-cols-3 gap-2">
                  {["Low", "Medium", "High"].map((level) => (
                    <Button
                      key={level}
                      variant="outline"
                      onClick={() => setSettings({...settings, riskLevel: level.toLowerCase()})}
                      className={`rounded-xl border-zinc-800 h-10 text-xs font-bold transition-all ${
                        settings.riskLevel === level.toLowerCase() 
                          ? 'bg-[#5100fd] border-[#5100fd] text-white shadow-lg shadow-[#5100fd]/20' 
                          : 'bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest text-white">Buy Amount (SOL)</Label>
                  <Input 
                    type="number" 
                    step="0.1" 
                    value={settings.buyAmount} 
                    onChange={(e) => setSettings({...settings, buyAmount: parseFloat(e.target.value)})}
                    className="bg-zinc-900/50 border-zinc-800 rounded-xl h-10 text-sm text-white focus:border-[#5100fd] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest text-white">Slippage (%)</Label>
                  <Input 
                    type="number" 
                    value={settings.maxSlippage} 
                    onChange={(e) => setSettings({...settings, maxSlippage: parseFloat(e.target.value)})}
                    className="bg-zinc-900/50 border-zinc-800 rounded-xl h-10 text-sm text-white focus:border-[#5100fd] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest text-white">Take Profit (%)</Label>
                  <Input 
                    type="number" 
                    value={settings.takeProfit} 
                    onChange={(e) => setSettings({...settings, takeProfit: parseFloat(e.target.value)})}
                    className="bg-zinc-900/50 border-zinc-800 rounded-xl h-10 text-sm text-white focus:border-[#5100fd]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest text-white">Stop Loss (%)</Label>
                  <Input 
                    type="number" 
                    value={settings.stopLoss} 
                    onChange={(e) => setSettings({...settings, stopLoss: parseFloat(e.target.value)})}
                    className="bg-zinc-900/50 border-zinc-800 rounded-xl h-10 text-sm text-white focus:border-[#5100fd]"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest text-white">Active Monitors</Label>
                <div className="grid grid-cols-2 gap-3">
                  <MonitorToggle 
                    label="Vol Spike" 
                    active={settings.volumeSpikeEnabled} 
                    onToggle={() => setSettings({...settings, volumeSpikeEnabled: !settings.volumeSpikeEnabled})} 
                  />
                  <MonitorToggle 
                    label="Whale Alert" 
                    active={settings.whaleAlertEnabled} 
                    onToggle={() => setSettings({...settings, whaleAlertEnabled: !settings.whaleAlertEnabled})} 
                  />
                  <MonitorToggle 
                    label="Dex Boost" 
                    active={settings.dexBoostEnabled} 
                    onToggle={() => setSettings({...settings, dexBoostEnabled: !settings.dexBoostEnabled})} 
                  />
                  <MonitorToggle 
                    label="Dex Listing" 
                    active={settings.dexListingEnabled} 
                    onToggle={() => setSettings({...settings, dexListingEnabled: !settings.dexListingEnabled})} 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest text-white">Auto-Execution</Label>
                <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-white">Enable Auto-Trade</span>
                    <span className="text-[10px] text-zinc-500">Bot will buy automatically based on filters</span>
                  </div>
                  <button 
                    onClick={() => setSettings({...settings, autoTrade: !settings.autoTrade})}
                    className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-all duration-300 shadow-inner ${settings.autoTrade ? 'bg-green-500' : 'bg-zinc-800'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm ${settings.autoTrade ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleComplete}
              className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-12 rounded-xl font-bold text-white shadow-lg shadow-[#5100fd]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Save & Launch
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
