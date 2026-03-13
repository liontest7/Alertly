"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthSession } from "./providers";

type AlertNotification = {
  id: string;
  title: string;
  message: string;
  address: string;
};

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(600, now + 0.1);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {}
  }
}

export function NotificationSystem() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthSession();
  const lastAlertIdRef = useRef<string | null>(null);
  const [notification, setNotification] = useState<AlertNotification | null>(null);

  useEffect(() => {
    if (!user) return;

    const checkAlerts = async () => {
      try {
        const res = await fetch("/api/alerts");
        if (!res.ok) return;
        const data = await res.json();
        const latest = Array.isArray(data) ? data[0] : null;
        if (!latest || latest.id === lastAlertIdRef.current) return;

        lastAlertIdRef.current = latest.id;

        const isOnDashboard = pathname === "/dashboard";
        if (!isOnDashboard) {
          playNotificationSound();
          setNotification({
            id: latest.id,
            title: `New ${latest.type || "Alert"}`,
            message: `${latest.name || ""} (${latest.symbol || ""}) — MC: ${latest.mc || "-"} | Liq: ${latest.liquidity || "-"}`,
            address: latest.address || "",
          });
          setTimeout(() => setNotification(null), 8000);
        }
      } catch {
      }
    };

    const interval = setInterval(checkAlerts, 6000);
    return () => clearInterval(interval);
  }, [user, pathname]);

  if (!notification) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-zinc-900 border border-[#5100fd] rounded-xl p-4 shadow-2xl shadow-[#5100fd]/20 flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-2 h-2 rounded-full bg-[#5100fd] animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[#5100fd] font-bold text-sm uppercase tracking-wider">{notification.title}</h4>
          <p className="text-white text-sm mt-1 truncate">{notification.message}</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                router.push("/dashboard");
                setNotification(null);
              }}
              className="bg-[#5100fd] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#5100fd]/80 transition-colors"
            >
              View Alerts
            </button>
            {notification.address && (
              <button
                onClick={() => {
                  router.push(`/token/${notification.address}`);
                  setNotification(null);
                }}
                className="bg-zinc-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                View Token
              </button>
            )}
          </div>
        </div>
        <button
          onClick={() => setNotification(null)}
          className="text-zinc-500 hover:text-white flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
