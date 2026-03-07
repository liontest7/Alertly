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

  // Prevent multiple auth attempts
  const authAttemptedRef = useRef(false);

  const lastWalletAddressRef = useRef<string | null>(null);

  const authenticate = useCallback(async () => {
    if (!connected || !publicKey || !signMessage) return;
    if (user) return;
    if (isAuthenticating) return;
    
    const currentAddress = publicKey.toBase58();
    if (authAttemptedRef.current && lastWalletAddressRef.current === currentAddress) return;

    // Use a small delay to ensure we are not in a race condition with session check
    await new Promise(resolve => setTimeout(resolve, 500));
    if (user) return;

    authAttemptedRef.current = true;
    lastWalletAddressRef.current = currentAddress;

    try {
      setIsAuthenticating(true);

      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: window.location.origin }),
      });
      if (!nonceRes.ok) throw new Error("Failed to fetch nonce");

      const { message, nonceToken } = await nonceRes.json();
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
          // Disconnect wallet to reset button state if user cancels signature
          if (connected) {
            disconnect();
          }
          return;
        }

        throw e;
      }

      const loginRes = await fetch("/api/auth/wallet-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet_address: publicKey.toBase58(),
          signature: signatureBase58,
          message,
          nonce_token,
        }),
        credentials: "include",
      });

      const loginData = await loginRes.json();

      if (!loginRes.ok) {
        throw new Error(loginData.message || "Login failed");
      }

      await refreshSession();

      toast({
        title: "Authenticated",
        description: "Your wallet has been verified successfully.",
      });
      
      // Force immediate redirect to dashboard if on landing page
      if (window.location.pathname === "/") {
        window.location.href = "/dashboard";
      }
    } catch (error: any) {
      console.error("Auth error:", error);

      authAttemptedRef.current = false;

      toast({
        title: "Authentication Error",
        description: error.message || "Login failed",
        variant: "destructive",
      });
      
      // Disconnect on auth error to reset button
      if (connected) {
        disconnect();
      }
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

      // First, check session one more time before showing signature request
      const checkSessionAndAuth = async () => {
        try {
          const res = await fetch("/api/auth/session", { credentials: "include" });
          const data = await res.json();
          if (data?.authenticated) {
            await refreshSession();
            return;
          }
          authenticate();
        } catch (e) {
          authenticate();
        }
      };

      const timer = setTimeout(() => {
        checkSessionAndAuth();
      }, 500);
      return () => clearTimeout(timer);
    } else if (!connected) {
      authAttemptedRef.current = false;
      lastWalletAddressRef.current = null;
    }
  }, [connected, user, isAuthenticating, loading, authenticate, publicKey, toast]);

  return null;
}
