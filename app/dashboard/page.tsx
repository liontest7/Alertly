"use client"

import { Navbar } from "@/components/navbar"
import { siteConfig } from "@/lib/config"
import { Button } from "@/components/ui/button"
import { 
  ArrowRight, 
  Bell, 
  Zap, 
  Wallet, 
  TrendingUp, 
  ShieldCheck, 
  MessageSquare, 
  Loader2,
  LineChart,
  Settings,
  History,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Monitor,
  Layout,
  RefreshCw
} from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { useAuthSession } from "@/components/providers"

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const { user, loading: sessionLoading } = useAuthSession();
  const router = useRouter();

  useEffect(() => {
    if (!sessionLoading && !user) {
      router.push("/");
    }
  }, [user, sessionLoading, router]);

  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>({
    autoTrade: true,
    buyAmount: 0.5,
    slippage: 15,
    stopLoss: -30,
    takeProfit: 100
  })
  const [executing, setExecuting] = useState<string | null>(null)

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error("Failed to fetch settings");
    }
  };

  const handleToggleAutoTrade = async () => {
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
    if (!user) return;
    fetchSettings();
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/alerts')
        if (!res.ok) throw new Error('API unstable');
        const data = await res.json()
        setAlerts(Array.isArray(data) ? data : [])
      } catch (err) {
        // Silently retry or handle
      } finally {
        setLoading(false)
      }
    }
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 5000)
    return () => {
      clearInterval(interval)
    }
  }, [user])

  if (sessionLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-[#5100fd]" />
      </div>
    );
  }

  if (!user) return null;

  const handleQuickBuy = async (token: any) => {
    const tokenName = token.token || token.name
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
          amount: 0.5,
          slippage: 15.0
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
    <main className="min-h-screen bg-[#050505] text-white selection:bg-[#5100fd]/30">
      <Navbar />
      
      <div className="container mx-auto px-6 pt-32 pb-12">
        <div className="flex flex-col gap-8">
          {/* Main Content Area */}
          <div className="flex-1 space-y-8">
            {/* Top Bar Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Total Balance" value="Live" subValue="Connected trading wallet" />
                <StatCard label="24h Profit" value="Live" subValue="Calculated from executed trades" />
                <StatCard label="Active Alerts" value={alerts.length.toString()} subValue="Monitoring real-time DEX" />
              </div>
              <div className="flex flex-col justify-between">
                <Button className="w-full bg-[#5100fd] hover:bg-[#6610ff] rounded-2xl h-full py-4 font-bold flex flex-col items-center justify-center gap-1">
                  <Wallet className="w-5 h-5" />
                  <span>Withdraw</span>
                </Button>
              </div>
            </div>

            {/* Terminal Main Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Live Feed */}
              <div className="lg:col-span-8 space-y-6">
                <Card className="bg-zinc-950 border-zinc-900 overflow-hidden shadow-2xl rounded-[2rem]">
                  <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      </div>
                      <h2 className="text-sm font-bold tracking-tight">LIVE ALPHA FEED</h2>
                    </div>
                    <Link href="/onboarding">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest"
                      >
                        <Settings className="w-3 h-3 mr-1.5" /> Edit Configuration
                      </Button>
                    </Link>
                  </div>
                  
                  <div className="max-h-[700px] overflow-y-auto divide-y divide-zinc-900/50">
                    {alerts.length === 0 ? (
                      <div className="p-8 text-sm text-zinc-500">
                        {loading ? "Loading live alerts..." : "No live alerts matched your filters yet."}
                      </div>
                    ) : alerts.map((token: any, i: number) => {
                      const name = token.name || token.token
                      return (
                      <div key={i} className="group p-6 hover:bg-white/[0.02] transition-all flex items-center gap-8">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                          {name?.[0] || 'T'}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-base font-bold text-white truncate">{name}</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${
                              token.type === 'DEX_BOOST' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                              token.type === 'NEW_LISTING' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                              'bg-zinc-800 text-zinc-400'
                            }`}>
                              {token.type === 'NEW_LISTING' ? 'New' : token.type.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-zinc-600 font-mono ml-auto">2s ago</span>
                          </div>
                          <div className="flex items-center gap-8 text-[11px] text-zinc-500 font-mono">
                            <span className="text-zinc-300 font-bold">{token.mc}</span>
                            <span className="text-zinc-300 font-bold">{token.liquidity} liq</span>
                            <span className="text-zinc-300 font-bold">{token.holders} boosts</span>
                          </div>
                        </div>

                        <div className="text-right">
                           <span className={`text-sm font-bold block ${token.trend === 'up' ? 'text-green-500' : 'text-zinc-400'}`}>
                             {token.change}
                           </span>
                        </div>
                        
                        <div className="opacity-0 group-hover:opacity-100 transition-all ml-4">
                          <Button 
                            size="lg"
                            onClick={() => handleQuickBuy(token)}
                            disabled={executing === name}
                            className="bg-zinc-900 border border-zinc-800 hover:border-[#5100fd] h-10 px-6 text-xs font-bold rounded-xl"
                          >
                            {executing === name ? <Loader2 className="w-3 h-3 animate-spin" /> : "QUICK BUY"}
                          </Button>
                        </div>
                      </div>
                    )})}
                  </div>
                </Card>

                {/* Filter Chips */}
                <div className="flex flex-wrap gap-2">
                  <FilterChip label="All" active />
                  <FilterChip label="Boost" />
                  <FilterChip label="New Token" />
                  <FilterChip label="Volume Spike" />
                  <FilterChip label="Price Alert" />
                </div>
              </div>

              {/* Right Column: Quick Settings & Modules */}
              <div className="lg:col-span-4 space-y-6">
                <QuickSettingsCard 
                  settings={settings} 
                  onToggle={handleToggleAutoTrade} 
                />
                
                <WalletMiniCard />
                
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

function FilterChip({ label, active = false }: { label: string, active?: boolean }) {
  return (
    <button className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
      active ? 'bg-[#5100fd] border-[#5100fd] text-white' : 'bg-zinc-900/50 border-zinc-900 text-zinc-500 hover:border-zinc-700'
    }`}>
      {label}
    </button>
  )
}

function QuickSettingsCard({ settings, onToggle }: { settings: any, onToggle: () => void }) {
  return (
    <Card className="bg-zinc-950 border-zinc-900 p-6 rounded-[2rem]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" /> Quick Settings
        </h3>
        <button 
          onClick={onToggle}
          className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-all ${settings.autoTrade ? 'bg-green-500' : 'bg-zinc-800'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white transition-all ${settings.autoTrade ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <MiniSetting label="Buy" value={`${settings.buyAmount} SOL`} />
        <MiniSetting label="Slippage" value={`${settings.slippage}%`} />
        <MiniSetting label="Stop Loss" value={`${settings.stopLoss}%`} color="text-red-500" />
        <MiniSetting label="Take Profit" value={`+${settings.takeProfit}%`} color="text-green-500" />
      </div>
    </Card>
  )
}

function MiniSetting({ label, value, color = "text-white" }: { label: string, value: string, color?: string }) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4">
      <p className="text-[9px] text-zinc-600 uppercase font-bold mb-1">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  )
}

function WalletMiniCard() {
  const { user } = useAuthSession();
  const walletAddress = user?.wallet_address || user?.walletAddress || "Connect to see details";
  return (
    <Card className="bg-zinc-950 border-zinc-900 p-6 rounded-[2rem]">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
        <Wallet className="w-3.5 h-3.5" /> Wallet
      </h3>
      <div className="space-y-4">
        <div>
          <p className="text-2xl font-bold">Trading Wallet</p>
          <p className="text-xs text-zinc-600 truncate">{walletAddress}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl border-zinc-800 text-[10px] font-bold h-10">DEPOSIT</Button>
          <Button className="flex-1 bg-[#5100fd] rounded-xl text-[10px] font-bold h-10">WITHDRAW</Button>
        </div>
      </div>
    </Card>
  )
}

function CopyTradingMiniCard() {
  return (
    <Card className="bg-zinc-950 border-zinc-900 p-6 rounded-[2rem]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" /> Copy Trading
        </h3>
        <button className="w-10 h-5 rounded-full bg-zinc-800 flex items-center px-0.5"><div className="w-4 h-4 rounded-full bg-zinc-600" /></button>
      </div>
      <div className="space-y-4">
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-500 font-mono">7xKp...4nNz</span>
          <span className="text-green-500 font-bold">+234%</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-500 font-mono">3bRt...9wQx</span>
          <span className="text-green-500 font-bold">+156%</span>
        </div>
        <Button variant="ghost" className="w-full text-[10px] font-bold text-zinc-600 hover:text-white mt-2">
          + ADD WALLET
        </Button>
      </div>
    </Card>
  )
}

function ConnectionsCard() {
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [extensionSynced, setExtensionSynced] = useState(false);
  const [linkCommand, setLinkCommand] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    fetch('/api/auth/telegram-link')
      .then(res => res.json())
      .then(data => setTelegramLinked(data.linked))
      .catch(() => {});

    fetch('/api/extension/sync')
      .then(res => res.json())
      .then(data => setExtensionSynced(!!data.authenticated))
      .catch(() => {});
  }, []);

  const createTelegramLinkCommand = async () => {
    setLinking(true);
    try {
      const res = await fetch('/api/auth/telegram-link/request', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setLinkCommand(data.command || null);
      }
    } catch (error) {
      console.error('Failed to create Telegram link command', error);
    } finally {
      setLinking(false);
    }
  };

  return (
    <Card className="bg-zinc-950 border-zinc-900 p-6 rounded-[2rem]">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 flex items-center gap-2">
        <Monitor className="w-3.5 h-3.5" /> Connections
      </h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center p-3 rounded-xl bg-zinc-900/30 border border-zinc-900">
          <span className="text-[10px] font-medium text-zinc-400">Extension</span>
          {extensionSynced ? (
            <span className="text-[9px] font-bold text-green-500 uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">Synced</span>
          ) : (
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-900">Not Connected</span>
          )}
        </div>
        <div className="p-3 rounded-xl bg-zinc-900/30 border border-zinc-900 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-medium text-zinc-400">Telegram</span>
            {telegramLinked ? (
              <span className="text-green-500 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">Linked</span>
            ) : (
              <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-900">Not Linked</span>
            )}
          </div>
          {!telegramLinked && (
            <>
              <p className="text-[11px] text-zinc-500">Generate a one-time secure command and send it to our bot once:</p>
              <Button
                onClick={createTelegramLinkCommand}
                disabled={linking}
                className="w-full bg-[#5100fd] hover:bg-[#6610ff] h-9 rounded-xl text-[10px] font-bold"
              >
                {linking ? 'Generating…' : 'Generate /link Command'}
              </Button>
              {linkCommand && (
                <div className="text-[10px] font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-lg p-2 break-all">
                  {linkCommand}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

function StatCard({ label, value, subValue, trend, isPositive }: { label: string, value: string, subValue: string, trend?: string, isPositive?: boolean }) {
  return (
    <Card className="bg-zinc-950 border-zinc-900 p-8 rounded-[2rem]">
      <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-4">{label}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold">{value}</p>
          <p className="text-xs text-zinc-600 mt-1 font-medium">{subValue}</p>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full border ${isPositive ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
            {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span className="text-[11px] font-bold">{trend}</span>
          </div>
        )}
      </div>
    </Card>
  )
}
