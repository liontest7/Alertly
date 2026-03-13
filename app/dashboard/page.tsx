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
import { TradesPanel } from "@/components/Dashboard/TradesPanel"

const MAX_LOCAL_ALERTS = 500;
const LS_KEY = 'alertly_feed_v2';
const OLD_LS_KEYS = ['alertly_feed_v1'];

export default function DashboardPage() {
  const { user, loading: sessionLoading } = useAuthSession();
  const router = useRouter();

  useEffect(() => {
    if (!sessionLoading && !user && localStorage.getItem('onboarding_completed') !== 'true') {
      router.push("/onboarding");
    }
  }, [user, sessionLoading, router]);

  useEffect(() => {
    try {
      OLD_LS_KEYS.forEach(key => localStorage.removeItem(key));
    } catch {}
  }, []);

  const [alerts, setAlerts] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (cached) return JSON.parse(cached).slice(0, MAX_LOCAL_ALERTS);
    } catch {}
    return [];
  })
  const [loading, setLoading] = useState(() => {
    try { return !localStorage.getItem(LS_KEY); } catch { return true; }
  })
  const [metrics, setMetrics] = useState({
    totalBalanceSol: 0,
    profit24hSol: 0,
    tradeCount24h: 0,
    available: false,
  });
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [togglingAlerts, setTogglingAlerts] = useState(false);
  const [showTrades, setShowTrades] = useState(false);

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
    } catch (err) {
      console.error("Failed to fetch settings", err);
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
    } catch (err) {
      console.error("Failed to fetch dashboard metrics", err);
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
      console.error("Failed to update auto-trade", err);
    }
  }

  const handleClearFeed = () => {
    try {
      localStorage.removeItem(LS_KEY);
      OLD_LS_KEYS.forEach(key => localStorage.removeItem(key));
    } catch {}
    setAlerts([]);
  };

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
    } catch (err) {
      console.error("Failed to toggle alerts", err);
    } finally {
      setTogglingAlerts(false);
    }
  };

  useEffect(() => {
    try {
      if (alerts.length > 0) {
        localStorage.setItem(LS_KEY, JSON.stringify(alerts.slice(0, MAX_LOCAL_ALERTS)));
      }
    } catch {}
  }, [alerts]);

  const streamRef = useRef<EventSource | null>(null);

  // Settings + metrics: fetch once on mount, independent of SSE
  useEffect(() => {
    fetchSettings();
    fetchMetrics();
    const metricsInterval = setInterval(fetchMetrics, 15000);
    return () => clearInterval(metricsInterval);
  }, []);

  useEffect(() => {
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
          const serverAlerts = JSON.parse(event.data);
          if (!Array.isArray(serverAlerts) || serverAlerts.length === 0) return;

          setAlerts(prev => {
            // Map local alerts by fingerprint — they have a trusted clientSeenAt
            const localMap = new Map(prev.map((a: any) => [a.fingerprint, a]));

            const merged = serverAlerts.map((sa: any) => {
              const local = localMap.get(sa.fingerprint);
              if (local) {
                // Already seen before: preserve the client-stamped time entirely
                return {
                  ...sa,
                  clientSeenAt: local.clientSeenAt || local.alertedAt,
                };
              }
              // New alert arriving via init (not yet in localStorage):
              // stamp with the server's detection time as the baseline
              return {
                ...sa,
                clientSeenAt: sa.alertedAt || new Date().toISOString(),
              };
            });

            // Keep local-only alerts (evicted from server buffer but still in localStorage)
            const serverFps = new Set(serverAlerts.map((a: any) => a.fingerprint));
            const localOnly = prev.filter((a: any) => !serverFps.has(a.fingerprint));

            const combined = [...merged, ...localOnly];

            // Sort newest-first by the stable client-stamped time
            combined.sort((a: any, b: any) => {
              const ta = new Date(a.clientSeenAt || a.alertedAt).getTime();
              const tb = new Date(b.clientSeenAt || b.alertedAt).getTime();
              return tb - ta;
            });

            return combined.slice(0, MAX_LOCAL_ALERTS);
          });

          setLoading(false);
        } catch {}
      });

      stream.addEventListener('alert', (event: any) => {
        try {
          const newAlert = JSON.parse(event.data);
          if (newAlert && newAlert.fingerprint) {
            setAlerts(prev => {
              const existingIdx = prev.findIndex((a: any) => a.fingerprint === newAlert.fingerprint);
              if (existingIdx !== -1) {
                // Enrichment update: keep the original clientSeenAt, never overwrite it
                const updated = [...prev];
                updated[existingIdx] = {
                  ...updated[existingIdx],
                  ...newAlert,
                  clientSeenAt: updated[existingIdx].clientSeenAt || updated[existingIdx].alertedAt,
                };
                return updated;
              }
              // Brand-new alert: stamp with client time right now
              const stamped = {
                ...newAlert,
                clientSeenAt: new Date().toISOString(),
              };
              const next = [stamped, ...prev];
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

    return () => {
      if (stream) stream.close();
      streamRef.current = null;
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
                {/* Flip toggle button */}
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowTrades((v) => !v)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all duration-200 shadow-lg ${
                      showTrades
                        ? "bg-[#5100fd] border-[#5100fd] text-white shadow-[#5100fd]/30"
                        : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-[#5100fd]/60 hover:text-[#5100fd]"
                    }`}
                  >
                    {showTrades ? "📡 Live Feed" : "📊 My Trades"}
                  </button>
                </div>

                {/* Flip card container */}
                <div style={{ perspective: "1200px" }}>
                  <div style={{
                    position: "relative",
                    transformStyle: "preserve-3d",
                    transition: "transform 0.6s cubic-bezier(0.4,0,0.2,1)",
                    transform: showTrades ? "rotateY(180deg)" : "rotateY(0deg)",
                    minHeight: 400,
                  }}>
                    {/* Front — Live Feed */}
                    <div style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", position: showTrades ? "absolute" : "relative", width: "100%", top: 0, left: 0 }}>
                      <AlphaFeed
                        alerts={alertsEnabled !== false ? alerts : []}
                        loading={loading}
                        settings={settings}
                        user={user}
                        alertsEnabled={alertsEnabled}
                        onToggleAlerts={user ? handleToggleAlerts : undefined}
                        togglingAlerts={togglingAlerts}
                        onClearFeed={handleClearFeed}
                      />
                    </div>

                    {/* Back — Trades Panel */}
                    <div style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", position: showTrades ? "relative" : "absolute", width: "100%", top: 0, left: 0 }}>
                      <TradesPanel user={user} settings={settings} />
                    </div>
                  </div>
                </div>
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
