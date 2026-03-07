"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Zap, Shield, Target, ArrowRight } from "lucide-react"

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [settings, setSettings] = useState({
    riskLevel: "medium",
    autoTrade: true,
    maxSlippage: 15
  })

  const handleComplete = () => {
    localStorage.setItem('onboarding_completed', 'true')
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <Card className="max-w-md w-full bg-zinc-950 border-zinc-900 p-8 rounded-[2rem] shadow-2xl">
        {step === 1 && (
          <div className="space-y-6">
            <div className="w-16 h-16 bg-[#5100fd]/20 rounded-2xl flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-[#5100fd]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome to Alertly</h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Let's set up your trading terminal. These settings can be changed anytime in your dashboard.
            </p>
            <Button 
              onClick={() => setStep(2)}
              className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-12 rounded-xl font-bold"
            >
              Get Started <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Trading Preferences</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Risk Profile</Label>
                <div className="grid grid-cols-3 gap-2">
                  {["Low", "Medium", "High"].map((level) => (
                    <Button
                      key={level}
                      variant="outline"
                      onClick={() => setSettings({...settings, riskLevel: level.toLowerCase()})}
                      className={`rounded-xl border-zinc-800 h-10 text-xs font-bold ${
                        settings.riskLevel === level.toLowerCase() ? 'bg-[#5100fd] border-[#5100fd] text-white' : 'bg-transparent text-zinc-400'
                      }`}
                    >
                      {level}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest">Auto-Execution</Label>
                <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                  <span className="text-sm font-medium">Enable Auto-Trade</span>
                  <button 
                    onClick={() => setSettings({...settings, autoTrade: !settings.autoTrade})}
                    className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-all ${settings.autoTrade ? 'bg-green-500' : 'bg-zinc-800'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-all ${settings.autoTrade ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
            <Button 
              onClick={handleComplete}
              className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-12 rounded-xl font-bold"
            >
              Launch Terminal
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
