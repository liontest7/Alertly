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
  type: "DEX_BOOST" | "NEW_LISTING" | "VOL_SPIKE" | "LIQ_ADD";
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

type AlertWithMetrics = TokenAlert & {
  mcValue: number | null;
  liquidityValue: number | null;
  holdersValue: number | null;
};

function toAlertWithMetrics(alert: TokenAlert, metrics: {
  mcValue?: number | null;
  liquidityValue?: number | null;
  holdersValue?: number | null;
}): AlertWithMetrics {
  return {
    ...alert,
    mcValue: typeof metrics.mcValue === "number" ? metrics.mcValue : null,
    liquidityValue: typeof metrics.liquidityValue === "number" ? metrics.liquidityValue : null,
    holdersValue: typeof metrics.holdersValue === "number" ? metrics.holdersValue : null,
  };
}

function isAlertTypeEnabled(type: TokenAlert["type"], filters?: AlertFilterSettings) {
  if (!filters) return true;
  if (type === "VOL_SPIKE" && filters.volumeSpikeEnabled === false) return false;
  if (type === "DEX_BOOST" && filters.dexBoostEnabled === false) return false;
  if (type === "NEW_LISTING" && filters.dexListingEnabled === false) return false;
  if (type === "LIQ_ADD" && filters.whaleAlertEnabled === false) return false;
  return true;
}

function passesNumericFilters(alert: AlertWithMetrics, filters?: AlertFilterSettings) {
  if (!filters) return true;

  if (typeof filters.minMarketCap === "number" && alert.mcValue !== null && alert.mcValue < filters.minMarketCap) {
    return false;
  }

  if (typeof filters.maxMarketCap === "number" && alert.mcValue !== null && alert.mcValue > filters.maxMarketCap) {
    return false;
  }

  if (typeof filters.minLiquidity === "number" && alert.liquidityValue !== null && alert.liquidityValue < filters.minLiquidity) {
    return false;
  }

  if (typeof filters.minHolders === "number" && alert.holdersValue !== null && alert.holdersValue < filters.minHolders) {
    return false;
  }

  return true;
}

function sanitizeAlerts(alerts: AlertWithMetrics[]): TokenAlert[] {
  const deduped = new Map<string, AlertWithMetrics>();

  for (const alert of alerts) {
    if (!alert.address) continue;
    const key = `${alert.address}:${alert.type}`;
    if (!deduped.has(key)) {
      deduped.set(key, alert);
    }
  }

  return Array.from(deduped.values()).map(({ mcValue, liquidityValue, holdersValue, ...rest }) => rest);
}


type PersistedAlertEvent = {
  fingerprint: string;
  address: string;
  type: string;
  name: string;
  change: string;
  trend: string;
  mc: string;
  vol: string;
  liquidity: string;
  holders: number;
  imageUrl: string | null;
  symbol: string | null;
  dexUrl: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  pairAddress: string | null;
  priceUsd: string | null;
  alertedAt: Date;
};

function buildAlertFingerprint(alert: TokenAlert) {
  return [alert.address || "unknown", alert.type || "signal", alert.change || "0"].join("|");
}

function persistedToTokenAlert(item: PersistedAlertEvent): TokenAlert {
  const alertDate = new Date(item.alertedAt);
  const now = new Date();
  const diffMs = now.getTime() - alertDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);
  
  let ageLabel = "Just now";
  if (diffMins > 0) ageLabel = `${diffMins}m ago`;
  if (diffMins > 60) ageLabel = `${Math.floor(diffMins / 60)}h ago`;
  
  return {
    name: item.name,
    type: (item.type as TokenAlert["type"]) || "VOL_SPIKE",
    mc: item.mc,
    vol: item.vol,
    age: ageLabel,
    change: item.change,
    trend: (item.trend as TokenAlert["trend"]) || "neutral",
    address: item.address,
    holders: item.holders,
    liquidity: item.liquidity,
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
  };
}

