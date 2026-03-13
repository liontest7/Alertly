import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getEnv } from "@/lib/env";

const RPC_PRIMARY = getEnv("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";
const RPC_FALLBACK = getEnv("SOLANA_RPC_FALLBACK_URL") || "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC_PRIMARY, "confirmed");
const fallbackConnection = RPC_FALLBACK !== RPC_PRIMARY ? new Connection(RPC_FALLBACK, "confirmed") : null;

export async function getWalletBalance(address: string): Promise<number> {
  try {
    const publicKey = new PublicKey(address);
    try {
      const balance = await connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch {
      if (!fallbackConnection) return 0;
      const balance = await fallbackConnection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    }
  } catch (error) {
    console.error("Failed to fetch wallet balance:", error);
    return 0;
  }
}
