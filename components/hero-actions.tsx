"use client";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";
import { CircleArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "./ui/use-toast";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

interface HeroActionsProps {
  loading: boolean;
  user: any;
}

export function HeroActions({ loading, user }: HeroActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { setVisible } = useWalletModal();

  const handleGetAlerts = () => {
    if (loading) return;
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please connect your wallet and sign the message to access the terminal.",
        variant: "destructive",
        duration: 5000,
      });
      setVisible(true);
    } else {
      // Small delay to ensure state is synchronized
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 100);
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
        onClick={handleGetAlerts}
      >
        Get Alerts Now
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
