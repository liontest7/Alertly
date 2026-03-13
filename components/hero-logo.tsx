"use client";

import { useEffect, useState } from "react";

interface HeroLogoProps {
  progress: number;
  scale: number;
}

export function HeroLogo({ progress, scale }: HeroLogoProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const rotationValue = -(progress * 360); // Counter-clockwise rotation based on scroll

  const opacity = mounted ? 1 : 0;

  return (
    <div
      className="fixed inset-0 w-screen h-screen pointer-events-none z-0 flex items-center justify-center lg:justify-end lg:pr-[10%] transition-opacity duration-300"
      style={{ opacity, display: mounted ? 'flex' : 'none' }}
    >
      <div
        className="relative w-[300px] h-[300px] md:w-[450px] md:h-[450px] lg:w-[600px] lg:h-[600px] pointer-events-none"
        style={{
          transform: `rotate(${rotationValue}deg) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <img
          src="/images/logo.png"
          alt="Alertly Hero Logo"
          className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(81,0,253,0.3)]"
          loading="eager"
          fetchPriority="high"
        />
      </div>
    </div>
  );
}
