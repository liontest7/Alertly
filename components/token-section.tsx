import { siteConfig } from "@/lib/config";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export function TokenSection() {
  return (
    <section
      id="token-section"
      className="relative z-20 py-32 bg-black/10 backdrop-blur-sm"
    >
      <div className="container mx-auto px-6 lg:px-12">
        <div className="max-w-4xl mx-auto rounded-3xl border border-zinc-900 bg-black/80 backdrop-blur-xl p-12 text-center text-white relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#5100fd]/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />

          <div className="flex justify-center mb-8">
            <Image
              src="/images/logo.png"
              alt="Alertly Logo"
              width={80}
              height={80}
              className="rounded-2xl shadow-2xl border border-white/10"
            />
          </div>

          <h2 className="text-4xl font-light mb-6">
            Hold ${siteConfig.token.symbol}, Trade Better.
          </h2>
          <p className="text-white mb-8 max-w-xl mx-auto text-lg">
            Unlock premium features including 50% lower trading fees, priority
            alerts, and advanced automation.
          </p>

          <div className="mb-12 font-mono text-sm bg-zinc-900/50 py-3 px-6 rounded-full border border-zinc-800 inline-block text-white shadow-inner">
            CA:{" "}
            <span className="text-[#5100fd] font-bold select-all">
              {siteConfig.token.address}
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-8 justify-center items-center mb-12">
            <div className="p-6 rounded-2xl bg-zinc-900/50 w-full md:w-64 border border-white/5">
              <p className="text-white/60 text-sm mb-2">Free Tier</p>
              <p className="text-3xl font-light mb-2 text-white">1.2%</p>
              <p className="text-xs text-white/40 font-mono">
                Standard access
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-[#5100fd]/10 border border-[#5100fd]/30 w-full md:w-72 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#5100fd] text-[10px] px-3 py-1 rounded-bl-lg font-bold">
                PREMIUM
              </div>
              <p className="text-white/60 text-sm mb-2">Premium Tier</p>
              <p className="text-4xl font-light text-[#5100fd] mb-2">0.6%</p>
              <p className="text-xs text-white/80 font-mono">
                Hold {siteConfig.fees.premiumThreshold.toLocaleString()} $
                {siteConfig.token.symbol}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            <Button
              onClick={() =>
                (window.location.href = `https://jup.ag/swap/SOL-${siteConfig.token.symbol}`)
              }
              className="bg-white text-black hover:bg-zinc-200 rounded-full px-8 py-6 font-bold text-lg"
            >
              Buy ${siteConfig.token.symbol} Token
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                (window.location.href = `https://raydium.io/swap/?inputMint=sol&outputMint=${siteConfig.token.address}`)
              }
              className="border-zinc-800 bg-[#5100fd] text-white hover:bg-[#6610ff] rounded-full px-8 py-6 font-bold text-lg"
            >
              Trade on Raydium
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                (window.location.href = `https://dexscreener.com/solana/${siteConfig.token.address}`)
              }
              className="border-zinc-800 hover:bg-zinc-900 rounded-full px-8 py-6 text-white text-lg"
            >
              View on DexScanner
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
