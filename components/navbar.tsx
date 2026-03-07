"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { siteConfig } from "@/lib/config";
import { Button } from "./ui/button";
import { MobileMenu } from "./mobile-menu";
import { useToast } from "./ui/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAuthSession } from "@/components/providers";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useRef, useState } from "react";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { user, loading, refreshSession: login } = useAuthSession();
  const { setVisible } = useWalletModal();
  const { connected, publicKey, wallet, select, wallets, disconnect } = useWallet();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const lastWalletName = useRef<string | null>(null);

  // Trigger wallet interaction immediately when a wallet is selected
  useEffect(() => {
    if (isClient && wallet && !connected && !loading && !user) {
      // Avoid auto-connecting if it's already connecting
      if (wallet.adapter.connecting) return;
      
      wallet.adapter.connect().catch((err: any) => {
        console.error("Wallet connection failed:", err);
        // If connection fails or is cancelled, disconnect to reset the button state
        wallet.adapter.disconnect();
        
        // Show informative toast for connection failure
        const isUserRejected = err.message?.includes("User rejected") || err.name === "WalletConnectionError";
        toast({
          title: isUserRejected ? "Connection Cancelled" : "Connection Failed",
          description: isUserRejected 
            ? "You cancelled the connection request in your wallet." 
            : "Failed to connect to the wallet. Please try again.",
          variant: "destructive",
        });
      });
    }
  }, [wallet, connected, loading, user, isClient]);

  // Auto-login when wallet is connected but user is not authenticated
  useEffect(() => {
    if (isClient && connected && publicKey && !user && !loading) {
      console.log("Wallet connected, attempting login...");
      login().catch((err) => {
        console.error("Auto-login failed:", err);
      });
    }
  }, [connected, publicKey, user, loading, login, isClient]);

  const handleConnectWallet = () => {
    if (connected) {
      // If already connected but not logged in, we might want to show disconnect or just re-auth
      // But typically WalletMultiButton handles its own menu
      return;
    }
    setVisible(true);
  };

  const navigateHome = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push("/");
  };

  const handleLaunchTerminal = () => {
    if (loading) return;
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please connect your wallet and sign the message to access the terminal.",
        variant: "destructive",
        duration: 5000,
      });
      // Ensure modal is visible
      setVisible(true);
      return;
    }
    
    // Immediate redirect
    window.location.href = "/dashboard";
  };

  return (
    <nav
      className="fixed inset-x-0 z-[100] px-4 md:px-6 transition-all duration-300 ease-out top-4 md:top-8 flex justify-center"
    >
      <div
        className="bg-black/40 backdrop-blur-md rounded-full px-4 md:px-8 py-3 flex items-center justify-between shadow-lg border border-white/5 w-full max-w-[1200px] relative z-[51]"
      >
        {/* Logo */}
        <Link
          href="/"
          onClick={navigateHome}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer shrink-0 group relative z-[60]"
        >
          <div
            className="relative w-10 h-10 transition-all duration-500 group-hover:scale-110"
          >
            <Image
              src="/images/logo.png"
              alt={siteConfig.name}
              fill
              className="rounded-full object-contain"
              priority
            />
          </div>
          <span className="text-xl font-bold tracking-tight text-white leading-none">
            {siteConfig.name}
          </span>
        </Link>

        {/* Desktop Menu Links */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/#capabilities"
            className="text-[17px] font-medium text-white hover:text-[#5100fd] transition-colors"
          >
            Features
          </Link>
          <Link
            href="/#token-section"
            className="text-[17px] font-bold text-white hover:text-[#5100fd] transition-colors"
          >
            Token
          </Link>

          <div className="flex gap-7 text-white items-center ml-2">
            <a
              href={siteConfig.links.twitter}
              target="_blank"
              className="hover:text-[#5100fd] transition-colors"
            >
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href={siteConfig.links.telegram}
              target="_blank"
              className="hover:text-[#5100fd] transition-colors"
            >
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.35-.49.96-.75 3.78-1.65 6.31-2.74 7.58-3.27 3.61-1.51 4.35-1.77 4.84-1.78.11 0 .35.03.5.16.12.1.16.23.18.33.02.11.02.24.01.37z" />
              </svg>
            </a>
          </div>

          <div className="h-4 w-[1px] bg-white/20 mx-2" />

          <div className="flex items-center gap-4 relative z-[110]">
            <div className="[&_.wallet-adapter-button]:!bg-white [&_.wallet-adapter-button]:!text-black [&_.wallet-adapter-button]:!rounded-full [&_.wallet-adapter-button]:!px-5 [&_.wallet-adapter-button]:!h-10 [&_.wallet-adapter-button]:!text-[15px] [&_.wallet-adapter-button]:!font-bold [&_.wallet-adapter-button]:hover:!bg-zinc-200 [&_.wallet-adapter-button]:!transition-all [&_.wallet-adapter-button]:hover:!scale-105 [&_.wallet-adapter-button]:active:!scale-95 relative z-[120]">
              {isClient && <WalletMultiButton />}
            </div>

            <Button
              className="rounded-full bg-[#5100fd] hover:bg-[#6610ff] text-white px-5 h-10 text-[15px] font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#5100fd]/20 relative z-[120]"
              onClick={handleLaunchTerminal}
            >
              Launch Terminal
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className="flex md:hidden items-center">
          <MobileMenu />
        </div>
      </div>
    </nav>
  );
}
