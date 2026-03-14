"use client";

import { Navbar } from "@/components/navbar";
import { useEffect, useState } from "react";

type TokenProfileResponse = {
  address: string;
  bestPair: any;
  pairsCount: number;
  pairs: any[];
  message?: string;
};

export default function TokenProfilePage({ params }: { params: { address: string } }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<TokenProfileResponse | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [holders, setHolders] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/token/${params.address}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.message || `Failed to load token profile (${res.status})`);
        }

        if (alive) {
          setProfile(data);
        }

        const [eventsRes, pumpRes] = await Promise.all([
          fetch(`/api/alerts/events?address=${params.address}&limit=20`, { cache: "no-store" }),
          params.address.toLowerCase().endsWith("pump")
            ? fetch(`https://frontend-api.pump.fun/coins/${params.address}`, { signal: AbortSignal.timeout(4000) }).catch(() => null)
            : Promise.resolve(null),
        ]);
        const eventsData = await eventsRes.json().catch(() => ({ events: [] }));
        if (alive) {
          setEvents(Array.isArray(eventsData?.events) ? eventsData.events : []);
        }
        if (alive && pumpRes?.ok) {
          const pumpData = await pumpRes.json().catch(() => null);
          if (pumpData?.holder_count > 0) setHolders(pumpData.holder_count);
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "Failed to load token profile");
          setProfile(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 15000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [params.address]);

  const pair = profile?.bestPair;
  const base = pair?.baseToken || {};
  const info = pair?.info || {};
  const websites = Array.isArray(info.websites) ? info.websites : [];
  const socials = Array.isArray(info.socials) ? info.socials : [];
  const pairAddress = pair?.pairAddress;
  const chartUrl = pairAddress ? `https://dexscreener.com/solana/${pairAddress}?embed=1&theme=dark` : null;
  const dexUrl = pair?.url || (pairAddress ? `https://dexscreener.com/solana/${pairAddress}` : null);
  const jupiterSwap = `https://jup.ag/swap/SOL-${params.address}`;

  const formatAlertedAt = (value?: string) => {
    if (!value) return "Unknown";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  };

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="container mx-auto px-6 pt-32 pb-12 space-y-6">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          {loading ? (
            <p className="text-zinc-400">Loading token profile…</p>
          ) : error ? (
            <div className="space-y-3">
              <p className="text-red-400 font-semibold">Failed to load live token profile.</p>
              <p className="text-zinc-400 text-sm">{error}</p>
              <a className="inline-block px-4 py-2 rounded-xl bg-zinc-800 font-bold" href={jupiterSwap} target="_blank">
                Open on Jupiter
              </a>
            </div>
          ) : !pair ? (
            <p className="text-zinc-400">No DexScreener pair found yet for this token.</p>
          ) : (
            <>
              <div className="flex items-center gap-4">
                {info?.imageUrl ? (
                  <img src={info.imageUrl} alt={base.symbol || "token"} className="w-16 h-16 rounded-2xl" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center font-black text-2xl">{(base.symbol || "T")[0]}</div>
                )}
                <div>
                  <h1 className="text-3xl font-black">{base.name || base.symbol || "Token"}</h1>
                  <p className="text-zinc-400 text-sm">{params.address}</p>
                  <p className="text-sm mt-1">Price: <span className="font-bold">${pair.priceUsd || "N/A"}</span> · 24h: <span className="font-bold">{pair?.priceChange?.h24 ?? "N/A"}%</span></p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-black/40 border border-zinc-800 rounded-xl p-3">MC: <b>{pair.fdv ? `$${Number(pair.fdv).toLocaleString()}` : "N/A"}</b></div>
                <div className="bg-black/40 border border-zinc-800 rounded-xl p-3">Liquidity: <b>{pair?.liquidity?.usd ? `$${Number(pair.liquidity.usd).toLocaleString()}` : "N/A"}</b></div>
                <div className="bg-black/40 border border-zinc-800 rounded-xl p-3">Volume 24h: <b>{pair?.volume?.h24 ? `$${Number(pair.volume.h24).toLocaleString()}` : "N/A"}</b></div>
                {holders != null && holders > 0 ? (
                  <div className="bg-black/40 border border-zinc-800 rounded-xl p-3">Holders: <b className="text-purple-400">{holders.toLocaleString()}</b></div>
                ) : (
                  <div className="bg-black/40 border border-zinc-800 rounded-xl p-3">Pairs found: <b>{profile?.pairsCount || 0}</b></div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {dexUrl && <a className="px-4 py-2 rounded-xl bg-[#5100fd] font-bold" href={dexUrl} target="_blank">Open on DexScreener</a>}
                <a className="px-4 py-2 rounded-xl bg-zinc-800 font-bold" href={jupiterSwap} target="_blank">Buy on Jupiter</a>
                {websites[0]?.url && <a className="px-4 py-2 rounded-xl bg-zinc-800 font-bold" href={websites[0].url} target="_blank">Website</a>}
                {socials.map((s: any, i: number) => (
                  <a key={i} className="px-4 py-2 rounded-xl bg-zinc-800 font-bold" href={s.url} target="_blank">{s.type || "Social"}</a>
                ))}
              </div>
            </>
          )}
        </div>


        {!loading && (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="text-lg font-black mb-4">Recent Alert Events</h2>
            {events.length === 0 ? (
              <p className="text-zinc-400 text-sm">No alert events recorded for this token yet.</p>
            ) : (
              <div className="space-y-2">
                {events.map((event, idx) => (
                  <div key={`${event.fingerprint || idx}-${idx}`} className="rounded-xl border border-zinc-800 bg-black/30 p-3 text-sm flex flex-wrap items-center gap-3">
                    <span className="px-2 py-1 rounded bg-[#5100fd] text-white text-[10px] font-bold uppercase">{event.type || "Alert"}</span>
                    <span className="font-bold">{event.name || event.symbol || "Token"}</span>
                    <span className={event.trend === "up" ? "text-green-400" : event.trend === "down" ? "text-red-400" : "text-zinc-300"}>{event.change || "0%"}</span>
                    <span className="text-zinc-400">Alerted at: {formatAlertedAt(event.alertedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && !error && chartUrl && (
          <div className="rounded-3xl border border-zinc-800 overflow-hidden">
            <iframe src={chartUrl} width="100%" height="640" />
          </div>
        )}
      </div>
    </main>
  );
}
