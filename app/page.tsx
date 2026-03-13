"use client";

import { HeroLogo } from "@/components/hero-logo";
import { HeroActions } from "@/components/hero-actions";
import { HeroStats } from "@/components/hero-stats";
import { Capabilities } from "@/components/capabilities";
import { TokenSection } from "@/components/token-section";
import { useEffect, useState } from "react";
import { useAuthSession } from "@/components/providers";

const STAY_WORDS = ["Sharp.", "Early.", "Alertly."];

export default function Home() {
  const { user, loading } = useAuthSession();
  const [scrollProgress, setScrollProgress] = useState(0);

  const [wordIdx, setWordIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const word = STAY_WORDS[wordIdx];
    let timer: NodeJS.Timeout;
    if (!deleting && typed.length < word.length) {
      timer = setTimeout(() => setTyped(word.slice(0, typed.length + 1)), 110);
    } else if (!deleting && typed.length === word.length) {
      timer = setTimeout(() => setDeleting(true), 1800);
    } else if (deleting && typed.length > 0) {
      timer = setTimeout(() => setTyped(typed.slice(0, -1)), 65);
    } else if (deleting && typed.length === 0) {
      setDeleting(false);
      setWordIdx((i) => (i + 1) % STAY_WORDS.length);
    }
    return () => clearTimeout(timer);
  }, [typed, deleting, wordIdx]);

  useEffect(() => {
    let ticking = false;

    const updateProgress = () => {
      const scrollY = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const nextProgress = scrollHeight > 0 ? scrollY / scrollHeight : 0;
      setScrollProgress((prev) => (Math.abs(prev - nextProgress) > 0.0001 ? nextProgress : prev));
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateProgress);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const linesScale = 1 - scrollProgress * 0.3;

  return (
    <main className="relative min-h-[100dvh] bg-black text-white overflow-x-hidden selection:bg-[#5100fd]/30">
      <HeroLogo progress={scrollProgress} scale={linesScale} />

      <div
        className="fixed inset-0 z-0 w-screen h-screen pointer-events-none transition-all duration-100"
        style={{
          opacity: 0.4,
          transform: `scale(${linesScale})`,
        }}
      >
        <div className="bg-lines-container h-full w-full pointer-events-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="100%"
            height="100%"
            viewBox="0 0 2269 2108"
            fill="none"
            className="w-full h-full opacity-100 pointer-events-none"
            preserveAspectRatio="xMidYMid slice"
          >
            <path
              d="M510.086 0.543457L507.556 840.047C506.058 1337.18 318.091 1803.4 1.875 2094.29"
              stroke="#5100fd"
              strokeWidth="3"
              strokeMiterlimit="10"
              strokeDasharray="120px 99999px"
              className="animate-line-race-1"
            />
            <path
              d="M929.828 0.543457L927.328 829.877C925.809 1334 737.028 1807.4 418.435 2106"
              stroke="#5100fd"
              strokeWidth="3"
              strokeMiterlimit="10"
              strokeDasharray="120px 99999px"
              className="animate-line-race-2"
            />
            <path
              d="M1341.9 0.543457L1344.4 829.876C1345.92 1334 1534.7 1807.4 1853.29 2106"
              stroke="#5100fd"
              strokeWidth="3"
              strokeMiterlimit="10"
              strokeDasharray="120px 99999px"
              className="animate-line-race-3"
            />
            <path
              d="M1758.96 0.543457L1761.49 840.047C1762.99 1337.18 1950.96 1803.4 2267.17 2094.29"
              stroke="#5100fd"
              strokeWidth="3"
              strokeMiterlimit="10"
              strokeDasharray="120px 99999px"
              className="animate-line-race-4"
            />
            <path
              opacity="0.3"
              d="M929.828 0.543457L927.328 829.877C925.809 1334 737.028 1807.4 418.435 2106"
              stroke="white"
              strokeWidth="1.5"
              strokeMiterlimit="10"
            />
            <path
              opacity="0.3"
              d="M510.086 0.543457L507.556 840.047C506.058 1337.18 318.091 1803.4 1.875 2094.29"
              stroke="white"
              strokeWidth="1.5"
              strokeMiterlimit="10"
            />
            <path
              opacity="0.3"
              d="M1758.96 0.543457L1761.49 840.047C1762.99 1337.18 1950.96 1803.4 2267.17 2094.29"
              stroke="white"
              strokeWidth="1.5"
              strokeMiterlimit="10"
            />
            <path
              opacity="0.3"
              d="M1341.9 0.543457L1344.4 829.876C1345.92 1334 1534.7 1807.4 1853.29 2106"
              stroke="white"
              strokeWidth="1.5"
              strokeMiterlimit="10"
            />
          </svg>
        </div>
      </div>

      <div className="relative z-20 container mx-auto px-6 lg:px-12 pt-28 md:pt-36 pb-20 md:pb-28 flex flex-col justify-center">
        <div className="max-w-3xl">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-light mb-12 leading-[1.1] animate-fade-in-up text-white">
            Stay{" "}
            <span className="text-[#5100fd] whitespace-nowrap">
              {typed}
              <span
                className="inline-block align-middle ml-[2px] animate-pulse"
                style={{ width: "3px", height: "0.85em", backgroundColor: "#5100fd", borderRadius: "2px", verticalAlign: "middle" }}
              />
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white mb-14 animate-fade-in-up animation-delay-200 max-w-xl">
            Real-time DEX alerts streamed to your dashboard, Telegram, and browser
            — set your filters once and trade automatically on every signal.
            <span className="block mt-4 text-sm font-medium text-[#5100fd] opacity-90 uppercase tracking-widest">
              Real-Time Alerts • Smart Filters • Auto-Trade • Copy Trading
            </span>
          </p>

          <HeroActions loading={loading} user={user} />
        </div>
      </div>

      <HeroStats />
      <Capabilities />
      <TokenSection />
    </main>
  );
}
