"use client"

import { Navbar } from "@/components/navbar"
import { StatCard } from "@/components/Dashboard/StatCard"
import { QuickSettingsCard } from "@/components/Dashboard/QuickSettingsCard"
import { WalletMiniCard } from "@/components/Dashboard/WalletMiniCard"
import { ConnectionsCard } from "@/components/Dashboard/ConnectionsCard"
import { CopyTradingMiniCard } from "@/components/Dashboard/CopyTradingMiniCard"
import { 
  Loader2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuthSession } from "@/components/providers"
import { AlphaFeed } from "@/components/Dashboard/AlphaFeed"

export default function DashboardPage() {
  const { user, loading: sessionLoading } = useAuthSession();
  const router = useRouter();

  useEffect(() => {
    if (!sessionLoading && !user && localStorage.getItem('onboarding_completed') !== 'true') {
      router.push("/onboarding");
    }
  }, [user, sessionLoading, router]);

  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>({
    autoTrade: false,
    buyAmount: 0.5,
    slippage: 10,
    stopLoss: 25,
    takeProfit: 50
  })

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error("Failed to fetch settings");
    }
  };

  const handleToggleAutoTrade = async () => {
    if (!user) {
      alert("Please connect your wallet to change settings.");
      return;
    }
    try {
      const newStatus = !settings.autoTrade;
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoTrade: newStatus })
      });
      if (res.ok) {
        setSettings({ ...settings, autoTrade: newStatus });
      }
    } catch (err) {
      console.error("Failed to update auto-trade");
    }
  }

  useEffect(() => {
    fetchSettings();
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/alerts')
        if (!res.ok) throw new Error('API unstable');
        const data = await res.json()
        setAlerts(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error("Alerts fetch error:", err);
      } finally {
        setLoading(false)
      }
    }
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 5000)
    return () => clearInterval(interval)
  }, [user])

  if (sessionLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-[#5100fd]" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-[#5100fd]/30">
      <Navbar />
      
      <div className="container mx-auto px-6 pt-32 pb-12">
        <div className="flex flex-col gap-8">
          <div className="flex-1 space-y-8">
            <h1 className="text-4xl font-black text-white tracking-tighter flex items-center gap-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 bg-[#5100fd]/20 blur-xl rounded-full animate-pulse" />
                <img src="/images/logo.png" alt="Logo" className="w-full h-full object-contain relative z-10" />
              </div>
              ALERTLY <span className="text-[#5100fd]">ALPHA</span>
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="Total Balance" value="Live" subValue="Connected trading wallet" />
              <StatCard label="24h Profit" value="Live" subValue="Calculated from executed trades" />
              <StatCard label="Active Alerts" value={alerts.length.toString()} subValue="Monitoring real-time DEX" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-zinc-950/50 backdrop-blur-xl border border-zinc-900 rounded-[2rem] p-1.5 flex items-center gap-1.5 w-fit mb-4 shadow-2xl overflow-x-auto no-scrollbar max-w-full">
                  <Button variant="ghost" size="sm" className="rounded-full px-5 h-9 text-[11px] font-black uppercase tracking-widest bg-[#5100fd] text-white hover:bg-[#5100fd] shadow-[0_0_20px_rgba(81,0,253,0.4)] transition-all shrink-0">All</Button>
                  <Button variant="ghost" size="sm" className="rounded-full px-5 h-9 text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all shrink-0">Boost</Button>
                  <Button variant="ghost" size="sm" className="rounded-full px-5 h-9 text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all shrink-0">Volume Spike</Button>
                  <Button variant="ghost" size="sm" className="rounded-full px-5 h-9 text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all shrink-0">Whale Alert</Button>
                  <Button variant="ghost" size="sm" className="rounded-full px-5 h-9 text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-zinc-900 transition-all shrink-0 text-nowrap">Dex Listing</Button>
                </div>
                <AlphaFeed 
                  alerts={alerts} 
                  loading={loading} 
                  settings={settings}
                  user={user}
                />
              </div>

              <div className="lg:col-span-4 space-y-6">
                <QuickSettingsCard 
                  settings={settings} 
                  onToggle={handleToggleAutoTrade} 
                />
                
                <WalletMiniCard user={user} />
                
                <CopyTradingMiniCard />

                <ConnectionsCard />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
