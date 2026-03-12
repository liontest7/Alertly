"use client"

import { StatCard } from "@/components/Dashboard/StatCard"
import { SniperConfigWallet } from "@/components/Dashboard/SniperConfigWallet"
import { ConnectionsCard } from "@/components/Dashboard/ConnectionsCard"
import { CopyTradingMiniCard } from "@/components/Dashboard/CopyTradingMiniCard"
import {
  Loader2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
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
  const [metrics, setMetrics] = useState({
    totalBalanceSol: 0,
    profit24hSol: 0,
    tradeCount24h: 0,
    available: false,
  });

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
    } catch {
      console.error("Failed to fetch settings");
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/dashboard/metrics');
      if (!res.ok) return;
      const data = await res.json();
      setMetrics({
        totalBalanceSol: Number(data.totalBalanceSol || 0),
        profit24hSol: Number(data.profit24hSol || 0),
        tradeCount24h: Number(data.tradeCount24h || 0),
        available: Boolean(data.available),
      });
    } catch {
      console.error("Failed to fetch dashboard metrics");
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
    } catch {
      console.error("Failed to update auto-trade");
    }
  }

  useEffect(() => {
    fetchSettings();
    fetchMetrics();

    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/alerts?t=' + Date.now())
        if (!res.ok) throw new Error('API unstable');
        const data = await res.json()
        setAlerts(Array.isArray(data) ? data : [])
      } catch {
        setAlerts([])
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()

    let stream: EventSource | null = null;
    try {
      stream = new EventSource('/api/alerts/stream');
      stream.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          // Only update alerts if it's an array (alerts event data)
          // Heartbeats will be objects and fail Array.isArray
          if (Array.isArray(payload)) {
            setAlerts(payload);
            setLoading(false);
          }
        } catch {
          // ignore invalid stream payload
        }
      };
      
      // SSE events with named types (like 'alerts') come through onmessage 
      // if not explicitly added via addEventListener, or we can use both.
      // The current route.ts uses `sseEvent("alerts", ...)` which sends `event: alerts`
      stream.addEventListener('alerts', (event: any) => {
        try {
          const payload = JSON.parse(event.data);
          if (Array.isArray(payload)) {
            setAlerts(payload);
            setLoading(false);
          }
        } catch {}
      });
    } catch {
      // fallback remains polling below
    }

    const alertsInterval = setInterval(fetchAlerts, 10000)
    const metricsInterval = setInterval(fetchMetrics, 15000)

    return () => {
      if (stream) stream.close();
      clearInterval(alertsInterval)
      clearInterval(metricsInterval)
    }
  }, [user])

  if (sessionLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-[#5100fd]" />
      </div>
    );
  }

  const balanceValue = metrics.available ? `${metrics.totalBalanceSol.toFixed(4)} SOL` : "0.0000 SOL";
  const profitPrefix = metrics.profit24hSol > 0 ? "+" : "";
  const profitValue = `${profitPrefix}${metrics.profit24hSol.toFixed(4)} SOL`;

  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-[#5100fd]/30">
      <div className="container mx-auto px-6 pt-32 pb-12">
        <div className="flex flex-col gap-8">
          <div className="flex-1 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-6">
                <AlphaFeed
                  alerts={alerts}
                  loading={loading}
                  settings={settings}
                  user={user}
                />
              </div>

              <div className="lg:col-span-4 space-y-6">
                <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden shadow-2xl">
                  <SniperConfigWallet
                    settings={settings}
                    onToggle={handleToggleAutoTrade}
                    user={user}
                  />
                </div>

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
