import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { requireEnv } from "@/lib/env";
import * as nacl from "tweetnacl";

const AUTH_COOKIE = "auth_token";
const NONCE_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const VIP_MINT = process.env.VIP_TOKEN_MINT;

export type AuthTokenPayload = {
  user_id: string;
  wallet_address: string;
  vip_status: boolean;
  exp: number;
};

export type AuthSession = {
  user: {
    id: string;
    walletAddress: string;
    vipStatus: boolean;
  };
};

type NonceTokenPayload = {
  nonce: string;
  domain: string;
  exp: number;
};

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getJwtSecret() {
  return requireEnv("AUTH_SECRET", { allowInDev: true, devFallback: "dev-auth-secret" });
}

async function computeSignature(header: string, body: string, secret: string) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const data = encoder.encode(`${header}.${body}`);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return Buffer.from(signature)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parsePayload(body: string): AuthTokenPayload | null {
  try {
    const json = Buffer.from(body, "base64url").toString();
    const payload = JSON.parse(json) as AuthTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || now > payload.exp) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

async function signToken(payload: AuthTokenPayload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = await computeSignature(header, body, getJwtSecret());
  return `${header}.${body}.${signature}`;
}

export async function verifyToken(token: string): Promise<AuthTokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const expected = await computeSignature(header, body, getJwtSecret());
  if (signature !== expected) return null;

  return parsePayload(body);
}

export async function verifyTokenWithSecret(token: string, secret: string): Promise<AuthTokenPayload | null> {
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`));
  const expected = Buffer.from(signed).toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (expected !== signature) return null;
  return parsePayload(body);
}

async function signNonceToken(payload: NonceTokenPayload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = await computeSignature(header, body, getJwtSecret());
  return `${header}.${body}.${signature}`;
}

async function verifyNonceToken(token: string): Promise<NonceTokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  const expected = await computeSignature(header, body, getJwtSecret());
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as NonceTokenPayload;
    if (!payload.nonce || !payload.domain || !payload.exp) return null;
    if (Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createAuthNonce(domain: string) {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
  const message = `Sign this message to authenticate with Alertly.\n\nDomain: ${domain}\nNonce: ${nonce}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;
  const payload: NonceTokenPayload = {
    nonce,
    domain,
    exp: Math.floor(Date.now() / 1000) + 300,
  };
  const token = await signNonceToken(payload);
  return { message, nonce, nonceToken: token };
}

export async function verifyWalletSignature({
  walletAddress,
  signature,
  message,
  nonceToken,
}: {
  walletAddress: string;
  signature: string;
  message: string;
  nonceToken: string;
}) {
  const payload = await verifyNonceToken(nonceToken);
  if (!payload) return { valid: false, reason: "Invalid or expired nonce token" };

  if (!message.includes(payload.nonce)) {
    return { valid: false, reason: "Message does not contain the expected nonce" };
  }

  try {
    const publicKey = new PublicKey(walletAddress);
    const signatureUint8 = bs58.decode(signature);
    const messageUint8 = new TextEncoder().encode(message);

    const valid = nacl.sign.detached.verify(messageUint8, signatureUint8, publicKey.toBytes());

    if (!valid) return { valid: false, reason: "Invalid signature" };
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: "Signature verification failed" };
  }
}

export async function getVipStatus(walletAddress: string): Promise<boolean> {
  if (!VIP_MINT) return false;

  try {
    const publicKey = new PublicKey(walletAddress);
    const mint = new PublicKey(VIP_MINT);
    const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [publicKey.toBase58(), { mint: mint.toBase58() }, { encoding: "jsonParsed" }],
      }),
    });

    const data = await response.json();
    const accounts = data?.result?.value;
    return Array.isArray(accounts) && accounts.length > 0;
  } catch (error) {
    return false;
  }
}

export async function buildAuthToken(user: { id: string; walletAddress: string; vipStatus: boolean }) {
  return signToken({
    user_id: user.id,
    wallet_address: user.walletAddress,
    vip_status: user.vipStatus,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  });
}

export function setAuthCookie(response: NextResponse, token: string) {
  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function getAuthTokenFromRequest(req?: NextRequest | Request) {
  if (req) {
    const header = req.headers.get("authorization");
    if (header?.startsWith("Bearer ")) return header.replace("Bearer ", "");

    const cookieHeader = req.headers.get("cookie") || "";
    const cookieToken = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${AUTH_COOKIE}=`))
      ?.split("=")[1];
    
    if (cookieToken) return decodeURIComponent(cookieToken);

    if (req && (req as any).cookies && typeof (req as any).cookies.get === 'function') {
       const val = (req as any).cookies.get(AUTH_COOKIE)?.value;
       if (val) return decodeURIComponent(val);
    }
  }

  try {
    const val = cookies().get(AUTH_COOKIE)?.value;
    if (val) return decodeURIComponent(val);
    
    // Fallback for some environments where cookies() might be tricky
    const allCookies = cookies().getAll();
    const match = allCookies.find(c => c.name === AUTH_COOKIE);
    return match ? decodeURIComponent(match.value) : null;
  } catch {
    return null;
  }
}

export async function auth(req?: NextRequest | Request): Promise<AuthSession | null> {
  const token = getAuthTokenFromRequest(req);
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const user = {
    id: payload.user_id,
    user_id: payload.user_id,
    walletAddress: payload.wallet_address,
    wallet_address: payload.wallet_address,
    vipStatus: payload.vip_status,
    vip_status: payload.vip_status,
  };
  return { user };
}
