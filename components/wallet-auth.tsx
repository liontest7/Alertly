"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState, useCallback, useRef } from "react";
import bs58 from "bs58";
import { useAuthSession } from "@/components/providers";
import { useToast } from "./ui/use-toast";

export function WalletAuth() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { user, refreshSession, loading } = useAuthSession();
  const { toast } = useToast();

  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Check if we are already authenticated by checking the session directly
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", { 
        credentials: "include",
        headers: { 
          "Accept": "application/json",
          "Cache-Control": "no-cache"
        }
      });
      
      if (!res.ok) return false;
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (data?.authenticated) {
            return true;
          }
        } catch (e) {
          console.error("Session parse error", e);
        }
      }
    } catch (e) {
      console.error("Session fetch error", e);
    }
    return false;
  }, []);

  // Prevent multiple auth attempts
  const authAttemptedRef = useRef(false);
  const isRefreshingRef = useRef(false);

  const lastWalletAddressRef = useRef<string | null>(null);

  const authenticate = useCallback(async () => {
    if (!connected || !publicKey || !signMessage) return;
    if (user) return;
    if (isAuthenticating) return;
    
    const currentAddress = publicKey.toBase58();
    if (authAttemptedRef.current && lastWalletAddressRef.current === currentAddress) return;

    // Use a small delay to ensure we are not in a race condition with session check
    await new Promise(resolve => setTimeout(resolve, 800));
    if (user) {
      console.log("User already exists, skipping authenticate");
      return;
    }

    // Check session one last time before starting auth
    if (isRefreshingRef.current) return;
    const alreadyAuth = await checkSession();
    if (alreadyAuth) {
      console.log("CheckSession returned true, refreshing...");
      isRefreshingRef.current = true;
      try {
        await refreshSession();
      } finally {
        isRefreshingRef.current = false;
      }
      return;
    }

    authAttemptedRef.current = true;
    lastWalletAddressRef.current = currentAddress;

    try {
      setIsAuthenticating(true);

      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ origin: window.location.origin }),
      });
      if (!nonceRes.ok) throw new Error("Failed to fetch nonce");

      const nonceData = await nonceRes.json();
      const { message, nonceToken } = nonceData;
      const nonce_token = nonceToken;

      const encodedMessage = new TextEncoder().encode(message);

      let signatureBase58: string;

      try {
        const signature = await signMessage(encodedMessage);
        signatureBase58 = bs58.encode(signature);
      } catch (e: any) {
        if (e.message?.includes("User rejected")) {
          toast({
            title: "Authentication Cancelled",
            description: "You rejected the signature request in your wallet.",
            variant: "destructive",
          });

          authAttemptedRef.current = false;
          // Don't disconnect wallet on signature rejection, just stop auth process
          return;
        }

        throw e;
      }

        const loginRes = await fetch("/api/auth/wallet-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          wallet_address: publicKey.toBase58(),
          signature: signatureBase58,
          message,
          nonce_token,
        }),
        credentials: "include",
      });

      if (!loginRes.ok) {
        const errorText = await loginRes.text();
        console.error("Login failed response:", errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || "Login failed");
        } catch (e) {
          throw new Error(`Login failed (Status ${loginRes.status})`);
        }
      }

      await refreshSession();

      toast({
        title: "Authenticated",
        description: "Your wallet has been verified successfully.",
      });
      
      // Force immediate redirect to dashboard if on landing page
      if (window.location.pathname === "/") {
        window.location.href = "/dashboard";
      } else {
        // Refresh page to ensure all components see the new session
        window.location.reload();
      }
    } catch (error: any) {
      console.error("Auth error:", error);

      authAttemptedRef.current = false;

      toast({
        title: "Authentication Error",
        description: error.message || "Login failed",
        variant: "destructive",
      });
      
      // Don't disconnect on auth error, just allow retry
    } finally {
      setIsAuthenticating(false);
    }
  }, [
    connected,
    publicKey,
    signMessage,
    user,
    isAuthenticating,
    refreshSession,
    toast,
  ]);

  useEffect(() => {
    if (!connected && lastWalletAddressRef.current) {
      toast({
        title: "Disconnected",
        description: "Wallet connection has been closed.",
      });
      authAttemptedRef.current = false;
      lastWalletAddressRef.current = null;
    }
    
    // Only attempt authentication if connected and NOT already logged in
    if (connected && !user && !isAuthenticating && !loading) {
      const currentAddress = publicKey?.toBase58();
      
      // If we already tried this address and it failed or we are in a loop, don't retry immediately
      if (authAttemptedRef.current && lastWalletAddressRef.current === currentAddress) {
        return;
      }

      if (isAuthenticating) return;

      const attemptAuth = async () => {
        if (user) return;
        const isAuthenticated = await checkSession();
        if (isAuthenticated) {
          authAttemptedRef.current = true;
          lastWalletAddressRef.current = publicKey?.toBase58() || null;
          await refreshSession();
          return;
        }
        
        // Automatically trigger authentication if not logged in
        console.log("WalletAuth: Triggering signature request...");
        authenticate();
      };

      const timer = setTimeout(attemptAuth, 500);
      return () => clearTimeout(timer);
    } else if (!connected) {
      authAttemptedRef.current = false;
      lastWalletAddressRef.current = null;
    }
  }, [connected, user, isAuthenticating, loading, authenticate, publicKey, refreshSession, toast]);

  return null;
}
