import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getEnv } from "@/lib/env";

const RPC_ENDPOINT = getEnv("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";
const connection = new Connection(RPC_ENDPOINT, "confirmed");

export async function getWalletBalance(address: string): Promise<number> {
  try {
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error("Failed to fetch wallet balance:", error);
    return 0;
  }
}
