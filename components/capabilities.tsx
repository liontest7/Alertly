import { Button } from "@/components/ui/button";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { ArrowRight, Zap, MessageSquare } from "lucide-react";
import Image from "next/image";

export function Capabilities() {
  return (
    <section
      id="capabilities"
      className="relative z-20 py-32 bg-black/10 backdrop-blur-sm"
    >
      <div className="container mx-auto px-6 lg:px-12">
        <div className="max-w-3xl mb-16">
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-light mb-8 text-balance text-white">
            One System. Every Alert Surface.
          </h2>
          <p className="text-xl md:text-2xl text-white/90 leading-relaxed max-w-2xl">
            Run Alertly from web, Telegram, and extension with synced preferences,
            consistent filters, and launch-ready real-time monitoring.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-white">
          <div className="relative rounded-2xl border border-zinc-900 p-3 group hover:border-[#5100fd]/50 transition-colors">
            <GlowingEffect
              blur={0}
              borderWidth={1}
              spread={80}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
            />
            <div className="relative bg-zinc-950/80 backdrop-blur-xl rounded-xl p-8 h-full flex flex-col border border-white/5">
              <h3 className="text-2xl font-light mb-4 text-white">
                Live Market Alerts
              </h3>
              <p className="text-white/70 leading-relaxed mb-8">
                Track DEX boosts, high-velocity volume spikes, and fresh trading
                momentum in near real time with configurable risk filters.
              </p>
              <div className="mt-auto">
                <Button
                  variant="link"
                  className="text-[#5100fd] hover:text-[#6610ff] p-0 h-auto group/btn font-bold"
                >
                  Configure alerts{" "}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                </Button>
              </div>
            </div>
          </div>

          <div className="relative rounded-2xl border border-zinc-900 p-3 group hover:border-[#5100fd]/50 transition-colors overflow-hidden h-auto md:h-[400px]">
            <GlowingEffect
              blur={0}
              borderWidth={1}
              spread={80}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
            />
            <div className="relative bg-zinc-950/80 backdrop-blur-xl rounded-xl h-full flex flex-col md:flex-row border border-white/5 overflow-hidden">
              <div className="flex-1 p-6 md:p-10 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-[#5100fd]/20 flex items-center justify-center border border-[#5100fd]/30">
                    <Zap className="text-[#5100fd] w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-[#5100fd] uppercase tracking-[0.2em]">
                    Real-Time Engine
                  </span>
                </div>
                <h3 className="text-3xl md:text-4xl font-light mb-4 text-white leading-tight">
                  Telegram Integration
                </h3>
                <p className="text-white/80 leading-relaxed mb-8 text-base md:text-lg">
                  Receive and manage alerts from your phone with synced settings,
                  fast actions, and the same logic used by the web dashboard.
                </p>
                <div className="mt-auto">
                  <Button
                    onClick={() => window.open(siteConfig.links.telegram, "_blank")}
                    className="w-full md:w-auto bg-white text-black hover:bg-zinc-200 rounded-full px-10 py-6 font-bold text-lg shadow-2xl"
                  >
                    Open Telegram Bot
                  </Button>
                </div>
              </div>
              <div className="flex-1 relative min-h-[200px] md:min-h-full bg-zinc-900/50">
                <Image
                  src="/images/image_1772699359538.png"
                  alt="Telegram Integration"
                  fill
                  className="object-cover object-center opacity-80"
                  priority
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-2 relative rounded-2xl border border-zinc-900 p-3 group hover:border-[#5100fd]/50 transition-colors overflow-hidden h-auto md:min-h-[400px]">
            <GlowingEffect
              blur={0}
              borderWidth={1}
              spread={80}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
            />
            <div className="relative bg-zinc-950/80 backdrop-blur-xl rounded-xl h-full flex flex-col md:flex-row border border-white/5 overflow-hidden">
              <div className="flex-1 relative min-h-[200px] md:min-h-full order-2 md:order-1 bg-zinc-900/50">
                <Image
                  src="/images/image_1772699380315.png"
                  alt="Telegram Bot"
                  fill
                  className="object-cover object-center opacity-80"
                  priority
                />
              </div>
              <div className="flex-1 p-6 md:p-10 flex flex-col justify-center order-1 md:order-2">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-[10px] font-bold text-[#5100fd] uppercase tracking-[0.2em]">
                    Official Bot
                  </span>
                  <div className="w-10 h-10 rounded-full bg-[#5100fd]/20 flex items-center justify-center border border-[#5100fd]/30">
                    <MessageSquare className="text-[#5100fd] w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-3xl md:text-4xl font-light mb-4 text-white leading-tight">
                  Unified Telegram Command Center
                </h3>
                <p className="text-white/80 leading-relaxed mb-8 text-base md:text-lg">
                  Link once and keep your profile synced across products. Your
                  Telegram controls update the same settings used by web and extension.
                </p>
                <div className="mt-auto">
                  <Button className="w-full md:w-auto bg-[#5100fd] hover:bg-[#6610ff] text-white rounded-full px-10 py-6 font-bold text-lg shadow-2xl shadow-[#5100fd]/30">
                    Launch Bot
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="relative rounded-2xl border border-zinc-900 p-3 group hover:border-[#5100fd]/50 transition-colors">
            <GlowingEffect
              blur={0}
              borderWidth={1}
              spread={80}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
            />
            <div className="relative bg-zinc-950/80 backdrop-blur-xl rounded-xl p-8 h-full flex flex-col border border-white/5">
              <h3 className="text-2xl font-light mb-4 text-white">
                Wallet Tracking
              </h3>
              <p className="text-white/70 leading-relaxed mb-8">
                Follow whales and smart-money wallets to detect conviction entries
                before broader market attention arrives.
              </p>
              <div className="mt-auto">
                <Button
                  variant="link"
                  className="text-[#5100fd] hover:text-[#6610ff] p-0 h-auto group/btn font-bold"
                >
                  Start tracking{" "}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                </Button>
              </div>
            </div>
          </div>

          <div className="relative rounded-2xl border border-zinc-900 p-3 group hover:border-[#5100fd]/50 transition-colors">
            <GlowingEffect
              blur={0}
              borderWidth={1}
              spread={80}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
            />
            <div className="relative bg-zinc-950/80 backdrop-blur-xl rounded-xl p-8 h-full border border-white/5">
              <h3 className="text-2xl font-light mb-4 text-white">
                Copy Trading
              </h3>
              <p className="text-white/70 leading-relaxed mb-8">
                Mirror selected traders with your own allocation controls,
                risk limits, and account-level safety configuration.
              </p>
              <Button
                variant="link"
                className="text-[#5100fd] hover:text-[#6610ff] p-0 h-auto group/btn font-bold"
              >
                Start copying{" "}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
