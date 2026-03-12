"use client";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { WalletContextProvider } from "@/components/wallet-provider";
import { WalletAuth } from "@/components/wallet-auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type SessionUser = {
  user_id: string;
  wallet_address: string;
  vip_status: boolean;
  isAdmin: boolean;
};

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refreshSession: async () => {},
  logout: async () => {},
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshingRef = useRef(false);
  const initializedRef = useRef(false);

  const refreshSession = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    if (!initializedRef.current) {
      setLoading(true);
    }

    try {
      const res = await fetch("/api/auth/session", {
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setUser(null);
          return;
        }
        return;
      }

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return;
      }

      const data = await res.json();

      if (data?.authenticated && data.user) {
        setUser({
          user_id: String(data.user.id || data.user.user_id),
          wallet_address: String(data.user.walletAddress || data.user.wallet_address),
          vip_status: Boolean(data.user.vipStatus || data.user.vip_status),
          isAdmin: Boolean(data.user.isAdmin),
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
      initializedRef.current = true;
      refreshingRef.current = false;
    }
  }, []);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    setUser(null);
  };

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!user) return;

    let lastAlertId: string | null = null;
    let eventSource: EventSource | null = null;

    const handleAlert = (alertData: any[]) => {
      const alert = alertData[0];
      if (!alert || alert.id === lastAlertId) return;
      lastAlertId = alert.id;

      const audio = new Audio("/notification.mp3");
      audio.play().catch(() => {});
    };

    const connect = () => {
      eventSource = new EventSource("/api/alerts/stream");

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data) && data.length > 0) handleAlert(data);
        } catch {}
      };

      eventSource.addEventListener("alerts", (event: any) => {
        try {
          const data = JSON.parse(event.data);
          if (Array.isArray(data) && data.length > 0) handleAlert(data);
        } catch {}
      });

      eventSource.onerror = () => {
        eventSource?.close();
        setTimeout(connect, 5000);
      };
    };

    connect();
    return () => eventSource?.close();
  }, [user]);

  return (
    <WalletContextProvider>
      <AuthContext.Provider value={{ user, loading, refreshSession, logout }}>
        <WalletAuth />
        {children}
        <Toaster />
        <SonnerToaster position="bottom-right" />
      </AuthContext.Provider>
    </WalletContextProvider>
  );
}

export function useAuthSession() {
  return useContext(AuthContext);
}
