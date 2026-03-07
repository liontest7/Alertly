"use client";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";
import { CircleArrowRight, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "./ui/use-toast";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { useAuthSession } from "@/components/providers";
import bs58 from "bs58";
import Link from "next/link";

interface HeroActionsProps {
  loading: boolean;
  user: any;
}

export function HeroActions({ loading, user }: HeroActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { setVisible } = useWalletModal();
  const { connected, publicKey, signMessage } = useWallet();
  const { refreshSession } = useAuthSession();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLaunchTerminal = async () => {
    console.log("Hero: Terminal clicked (public access)");
    router.push("/dashboard");
  };

  const handleLogin = async () => {
    if (!connected || !publicKey || !signMessage) return;
    setIsAuthenticating(true);
    try {
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: window.location.origin }),
      });
      if (!nonceRes.ok) throw new Error("Failed to get nonce");
      const { message, nonceToken } = await nonceRes.json();
      
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);
      const signatureBase58 = bs58.encode(signature);

      const loginRes = await fetch("/api/auth/wallet-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: publicKey.toBase58(),
          signature: signatureBase58,
          message,
          nonce_token: nonceToken,
        }),
        credentials: "include",
      });

      if (loginRes.ok) {
        await refreshSession(true);
        router.push("/dashboard");
      } else {
        const errorData = await loginRes.json();
        throw new Error(errorData.message || "Login failed");
      }
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error.message || "Login failed",
        variant: "destructive",
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleDownloadExtension = () => {
    window.open(siteConfig.links.docs, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-wrap gap-4 animate-fade-in-up animation-delay-400">
      <Button
        size="lg"
        className="group bg-[#5100fd] hover:bg-[#6610ff] text-white px-8 py-6 text-base rounded-full transition-all duration-[650ms] hover:scale-[1.02]"
        onClick={handleLaunchTerminal}
        disabled={isAuthenticating}
      >
        {isAuthenticating ? "Authenticating..." : "GET ALERT NOW"}
        <CircleArrowRight className="ml-2 h-5 w-5 transition-transform duration-[650ms] group-hover:rotate-90" />
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="px-8 py-6 text-base rounded-full border-zinc-800 bg-white text-black hover:bg-zinc-100 font-bold cursor-pointer"
        onClick={handleDownloadExtension}
      >
        Download Extension
      </Button>
    </div>
  );
}
