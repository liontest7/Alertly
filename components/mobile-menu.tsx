"use client"

import { Menu, X, Twitter, Send, ExternalLink } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthSession } from "@/components/providers"
import { siteConfig } from "@/lib/config"
import { Button } from "./ui/button"

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const { user, loading } = useAuthSession()

  return (
    <>
      <button 
        className="p-2 text-white hover:text-zinc-300 transition-colors z-[120] relative" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black z-[115] flex flex-col p-8 pt-24 animate-in fade-in slide-in-from-top duration-300">
          <nav className="flex flex-col gap-8">
            <a 
              href="#capabilities" 
              className="text-3xl font-light text-white"
              onClick={() => setIsOpen(false)}
            >
              Features
            </a>
            <a 
              href="#" 
              className="text-3xl font-light text-white"
              onClick={() => setIsOpen(false)}
            >
              Pricing
            </a>
            <div className="h-[1px] bg-zinc-900 w-full my-4" />
            <div className="flex flex-col gap-6">
              <a 
                href={siteConfig.links.twitter} 
                target="_blank" 
                className="flex items-center gap-3 text-zinc-400 hover:text-white transition-colors"
              >
                <Twitter className="w-5 h-5" /> Twitter
              </a>
              <a 
                href={siteConfig.links.telegram} 
                target="_blank" 
                className="flex items-center gap-3 text-zinc-400 hover:text-white transition-colors"
              >
                <Send className="w-5 h-5" /> Telegram
              </a>
              <a 
                href={siteConfig.links.docs} 
                target="_blank" 
                className="flex items-center gap-3 text-zinc-400 hover:text-white transition-colors"
              >
                <ExternalLink className="w-5 h-5" /> Documentation
              </a>
            </div>
            
            <Button 
              className="w-full mt-8 rounded-full bg-[#5100fd] hover:bg-[#6610ff] py-8 text-lg"
              onClick={() => {
                setIsOpen(false);
                if (!user && !loading) {
                  router.push("/connect-wallet?callbackUrl=/dashboard");
                  return;
                }
                router.push("/dashboard");
              }}
            >
              Launch Terminal
            </Button>
          </nav>
          
          <div className="mt-auto text-center">
            <p className="text-zinc-600 text-sm">© 2026 {siteConfig.name}</p>
          </div>
        </div>
      )}
    </>
  )
}
