const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.ALERTLY_API_BASE_URL ||
  "http://localhost:10000";

const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_ALERTLY_TOKEN_ADDRESS || "";
const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "Alertly_Solbot";
const TELEGRAM_URL = `https://t.me/${TELEGRAM_BOT_USERNAME}`;

export const siteConfig = {
  name: "Alertly",
  description: "Real-time Solana trading intelligence and automation. Snipe, trade, and track with millisecond precision.",
  url: APP_BASE_URL,
  ogImage: "/images/logo.png",
  links: {
    twitter: "https://x.com/alertly",
    telegram: TELEGRAM_URL,
    docs: `${APP_BASE_URL}/docs`,
    discord: "",
  },
  token: {
    symbol: "ALERTLY",
    name: "Alertly",
    address: TOKEN_ADDRESS,
    network: "Solana",
  },
  fees: {
    free: "1.2%",
    premium: "0.6%",
    premiumThreshold: 50000,
  },
  socials: {
    twitter: "https://x.com/alertly",
    telegram: TELEGRAM_URL,
    discord: "",
  },
  features: {
    liveAlerts: true,
    autoTrading: true,
    copyTrading: true,
    tokenGated: true,
  },
};

export type SiteConfig = typeof siteConfig;
