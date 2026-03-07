export const siteConfig = {
  name: "Alertly",
  description: "Real-time Solana trading intelligence and automation. Snipe, trade, and track with millisecond precision.",
  url: "https://alertly.ai",
  ogImage: "/images/logo.png",
  links: {
    twitter: "https://x.com/alertly",
    telegram: "https://t.me/alertly_bot",
    docs: "https://docs.alertly.ai",
    discord: "https://discord.gg/alertly",
  },
  token: {
    symbol: "ALERTLY",
    name: "Alertly",
    address: "7xKXvS...AlertlyCA", // Update with real CA when available
    network: "Solana",
  },
  fees: {
    free: "1.2%",
    premium: "0.6%",
    premiumThreshold: 50000,
  },
  socials: {
    twitter: "https://x.com/alertly",
    telegram: "https://t.me/alertly_bot",
    discord: "https://discord.gg/alertly",
  },
  features: {
    liveAlerts: true,
    autoTrading: true,
    copyTrading: true,
    tokenGated: true,
  }
};

export type SiteConfig = typeof siteConfig;
