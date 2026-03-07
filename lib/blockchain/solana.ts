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

const JUPITER_API_URL = getEnv("JUPITER_API_URL", "https://quote-api.jup.ag");
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
}

export async function getLiveAlerts(): Promise<TokenAlert[]> {
  try {
    let boostAlerts: TokenAlert[] = [];
    const boostResponse = await fetch(
      "https://api.dexscreener.com/token-boosts/top/v1/solana",
      {
        next: { revalidate: 10 },
      },
    );

    if (boostResponse.ok) {
      const data = await boostResponse.json();
      if (Array.isArray(data)) {
        boostAlerts = data.slice(0, 10).map((item: any) => ({
          name: item.baseToken?.symbol || item.tokenAddress.substring(0, 4),
          type: "DEX_BOOST",
          mc: item.fdv ? `$${(item.fdv / 1000).toFixed(0)}K` : "Live",
          vol: item.volume?.h24 ? `$${(item.volume.h24 / 1000).toFixed(0)}K` : "Live",
          age: "New",
          change: item.priceChange?.h24 ? `${item.priceChange.h24 > 0 ? "+" : ""}${item.priceChange.h24}%` : "0%",
          trend: item.priceChange?.h24 > 0 ? "up" : "down",
          address: item.tokenAddress,
          holders: item.amount || 0,
          liquidity: item.liquidity?.usd ? `$${(item.liquidity.usd / 1000).toFixed(0)}K` : "Live",
        }));
      }
    }

    // Parallel: Get Volume Spikes from latest pairs
    const solResponse = await fetch(
      "https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112",
      { next: { revalidate: 10 } }
    );
    const solData = await solResponse.json();
    if (solData.pairs) {
      const volumeAlerts = solData.pairs.slice(0, 10).map((pair: any) => ({
        name: pair.baseToken.symbol,
        type: "VOL_SPIKE",
        mc: pair.fdv ? `$${(pair.fdv / 1000000).toFixed(1)}M` : "N/A",
        vol: pair.volume?.h24 ? `$${(pair.volume.h24 / 1000).toFixed(0)}K` : "N/A",
        age: "Live",
        change: pair.priceChange?.h24 ? `${pair.priceChange.h24 > 0 ? "+" : ""}${pair.priceChange.h24}%` : "0.0%",
        trend: pair.priceChange?.h24 > 0 ? "up" : "down",
        address: pair.baseToken.address,
        holders: 0,
        liquidity: pair.liquidity?.usd ? `$${(pair.liquidity.usd / 1000).toFixed(0)}K` : "N/A",
      }));
      return [...boostAlerts, ...volumeAlerts].slice(0, 20);
    }

    return boostAlerts;
  } catch (error) {
    console.error("Failed to fetch real DEX alerts:", error);
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
      `${JUPITER_API_URL}/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${atomicAmount}&slippageBps=${Math.round(params.slippage * 100)}`,
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

    const swapResponse = await fetch(`${JUPITER_API_URL}/v6/swap`, {
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
