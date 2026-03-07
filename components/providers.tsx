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
    // Don't set loading to true if we already have a user to avoid UI flickering
    if (!user) setLoading(true);

    try {
      const res = await fetch("/api/auth/session", {
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) throw new Error("Failed to fetch session");

      const data = await res.json();

      if (data?.authenticated && data.user) {
        setUser((prev) => {
          // Deep check to ensure we don't skip update if properties changed
          if (prev?.user_id === data.user.user_id && 
              prev?.wallet_address === data.user.wallet_address && 
              prev?.vip_status === data.user.vip_status) {
            return prev;
          }

          window.dispatchEvent(
            new CustomEvent("auth-session-updated", { detail: data.user }),
          );

          return data.user;
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Session refresh failed:", error);
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
    await refreshSession();
  };

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

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