async function persistAlertSnapshots(alerts: TokenAlert[]): Promise<TokenAlert[]> {
  if (alerts.length === 0) return [];

  const fingerprints = alerts.map((alert) => buildAlertFingerprint(alert));
  const now = new Date().toISOString();

  try {
    const existing = await prisma.alertEvent.findMany({
      where: { fingerprint: { in: fingerprints } },
    });

    const existingSet = new Set(existing.map((item) => item.fingerprint));

    const toCreate = alerts
      .map((alert) => ({ alert, fingerprint: buildAlertFingerprint(alert) }))
      .filter(({ fingerprint }) => !existingSet.has(fingerprint))
      .map(({ alert, fingerprint }) => ({
        fingerprint,
        address: alert.address,
        type: alert.type,
        name: alert.name,
        change: alert.change,
        trend: alert.trend,
        mc: alert.mc,
        vol: alert.vol,
        liquidity: alert.liquidity,
        holders: alert.holders || 0,
        imageUrl: alert.imageUrl || null,
        symbol: alert.symbol || null,
        dexUrl: alert.dexUrl || null,
        website: alert.website || null,
        twitter: alert.twitter || null,
        telegram: alert.telegram || null,
        pairAddress: alert.pairAddress || null,
        priceUsd: alert.priceUsd || null,
        alertedAt: new Date(),
      }));

    if (toCreate.length > 0) {
      await prisma.alertEvent.createMany({ data: toCreate, skipDuplicates: true });
    }

    const persisted = await prisma.alertEvent.findMany({
      where: { fingerprint: { in: fingerprints } },
    });

    const persistedMap = new Map(persisted.map((item) => [item.fingerprint, item]));

    return alerts.map((alert) => {
      const fingerprint = buildAlertFingerprint(alert);
      const item = persistedMap.get(fingerprint);
      if (!item) {
        return {
          ...alert,
          fingerprint,
          alertedAt: now,
        };
      }
      return persistedToTokenAlert(item as PersistedAlertEvent);
    });
  } catch (error) {
    console.error("Failed to persist alert snapshots - returning alerts with current timestamp:", error instanceof Error ? error.message : String(error));
    return alerts.map((alert) => ({
      ...alert,
      fingerprint: buildAlertFingerprint(alert),
      alertedAt: now,
    }));
  }
}


