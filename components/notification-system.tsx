"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthSession } from "./providers";

export function NotificationSystem() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthSession();
  const [lastAlertId, setLastAlertId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    id: string;
    title: string;
    message: string;
    address: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;

    const audio = new Audio("/sounds/alert.mp3");

    const checkAlerts = async () => {
      try {
        const res = await fetch("/api/alerts/live?limit=1");
        if (!res.ok) return;
        const data = await res.json();
        const latest = data.alerts?.[0];

        if (latest && latest.id !== lastAlertId) {
          setLastAlertId(latest.id);

          // If on terminal/dashboard page, only play sound
          if (pathname === "/dashboard") {
            audio.play().catch(() => null);
          } else {
            // If on other pages, show notification banner + sound
            setNotification({
              id: latest.id,
              title: `New ${latest.type} Alert`,
              message: `${latest.name} (${latest.symbol}) - ${latest.change}`,
              address: latest.address,
            });
            audio.play().catch(() => null);
            
            // Auto hide after 8 seconds
            setTimeout(() => setNotification(null), 8000);
          }
        }
      } catch (err) {
        console.error("Failed to check alerts:", err);
      }
    };

    const interval = setInterval(checkAlerts, 5000);
    return () => clearInterval(interval);
  }, [user, pathname, lastAlertId]);

  if (!notification) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-zinc-900 border border-[#5100fd] rounded-xl p-4 shadow-2xl shadow-[#5100fd]/20 flex items-start gap-4">
        <div className="flex-1">
          <h4 className="text-[#5100fd] font-bold text-sm uppercase tracking-wider">{notification.title}</h4>
          <p className="text-white text-sm mt-1">{notification.message}</p>
          <div className="flex gap-2 mt-3">
            <button 
              onClick={() => {
                router.push("/dashboard");
                setNotification(null);
              }}
              className="bg-[#5100fd] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#5100fd]/80 transition-colors"
            >
              View Dashboard
            </button>
            <button 
              onClick={() => {
                router.push(`/token/${notification.address}`);
                setNotification(null);
              }}
              className="bg-zinc-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              View Token
            </button>
          </div>
        </div>
        <button 
          onClick={() => setNotification(null)}
          className="text-zinc-500 hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
