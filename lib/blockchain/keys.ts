import crypto from "crypto";
import { requireEnv } from "@/lib/env";

const ENCRYPTION_KEY = requireEnv("ENCRYPTION_KEY", {
  allowInDev: true,
  devFallback: "dev-encryption-key-32-bytes-only",
});
const IV_LENGTH = 16;

function getCipherKey() {
  return Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
}

export function encryptKey(privateKey: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", getCipherKey(), iv);
  let encrypted = cipher.update(privateKey);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptKey(text: string): string {
  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift()!, "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", getCipherKey(), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    console.error("Decryption failed", e);
    return "";
  }
}
