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

  const refreshSession = useCallback(async () => {
    if (refreshingRef.current) return;

    refreshingRef.current = true;
    
    // Only show loading on initial load or if we don't have a user
    if (!user) {
      setLoading(true);
    }

    try {
      console.log("Providers: Fetching session...");
      const res = await fetch("/api/auth/session", {
        credentials: "include",
        cache: "no-store",
        headers: { 
          "Accept": "application/json",
          "Cache-Control": "no-cache"
        }
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
      console.log("Session data received:", data);

      if (data?.authenticated && data.user) {
        const userData = {
          user_id: String(data.user.id || data.user.user_id),
          wallet_address: String(data.user.walletAddress || data.user.wallet_address),
          vip_status: Boolean(data.user.vipStatus || data.user.vip_status)
        };
        console.log("Setting user state:", userData);
        setUser(userData);
      } else {
        console.log("No authenticated user found in session");
        setUser(null);
      }
    } catch (error) {
      console.error("Session refresh error:", error);
      setUser(null);
    } finally {
      setLoading(false);
      refreshingRef.current = false;
    }
  }, [user]);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.error("Logout error:", e);
    }

    setUser(null);
    // Remove the redundant await refreshSession() which might cause state flicker
  };

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    // Persistent Alert Listener
    const eventSource = new EventSource("/api/alerts/stream");
    
    eventSource.onmessage = (event) => {
      try {
        const alert = JSON.parse(event.data);
        const isTerminalPage = window.location.pathname.includes("/dashboard");
        
        if (isTerminalPage) {
          // Play sound only in terminal
          const audio = new Audio("/notification.mp3");
          audio.play().catch(() => {});
        } else {
          // Show toast and notification if not in terminal
          import("sonner").then(({ toast }) => {
            toast.info(`New Alert: ${alert.name}`, {
              description: `${alert.type} - ${alert.change} - MC: ${alert.mc}`,
              action: {
                label: "View",
                onClick: () => window.location.href = "/dashboard"
              },
              duration: 10000
            });
          });
        }
      } catch (e) {
        console.error("Alert stream error:", e);
      }
    };

    return () => eventSource.close();
  }, []);

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
