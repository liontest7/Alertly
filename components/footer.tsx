"use client";

import { siteConfig } from "@/lib/config";
import Image from "next/image";
import { useAuthSession } from "@/components/providers";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const { user } = useAuthSession();
  const isAdmin = user?.isAdmin === true;
  const pathname = usePathname();

  if (pathname === "/admin") return null;

  return (
    <footer className="relative z-20 py-12 border-t border-zinc-900 bg-black w-full">
      <div className="container mx-auto px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
              <Image
                src="/images/logo.png"
                alt={siteConfig.name}
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">
              {siteConfig.name}
            </span>
          </Link>
        </div>
        <div className="flex flex-wrap justify-center gap-6 md:gap-10 text-white/70 text-sm items-center">
          {isAdmin && (
            <Link href="/admin" className="text-[#5100fd] hover:text-[#5100fd]/80 transition-colors font-medium">
              Admin Panel
            </Link>
          )}
          <a href="#" className="hover:text-white transition-colors">
            Privacy
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Terms
          </a>
          <a
            href={siteConfig.links.docs}
            className="hover:text-white transition-colors"
          >
            Docs
          </a>
          <div className="flex gap-4 ml-2">
            <a
              href={siteConfig.links.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href={siteConfig.links.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.35-.49.96-.75 3.78-1.65 6.31-2.74 7.58-3.27 3.61-1.51 4.35-1.77 4.84-1.78.11 0 .35.03.5.16.12.1.16.23.18.33.02.11.02.24.01.37z" />
              </svg>
            </a>
          </div>
        </div>
        <p className="text-white/40 text-xs">
          © 2026 {siteConfig.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
