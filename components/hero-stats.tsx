import { siteConfig } from "@/lib/config";

export function HeroStats() {
  return (
    <section className="relative z-20 py-12 border-y border-zinc-900 bg-black/30 backdrop-blur-sm">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-white">
          <div>
            <p className="text-white/80 text-sm mb-1">Free Plan</p>
            <p className="text-2xl font-light">
              Up to 50 alerts/day <span className="text-xs text-white/60">Guest mode</span>
            </p>
          </div>
          <div>
            <p className="text-white/80 text-sm mb-1">VIP Plan</p>
            <p className="text-2xl font-light text-[#5100fd]">
              Unlimited + Auto-Trade
            </p>
          </div>
          <div>
            <p className="text-white/80 text-sm mb-1">Network</p>
            <p className="text-2xl font-light">{siteConfig.token.network}</p>
          </div>
          <div>
            <p className="text-white/80 text-sm mb-1">Token</p>
            <p className="text-2xl font-light">${siteConfig.token.symbol}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
