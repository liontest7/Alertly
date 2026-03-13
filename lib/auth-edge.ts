import { getEnv, requireEnv } from "@/lib/env";

export type AuthTokenPayload = {
  user_id: string;
  wallet_address: string;
  vip_status: boolean;
  exp: number;
};

function base64url(input: string | Uint8Array) {
  if (typeof input === "string") {
    return btoa(input).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }
  return btoa(String.fromCharCode(...input))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getJwtSecret() {
  const secret = getEnv("AUTH_SECRET") || getEnv("JWT_SECRET");
  if (secret) return secret;
  return requireEnv("AUTH_SECRET");
}

async function computeSignature(header: string, body: string, secret: string) {
  const keyData = new TextEncoder().encode(secret);
  const data = new TextEncoder().encode(`${header}.${body}`);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data.buffer as ArrayBuffer);
  return base64url(new Uint8Array(signature));
}

function parsePayload(body: string): AuthTokenPayload | null {
  try {
    const padded = body.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    const payload = JSON.parse(json) as AuthTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || now > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function verifyToken(token: string): Promise<AuthTokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  try {
    const expected = await computeSignature(header, body, getJwtSecret());
    if (signature !== expected) return null;
    return parsePayload(body);
  } catch {
    return null;
  }
}