export async function getLiveAlerts(filters?: AlertFilterSettings): Promise<TokenAlert[]> {
  try {
    const requestOptions = { next: { revalidate: 10 } };
    const responses = await Promise.allSettled([
      fetch("https://api.dexscreener.com/token-boosts/top/v1/solana", requestOptions),
      fetch("https://api.dexscreener.com/token-boosts/top/v1", requestOptions),
      fetch("https://api.dexscreener.com/token-boosts/latest/v1", requestOptions),
      fetch("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112", requestOptions),
    ]);

    const extractList = async (result: PromiseSettledResult<Response>) => {
      if (result.status !== "fulfilled" || !result.value.ok) return [] as any[];
      const body = await result.value.json().catch(() => null);
      return Array.isArray(body) ? body : Array.isArray(body?.pairs) ? body.pairs : [];
    };

    const [topByChain, topGlobal, latestBoosts, solPairs] = await Promise.all(responses.map(extractList));

    const boostsRaw = [...topByChain, ...topGlobal, ...latestBoosts]
      .filter(Boolean)
      .filter((item: any) => !item.chainId || String(item.chainId).toLowerCase() === "solana");

    const boostAlerts: AlertWithMetrics[] = boostsRaw.slice(0, 150).map((item: any) => {
      const tokenAddress = String(item.tokenAddress || item.address || item.baseToken?.address || "");
      const fdv = typeof item.fdv === "number" ? item.fdv : null;
      const liquidity = typeof item.liquidity?.usd === "number" ? item.liquidity.usd : null;
      const holders = typeof item.holders === "number" ? item.holders : typeof item.amount === "number" ? item.amount : null;
      const priceChange24h = typeof item.priceChange?.h24 === "number" ? item.priceChange.h24 : 0;
      const symbol = item.baseToken?.symbol || item.symbol || tokenAddress.slice(0, 4) || "SOL";
      const tokenName = item.baseToken?.name || item.name || symbol || "Unknown Token";
      
      // Format market cap
      const mcDisplay = fdv ? fdv >= 1000000 ? `$${(fdv / 1000000).toFixed(1)}M` : `$${(fdv / 1000).toFixed(0)}K` : "N/A";
      // Format liquidity
      const liqDisplay = liquidity ? liquidity >= 1000000 ? `$${(liquidity / 1000000).toFixed(1)}M` : `$${(liquidity / 1000).toFixed(0)}K` : "N/A";

      return toAlertWithMetrics(
        {
          name: tokenName,
          type: "DEX_BOOST",
          mc: mcDisplay,
          vol: item.volume?.h24 ? `$${(item.volume.h24 / 1000).toFixed(0)}K` : "N/A",
          age: "New",
          change: `${priceChange24h > 0 ? "+" : ""}${priceChange24h}%`,
          trend: priceChange24h > 0 ? "up" : priceChange24h < 0 ? "down" : "neutral",
          address: tokenAddress,
          holders: holders ?? 0,
          liquidity: liqDisplay,
          imageUrl: item.baseToken?.logoURI || item.baseToken?.image || item.image || item.icon || "",
          symbol: item.baseToken?.symbol || item.symbol || undefined,
          dexUrl: item.url || undefined,
          website: item?.info?.websites?.[0]?.url || undefined,
          twitter: item?.info?.socials?.find((social: any) => social.type === "twitter")?.url || undefined,
          telegram: item?.info?.socials?.find((social: any) => social.type === "telegram")?.url || undefined,
          pairAddress: item.pairAddress || undefined,
          priceUsd: item.priceUsd ? String(item.priceUsd) : undefined,
        },
        { mcValue: fdv, liquidityValue: liquidity, holdersValue: holders },
      );
    });

    const volumeAlerts: AlertWithMetrics[] = (Array.isArray(solPairs) ? solPairs : []).slice(0, 200).map((pair: any) => {
      const fdv = typeof pair.fdv === "number" ? pair.fdv : null;
      const liquidity = typeof pair.liquidity?.usd === "number" ? pair.liquidity.usd : null;
      const tokenAddress = String(pair?.baseToken?.address || "");
      const pairName = pair?.baseToken?.name || pair?.baseToken?.symbol || tokenAddress.slice(0, 4) || "Unknown";
      const holders = typeof pair.holders === "number" ? pair.holders : typeof pair?.info?.holders === "number" ? pair.info.holders : 0;
      
      // Format market cap
      const mcDisplay = fdv ? fdv >= 1000000 ? `$${(fdv / 1000000).toFixed(1)}M` : `$${(fdv / 1000).toFixed(0)}K` : "N/A";
      // Format liquidity  
      const liqDisplay = liquidity ? liquidity >= 1000000 ? `$${(liquidity / 1000000).toFixed(1)}M` : `$${(liquidity / 1000).toFixed(0)}K` : "N/A";

      return toAlertWithMetrics(
        {
          name: pairName,
          type: "VOL_SPIKE",
          mc: mcDisplay,
          vol: pair?.volume?.h24 ? `$${(pair.volume.h24 / 1000).toFixed(0)}K` : "N/A",
          age: "Live",
          change: pair?.priceChange?.h24 ? `${pair.priceChange.h24 > 0 ? "+" : ""}${pair.priceChange.h24}%` : "0.0%",
          trend: pair?.priceChange?.h24 > 0 ? "up" : pair?.priceChange?.h24 < 0 ? "down" : "neutral",
          address: tokenAddress,
          holders: holders,
          liquidity: liqDisplay,
          imageUrl: pair?.info?.imageUrl || pair?.baseToken?.logoURI || pair?.baseToken?.image || pair?.image || pair?.icon || "",
          symbol: pair?.baseToken?.symbol || undefined,
          dexUrl: pair?.url || undefined,
          website: pair?.info?.websites?.[0]?.url || undefined,
          twitter: pair?.info?.socials?.find((social: any) => social.type === "twitter")?.url || undefined,
          telegram: pair?.info?.socials?.find((social: any) => social.type === "telegram")?.url || undefined,
          pairAddress: pair?.pairAddress || undefined,
          priceUsd: pair?.priceUsd ? String(pair.priceUsd) : undefined,
        },
        { mcValue: fdv, liquidityValue: liquidity, holdersValue: holders },
      );
    });

    const filtered = [...boostAlerts, ...volumeAlerts]
      .filter((alert) => alert.address)
      .filter((alert) => isAlertTypeEnabled(alert.type, filters) && passesNumericFilters(alert, filters));

    const sanitized = sanitizeAlerts(filtered).slice(0, 100);
    return await persistAlertSnapshots(sanitized);
  } catch (error) {
    console.error("Failed to fetch real DEX alerts:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
  }
  return [];
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
