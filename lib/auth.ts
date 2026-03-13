import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import * as nacl from "tweetnacl";
import { getAdminWallets } from "@/lib/admin/access";

const AUTH_COOKIE = "auth_token";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const VIP_MINT = process.env.VIP_TOKEN_MINT;
const VIP_ACCESS_MODE = (process.env.VIP_ACCESS_MODE || "open").toLowerCase();
const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

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
    isAdmin?: boolean;
  };
};

type NonceTokenPayload = {
  nonce: string;
  domain: string;
  exp: number;
};

function base64url(input: string | Buffer | Uint8Array) {
  if (typeof input === "string") {
    return Buffer.from(input)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getJwtSecret() {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (secret) return secret;
  throw new Error("AUTH_SECRET environment variable is not set.");
}

async function computeSignature(header: string, body: string, secret: string) {
  const keyData = Buffer.from(secret);
  const data = Buffer.from(`${header}.${body}`);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return base64url(new Uint8Array(signature));
}

function parsePayload(body: string): AuthTokenPayload | null {
  try {
    const json = Buffer.from(body, "base64url").toString();
    const payload = JSON.parse(json) as AuthTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || now > payload.exp) return null;
    return payload;
  } catch {
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
  const key = await crypto.subtle.importKey("raw", Buffer.from(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, Buffer.from(`${header}.${body}`));
  const expected = base64url(new Uint8Array(signed));
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
  const message = `Sign this message to authenticate with Alertly.\n\nDomain: ${domain}\nNonce: ${nonce}\n\nBy signing, you also agree to allow access to the terminal while you are logged in. This request will not trigger a blockchain transaction or cost any gas fees.`;
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
  if (!message.includes(payload.nonce)) return { valid: false, reason: "Message does not contain the expected nonce" };
  try {
    const publicKey = new PublicKey(walletAddress);
    const signatureUint8 = bs58.decode(signature);
    const messageUint8 = new TextEncoder().encode(message);
    const valid = nacl.sign.detached.verify(messageUint8, signatureUint8, publicKey.toBytes());
    if (!valid) return { valid: false, reason: "Invalid signature" };
    return { valid: true };
  } catch {
    return { valid: false, reason: "Signature verification failed" };
  }
}

export async function getVipStatus(walletAddress: string): Promise<boolean> {
  if (VIP_ACCESS_MODE !== "token") return true;
  if (!VIP_MINT) {
    console.error("VIP_ACCESS_MODE=token but VIP_TOKEN_MINT is not configured");
    return false;
  }
  try {
    const connection = new Connection(RPC_ENDPOINT, "confirmed");
    const owner = new PublicKey(walletAddress);
    const mint = new PublicKey(VIP_MINT);
    const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });
    return accounts.value.some((item) => {
      const amount = Number((item.account.data as any)?.parsed?.info?.tokenAmount?.uiAmount || 0);
      return amount > 0;
    });
  } catch (error) {
    console.error("VIP on-chain check failed:", error);
    return false;
  }
}

export async function buildAuthToken(user: { id: string; walletAddress: string; vipStatus: boolean }) {
  return signToken({
    user_id: user.walletAddress,
    wallet_address: user.walletAddress,
    vip_status: user.vipStatus,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  });
}

export function setAuthCookie(response: NextResponse, token: string) {
  const secure = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
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
    const cookiesObj = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [name, ...value] = c.trim().split("=");
        return [name, value.join("=")];
      }),
    );
    const cookieToken = cookiesObj[AUTH_COOKIE];
    if (cookieToken) return decodeURIComponent(cookieToken);
    if ((req as any).cookies && typeof (req as any).cookies.get === "function") {
      const val = (req as any).cookies.get(AUTH_COOKIE)?.value;
      if (val) return decodeURIComponent(val);
    }
  }
  try {
    const val = cookies().get(AUTH_COOKIE)?.value;
    if (val) return decodeURIComponent(val);
    const allCookies = cookies().getAll();
    const match = allCookies.find((c) => c.name === AUTH_COOKIE);
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

  const walletAddress = payload.wallet_address;
  if (!walletAddress) return null;

  const user = {
    id: walletAddress,
    user_id: walletAddress,
    walletAddress,
    wallet_address: walletAddress,
    vipStatus: payload.vip_status,
    vip_status: payload.vip_status,
    isAdmin: getAdminWallets().map((w) => w.toLowerCase()).includes(walletAddress.toLowerCase()),
  };

  return { user };
}
