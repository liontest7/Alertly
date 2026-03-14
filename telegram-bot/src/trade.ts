import { Keypair, VersionedTransaction, Connection } from "@solana/web3.js";
import bs58 from "bs58";
import { SOLANA_RPC } from "./wallet.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_QUOTE = "https://quote-api.jup.ag/v6/quote";
const JUPITER_SWAP = "https://quote-api.jup.ag/v6/swap";

export type TradeResult = {
  success: true;
  signature: string;
  explorerUrl: string;
} | {
  success: false;
  error: string;
};

export async function getQuote(tokenMint: string, solAmount: number, slippageBps: number = 1000): Promise<{ outAmount: string; priceImpactPct: string } | null> {
  try {
    const amountLamports = Math.floor(solAmount * 1e9);
    const params = new URLSearchParams({
      inputMint: SOL_MINT,
      outputMint: tokenMint,
      amount: amountLamports.toString(),
      slippageBps: slippageBps.toString(),
      restrictIntermediateTokens: "true",
    });
    const res = await fetch(`${JUPITER_QUOTE}?${params}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      outAmount: data.outAmount || "0",
      priceImpactPct: data.priceImpactPct || "0",
    };
  } catch {
    return null;
  }
}

export async function buyToken(
  privateKeyB58: string,
  tokenMint: string,
  solAmount: number,
  slippageBps: number = 1000,
): Promise<TradeResult> {
  try {
    const secretKey = bs58.decode(privateKeyB58);
    const keypair = Keypair.fromSecretKey(secretKey);
    const connection = new Connection(SOLANA_RPC, "confirmed");

    const amountLamports = Math.floor(solAmount * 1e9);

    const quoteParams = new URLSearchParams({
      inputMint: SOL_MINT,
      outputMint: tokenMint,
      amount: amountLamports.toString(),
      slippageBps: slippageBps.toString(),
      restrictIntermediateTokens: "true",
    });

    const quoteRes = await fetch(`${JUPITER_QUOTE}?${quoteParams}`, { signal: AbortSignal.timeout(15000) });
    if (!quoteRes.ok) {
      const body = await quoteRes.text().catch(() => "");
      return { success: false, error: `Quote failed (${quoteRes.status}): ${body.slice(0, 100)}` };
    }
    const quote = await quoteRes.json();

    const swapRes = await fetch(JUPITER_SWAP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: keypair.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!swapRes.ok) {
      const body = await swapRes.text().catch(() => "");
      return { success: false, error: `Swap tx failed (${swapRes.status}): ${body.slice(0, 100)}` };
    }
    const { swapTransaction } = await swapRes.json();

    const txBuf = Buffer.from(swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(txBuf);
    tx.sign([keypair]);

    const sig = await connection.sendRawTransaction(tx.serialize(), {
      maxRetries: 3,
      skipPreflight: false,
    });

    await connection.confirmTransaction(sig, "confirmed");

    return {
      success: true,
      signature: sig,
      explorerUrl: `https://solscan.io/tx/${sig}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg.slice(0, 200) };
  }
}
