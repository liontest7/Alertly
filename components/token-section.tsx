import { siteConfig } from "@/lib/config";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export function TokenSection() {
  const hasTokenAddress = Boolean(siteConfig.token.address);

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
            Get unlimited real-time Solana alerts, automated sniping, and copy
            trading — all synced across dashboard, Telegram bot, and browser
            extension.
          </p>

          <div className="mb-12 font-mono text-sm bg-zinc-900/50 py-3 px-6 rounded-full border border-zinc-800 inline-block text-white shadow-inner">
            CA:{" "}
            <span className="text-[#5100fd] font-bold select-all">
              {hasTokenAddress ? siteConfig.token.address : "Token address will be published at launch"}
            </span>
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
              disabled={!hasTokenAddress}
              onClick={() =>
                (window.location.href = `https://raydium.io/swap/?inputMint=sol&outputMint=${siteConfig.token.address}`)
              }
              className="border-zinc-800 bg-[#5100fd] text-white hover:bg-[#6610ff] rounded-full px-8 py-6 font-bold text-lg disabled:opacity-50"
            >
              Trade on Raydium
            </Button>
            <Button
              variant="outline"
              disabled={!hasTokenAddress}
              onClick={() =>
                (window.location.href = `https://dexscreener.com/solana/${siteConfig.token.address}`)
              }
              className="border-zinc-800 hover:bg-zinc-900 rounded-full px-8 py-6 text-white text-lg disabled:opacity-50"
            >
              View on DexScreener
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
