"use client";

import { siteConfig } from "@/lib/config";
import Image from "next/image";

const platforms = (tokenAddress: string) => [
  {
    name: "Pump.fun",
    logo: "https://pump.fun/favicon.ico",
    href: tokenAddress ? `https://pump.fun/coin/${tokenAddress}` : "https://pump.fun",
  },
  {
    name: "DexScreener",
    logo: "https://dexscreener.com/favicon.ico",
    href: tokenAddress ? `https://dexscreener.com/solana/${tokenAddress}` : "https://dexscreener.com",
  },
  {
    name: "Raydium",
    logo: "https://raydium.io/favicon.ico",
    href: tokenAddress
      ? `https://raydium.io/swap/?inputMint=sol&outputMint=${tokenAddress}`
      : "https://raydium.io",
  },
  {
    name: "Jupiter",
    logo: "https://jup.ag/favicon.ico",
    href: tokenAddress ? `https://jup.ag/swap/SOL-${tokenAddress}` : "https://jup.ag",
  },
];

export function TokenSection() {
  const tokenAddress = siteConfig.token.address;

  return (
    <section
      id="token-section"
      className="relative pt-8 pb-24"
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
              {tokenAddress || "Token address will be published at launch"}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {platforms(tokenAddress).map((p) => (
              <a
                key={p.name}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-3 p-5 rounded-2xl border border-[#5100fd]/30 bg-[#5100fd]/10 hover:bg-[#5100fd]/20 hover:border-[#5100fd]/60 transition-all duration-200 cursor-pointer"
              >
                <img
                  src={p.logo}
                  alt={p.name}
                  width={28}
                  height={28}
                  className="rounded-md"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                <span className="text-sm font-semibold text-white/90">{p.name}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
