"use client"

import { StatCard } from "@/components/Dashboard/StatCard"
import { SniperConfigWallet } from "@/components/Dashboard/SniperConfigWallet"
import { ConnectionsCard } from "@/components/Dashboard/ConnectionsCard"
import { CopyTradingMiniCard } from "@/components/Dashboard/CopyTradingMiniCard"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { useAuthSession } from "@/components/providers"
import { AlphaFeed } from "@/components/Dashboard/AlphaFeed"

const MAX_LOCAL_ALERTS = 200;

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
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [togglingAlerts, setTogglingAlerts] = useState(false);

  const [settings, setSettings] = useState<any>({
    autoTrade: false,
    buyAmount: 0.5,
    slippage: 10,
    stopLoss: 25,
    takeProfit: 50,
    alertsEnabled: true,
  })

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setAlertsEnabled(data.alertsEnabled !== false);
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

  const handleToggleAlerts = async () => {
    if (!user) return;
    setTogglingAlerts(true);
    try {
      const newEnabled = !alertsEnabled;
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertsEnabled: newEnabled })
      });
      if (res.ok) {
        setAlertsEnabled(newEnabled);
        setSettings((prev: any) => ({ ...prev, alertsEnabled: newEnabled }));
        if (!newEnabled) {
          setAlerts([]);
        }
      }
    } catch {
      console.error("Failed to toggle alerts");
    } finally {
      setTogglingAlerts(false);
    }
  };

  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchMetrics();

    setAlerts([]);
    setLoading(true);

    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }

    let stream: EventSource | null = null;
    try {
      stream = new EventSource('/api/alerts/stream');
      streamRef.current = stream;

      stream.addEventListener('connected', () => {
        setLoading(false);
      });

      stream.addEventListener('init', (event: any) => {
        try {
          const initialAlerts = JSON.parse(event.data);
          if (Array.isArray(initialAlerts) && initialAlerts.length > 0) {
            setAlerts(initialAlerts.slice(0, MAX_LOCAL_ALERTS));
            setLoading(false);
          }
        } catch {}
      });

      stream.addEventListener('alert', (event: any) => {
        try {
          const newAlert = JSON.parse(event.data);
          if (newAlert && newAlert.fingerprint) {
            setAlerts(prev => {
              const existing = prev.findIndex(a => a.fingerprint === newAlert.fingerprint);
              if (existing !== -1) {
                const updated = [...prev];
                updated[existing] = { ...updated[existing], ...newAlert };
                return updated;
              }
              const next = [newAlert, ...prev];
              return next.length > MAX_LOCAL_ALERTS ? next.slice(0, MAX_LOCAL_ALERTS) : next;
            });
            setLoading(false);
          }
        } catch {}
      });

      stream.addEventListener('heartbeat', () => {
        setLoading(false);
      });

      stream.addEventListener('paused', () => {
        setLoading(false);
        setAlerts([]);
      });

      stream.onerror = () => {
        setLoading(false);
      };
    } catch {
      setLoading(false);
    }

    const metricsInterval = setInterval(fetchMetrics, 15000);

    return () => {
      if (stream) stream.close();
      streamRef.current = null;
      clearInterval(metricsInterval);
    }
  }, [user, alertsEnabled])

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
                  alerts={alertsEnabled !== false ? alerts : []}
                  loading={loading}
                  settings={settings}
                  user={user}
                  alertsEnabled={alertsEnabled}
                  onToggleAlerts={user ? handleToggleAlerts : undefined}
                  togglingAlerts={togglingAlerts}
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
