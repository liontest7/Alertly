import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

export const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

function deriveKey(chatId: string): Buffer {
  const secret = (process.env.TELEGRAM_BOT_TOKEN || "alertly-default") + ":" + chatId;
  return createHash("sha256").update(secret).digest();
}

export function encryptPrivateKey(privateKeyB58: string, chatId: string): string {
  const key = deriveKey(chatId);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(privateKeyB58, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptPrivateKey(encryptedData: string, chatId: string): string {
  const key = deriveKey(chatId);
  const colonIndex = encryptedData.indexOf(":");
  const ivHex = encryptedData.slice(0, colonIndex);
  const encrypted = encryptedData.slice(colonIndex + 1);
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function generateWallet(chatId: string): { address: string; encryptedKey: string; privateKeyB58: string } {
  const keypair = Keypair.generate();
  const privateKeyB58 = bs58.encode(keypair.secretKey);
  const address = keypair.publicKey.toString();
  const encryptedKey = encryptPrivateKey(privateKeyB58, chatId);
  return { address, encryptedKey, privateKeyB58 };
}

export function importWallet(rawInput: string, chatId: string): { address: string; encryptedKey: string } | null {
  const attempts: Uint8Array[] = [];

  // Try JSON array: [1,2,3,...,64]
  try {
    const parsed = JSON.parse(rawInput.trim());
    if (Array.isArray(parsed) && parsed.length === 64) {
      attempts.push(new Uint8Array(parsed));
    }
  } catch {}

  // Try base58
  try {
    const decoded = bs58.decode(rawInput.trim());
    if (decoded.length === 64) attempts.push(decoded);
  } catch {}

  // Try base64
  try {
    const decoded = Buffer.from(rawInput.trim(), "base64");
    if (decoded.length === 64) attempts.push(new Uint8Array(decoded));
  } catch {}

  for (const secretKey of attempts) {
    try {
      const keypair = Keypair.fromSecretKey(secretKey);
      const address = keypair.publicKey.toString();
      const privateKeyB58 = bs58.encode(secretKey);
      const encryptedKey = encryptPrivateKey(privateKeyB58, chatId);
      return { address, encryptedKey };
    } catch {}
  }

  return null;
}

export async function getWalletBalance(address: string): Promise<number> {
  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const pubkey = new PublicKey(address);
    const lamports = await connection.getBalance(pubkey);
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

export function shortAddr(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
