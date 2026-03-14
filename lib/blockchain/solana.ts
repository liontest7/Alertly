import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getEnv, requireEnv } from "@/lib/env";

import { getAlerts, StoredAlert } from "@/lib/alert-store";

const RPC_PRIMARY =
  getEnv("SOLANA_RPC_URL") ||
  getEnv("NEXT_PUBLIC_SOLANA_RPC_URL") ||
  requireEnv("SOLANA_RPC_URL", {
    allowInDev: true,
    devFallback: "https://api.mainnet-beta.solana.com",
  });

const RPC_FALLBACK =
  getEnv("SOLANA_RPC_FALLBACK_URL") ||
  getEnv("NEXT_PUBLIC_SOLANA_RPC_FALLBACK_URL") ||
  "https://api.mainnet-beta.solana.com";

const connection = new Connection(RPC_PRIMARY, "confirmed");
const fallbackConnection = RPC_FALLBACK !== RPC_PRIMARY ? new Connection(RPC_FALLBACK, "confirmed") : null;
const SOL_MINT = "So11111111111111111111111111111111111111112";

async function withRpcFallback<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
  try {
    return await fn(connection);
  } catch (primaryErr) {
    if (!fallbackConnection) throw primaryErr;
    console.warn("[RPC] Primary failed, trying fallback:", primaryErr instanceof Error ? primaryErr.message : String(primaryErr));
    return await fn(fallbackConnection);
  }
}

export type TokenAlertType =
  | "DEX BOOST"
  | "DEX LISTING";

export interface TokenAlert {
  name: string;
  type: TokenAlertType;
  mc: string;
  vol: string;
  age: string;
  change: string;
  trend: "up" | "down" | "neutral";
  address: string;
  holders: number;
  liquidity: string;
  imageUrl?: string;
  symbol?: string;
  dexUrl?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  pairAddress?: string;
  priceUsd?: string;
  alertedAt?: string;
  fingerprint?: string;
  riskScore?: number;
  riskLevel?: string;
  buyAmountSol?: number;
  boostAmount?: number;
  dex?: string;
  wallet?: string;
  walletBalance?: number;
  spikePercent?: number;
}

export interface AlertFilterSettings {
  minMarketCap?: number;
  maxMarketCap?: number;
  minLiquidity?: number;
  minHolders?: number;
  dexBoostEnabled?: boolean;
  dexListingEnabled?: boolean;
  selectedBoostLevel?: string;
}

const TYPE_TO_LABEL: Record<string, TokenAlertType> = {
  DEX_BOOST: "DEX BOOST",
  DEX_LISTING: "DEX LISTING",
};

function parseMoneyValue(input?: string | null): number | null {
  if (!input) return null;
  const normalized = input.replace(/[$,\s]/g, "").toUpperCase();
  if (!normalized || normalized === "N/A") return null;

  const suffix = normalized.slice(-1);
  const base = Number(suffix.match(/[KMB]/) ? normalized.slice(0, -1) : normalized);
  if (!Number.isFinite(base)) return null;

  if (suffix === "K") return base * 1_000;
  if (suffix === "M") return base * 1_000_000;
  if (suffix === "B") return base * 1_000_000_000;
  return base;
}

function getAgeLabel(alertedAt: Date): string {
  const diffMs = Date.now() - alertedAt.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function isAlertEnabledBySettings(alert: TokenAlert, filters?: AlertFilterSettings): boolean {
  if (!filters) return true;
  if (alert.type === "DEX BOOST" && filters.dexBoostEnabled === false) return false;
  if (alert.type === "DEX LISTING" && filters.dexListingEnabled === false) return false;

  if (
    typeof filters.selectedBoostLevel === "string" &&
    filters.selectedBoostLevel !== "all" &&
    alert.type === "DEX BOOST"
  ) {
    const alertLevel = (alert as any).boostLevel as string | undefined;
    if (alertLevel && alertLevel !== filters.selectedBoostLevel) return false;
  }

  return true;
}

function passesNumericFilters(alert: TokenAlert, filters?: AlertFilterSettings): boolean {
  if (!filters) return true;

  const mcValue = parseMoneyValue(alert.mc);
  const liquidityValue = parseMoneyValue(alert.liquidity);

  if (typeof filters.minMarketCap === "number" && filters.minMarketCap > 0 && mcValue !== null && mcValue < filters.minMarketCap) return false;
  if (typeof filters.maxMarketCap === "number" && filters.maxMarketCap > 0 && mcValue !== null && mcValue > filters.maxMarketCap) return false;
  if (typeof filters.minLiquidity === "number" && filters.minLiquidity > 0 && liquidityValue !== null && liquidityValue < filters.minLiquidity) return false;
  if (typeof filters.minHolders === "number" && filters.minHolders > 0 && alert.holders > 0 && alert.holders < filters.minHolders) return false;

  return true;
}

function mapStoredAlert(item: StoredAlert): TokenAlert | null {
  const typeLabel = TYPE_TO_LABEL[item.type];
  if (!typeLabel) return null;
  return {
    name: item.name,
    type: typeLabel,
    mc: item.mc || "N/A",
    vol: item.vol || "N/A",
    age: getAgeLabel(item.alertedAt),
    change: item.change || "0%",
    trend: (item.trend === "up" ? "up" : item.trend === "down" ? "down" : "neutral") as "up" | "down" | "neutral",
    address: item.address,
    holders: item.holders || 0,
    liquidity: item.liquidity || "N/A",
    imageUrl: item.imageUrl || undefined,
    symbol: item.symbol || undefined,
    dexUrl: item.dexUrl || undefined,
    website: item.website || undefined,
    twitter: item.twitter || undefined,
    telegram: item.telegram || undefined,
    pairAddress: item.pairAddress || undefined,
    priceUsd: item.priceUsd || undefined,
    alertedAt: item.alertedAt.toISOString(),
    fingerprint: item.fingerprint,
    riskScore: item.riskScore,
    riskLevel: item.riskLevel,
    wallet: item.wallet,
    walletBalance: item.walletBalance,
    buyAmountSol: item.buyAmountSol,
    boostAmount: item.boostAmount,
    dex: item.dex,
    spikePercent: item.spikePercent,
  };
}

export async function getLiveAlerts(filters?: AlertFilterSettings): Promise<TokenAlert[]> {
  try {
    const stored = getAlerts();
    const mapped = stored.map(mapStoredAlert).filter((a): a is TokenAlert => a !== null);

    const filtered = mapped
      .filter((alert) => isAlertEnabledBySettings(alert, filters))
      .filter((alert) => passesNumericFilters(alert, filters));

    const deduped = new Map<string, TokenAlert>();
    for (const alert of filtered) {
      const key = `${alert.address}:${alert.type}`;
      if (!deduped.has(key)) deduped.set(key, alert);
    }

    return Array.from(deduped.values()).slice(0, 100);
  } catch (error) {
    console.error("Failed to read live alerts:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function getWalletBalance(address: string) {
  try {
    const publicKey = new PublicKey(address);
    const balance = await withRpcFallback((conn) => conn.getBalance(publicKey));
    return balance / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

