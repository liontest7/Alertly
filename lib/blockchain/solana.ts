import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { getEnv, requireEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { decryptKey } from "@/lib/blockchain/keys";

const RPC_ENDPOINT =
  getEnv("SOLANA_RPC_URL") ||
  getEnv("NEXT_PUBLIC_SOLANA_RPC_URL") ||
  requireEnv("SOLANA_RPC_URL", {
    allowInDev: true,
    devFallback: "https://api.mainnet-beta.solana.com",
  });

const JUPITER_API_URL = getEnv("JUPITER_API_URL", "https://lite-api.jup.ag/swap/v1");
const connection = new Connection(RPC_ENDPOINT, "confirmed");
const SOL_MINT = "So11111111111111111111111111111111111111112";

export interface TokenAlert {
  name: string;
  type:
    | "EARLY TOKEN PAIR"
    | "LIQUIDITY ADDED"
    | "LIQUIDITY REMOVAL"
    | "VOLUME SPIKE"
    | "WHALE BUY"
    | "DEX BOOST"
    | "DEX LISTING"
    | "SMART MONEY ENTRY";
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
}

export interface AlertFilterSettings {
  minMarketCap?: number;
  maxMarketCap?: number;
  minLiquidity?: number;
  minHolders?: number;
  volumeSpikeEnabled?: boolean;
  whaleAlertEnabled?: boolean;
  dexBoostEnabled?: boolean;
  dexListingEnabled?: boolean;
}

const TYPE_TO_LABEL: Record<string, TokenAlert["type"]> = {
  EARLY_TOKEN_PAIR: "EARLY TOKEN PAIR",
  LIQUIDITY_ADDED: "LIQUIDITY ADDED",
  LIQUIDITY_REMOVAL: "LIQUIDITY REMOVAL",
  VOLUME_SPIKE: "VOLUME SPIKE",
  WHALE_BUY: "WHALE BUY",
  DEX_BOOST: "DEX BOOST",
  DEX_LISTING: "DEX LISTING",
  SMART_MONEY_ENTRY: "SMART MONEY ENTRY",
};

function parseMoneyValue(input?: string | null): number | null {
  if (!input) return null;
  const normalized = input.replace(/[$,\s]/g, "").toUpperCase();
  if (!normalized) return null;

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

function isAlertEnabledBySettings(type: TokenAlert["type"], filters?: AlertFilterSettings): boolean {
  if (!filters) return true;
  if (type === "VOLUME SPIKE" && filters.volumeSpikeEnabled === false) return false;
  if (type === "WHALE BUY" && filters.whaleAlertEnabled === false) return false;
  if (type === "DEX BOOST" && filters.dexBoostEnabled === false) return false;
  if (type === "DEX LISTING" && filters.dexListingEnabled === false) return false;
  return true;
}

function isValidUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function passesNumericFilters(alert: TokenAlert, filters?: AlertFilterSettings): boolean {
  if (!filters) return true;

  const mcValue = parseMoneyValue(alert.mc);
  const liquidityValue = parseMoneyValue(alert.liquidity);

  if (typeof filters.minMarketCap === "number" && mcValue !== null && mcValue < filters.minMarketCap) return false;
  if (typeof filters.maxMarketCap === "number" && mcValue !== null && mcValue > filters.maxMarketCap) return false;
  if (typeof filters.minLiquidity === "number" && liquidityValue !== null && liquidityValue < filters.minLiquidity) return false;
  if (typeof filters.minHolders === "number" && filters.minHolders > 0 && alert.holders > 0 && alert.holders < filters.minHolders) return false;

  return true;
}

function mapPersistedAlert(item: any): TokenAlert {
  const typeLabel = TYPE_TO_LABEL[item.type] || "SMART MONEY ENTRY";
  return {
    name: item.name || "Live Token",
    type: typeLabel,
    mc: item.mc || "Live",
    vol: item.vol || "Live",
    age: getAgeLabel(item.alertedAt),
    change: item.change || "0%",
    trend: (item.trend as TokenAlert["trend"]) || "neutral",
    address: item.address,
    holders: item.holders || 0,
    liquidity: item.liquidity || "Live",
    imageUrl: isValidUrl(item.imageUrl) ? item.imageUrl : undefined,
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
  };
}

export async function getLiveAlerts(filters?: AlertFilterSettings): Promise<TokenAlert[]> {
  try {
    const rows = await prisma.alertEvent.findMany({
      orderBy: { alertedAt: "desc" },
      take: 200,
    });

    const mapped = rows.map(mapPersistedAlert);

    const filtered = mapped
      .filter((alert) => isAlertEnabledBySettings(alert.type, filters))
      .filter((alert) => passesNumericFilters(alert, filters));

    const deduped = new Map<string, TokenAlert>();
    for (const alert of filtered) {
      const key = `${alert.address}:${alert.type}`;
      if (!deduped.has(key)) deduped.set(key, alert);
    }

    return Array.from(deduped.values()).slice(0, 100);
  } catch (error) {
    console.error("Failed to read live blockchain alerts:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function getWalletBalance(address: string) {
  try {
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

async function getUserTradingKeypair(userId: string) {
  const wallet = await prisma.tradingWallet.findUnique({ where: { userId } });
  if (!wallet) {
    throw new Error("Trading wallet is not configured");
  }

  const decrypted = decryptKey(wallet.encryptedPrivateKey);
  if (!decrypted) {
    throw new Error("Trading wallet decryption failed");
  }

  const secret = Buffer.from(decrypted, "hex");
  if (secret.length !== 64) {
    throw new Error("Trading wallet private key format is invalid");
  }

  return Keypair.fromSecretKey(new Uint8Array(secret));
}

async function getTokenDecimals(mintAddress: string) {
  const mint = new PublicKey(mintAddress);
  const info = await connection.getParsedAccountInfo(mint);
  const decimals = (info.value?.data as any)?.parsed?.info?.decimals;
  if (typeof decimals !== "number") {
    throw new Error("Failed to resolve token decimals");
  }
  return decimals;
}

export async function executeTrade(params: {
  userId: string;
  action: "buy" | "sell";
  tokenAddress: string;
  amount: number;
  slippage: number;
}) {
  try {
    const keypair = await getUserTradingKeypair(params.userId);

    const inputMint = params.action === "buy" ? SOL_MINT : params.tokenAddress;
    const outputMint = params.action === "buy" ? params.tokenAddress : SOL_MINT;

    let atomicAmount: number;
    if (params.action === "buy") {
      atomicAmount = Math.floor(params.amount * LAMPORTS_PER_SOL);
    } else {
      const decimals = await getTokenDecimals(params.tokenAddress);
      atomicAmount = Math.floor(params.amount * 10 ** decimals);
    }

    if (!Number.isFinite(atomicAmount) || atomicAmount <= 0) {
      return { success: false, message: "Invalid trade amount after conversion" };
    }

    const quoteResponse = await fetch(
      `${JUPITER_API_URL}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${atomicAmount}&slippageBps=${Math.round(params.slippage * 100)}`,
    );

    if (!quoteResponse.ok) {
      return {
        success: false,
        message: `Quote request failed: ${quoteResponse.status}`,
      };
    }

    const quoteData = await quoteResponse.json();
    if (!quoteData?.outAmount) {
      return { success: false, message: "No route available for this trade" };
    }

    const swapResponse = await fetch(`${JUPITER_API_URL}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: keypair.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
      }),
    });

    if (!swapResponse.ok) {
      return {
        success: false,
        message: `Swap request failed: ${swapResponse.status}`,
      };
    }

    const swapData = await swapResponse.json();
    const serializedSwap = swapData?.swapTransaction;
    if (!serializedSwap) {
      return { success: false, message: "Jupiter did not return a transaction" };
    }

    const transaction = VersionedTransaction.deserialize(Buffer.from(serializedSwap, "base64"));
    transaction.sign([keypair]);

    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
    const txSig = await connection.sendTransaction(transaction, {
      maxRetries: 3,
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    await connection.confirmTransaction(
      {
        signature: txSig,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      "confirmed",
    );

    return {
      success: true,
      txSig,
      message: `Successfully executed ${params.action} via Jupiter`,
      quote: quoteData,
    };
  } catch (error) {
    console.error("Jupiter trade failed:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Jupiter execution failed",
    };
  }
}
