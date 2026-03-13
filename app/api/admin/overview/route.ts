import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { getListenerStatus } from "@/lib/listeners/blockchain-listener";
import { getAlerts } from "@/lib/alert-store";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout ${ms}`)), ms)),
  ]);
}

async function checkSolanaRpc(rpcUrl?: string): Promise<string> {
  if (!rpcUrl) return "missing";
  try {
    const response = await withTimeout(
      fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getVersion", params: [] }),
      }),
      TIMEOUT_MS,
    );
    if (!response.ok) return "error";
    const json = await response.json();
    return json?.result ? "ok" : "error";
  } catch {
    return "error";
  }
}

async function checkJupiter(apiUrl?: string): Promise<string> {
  const base = (apiUrl || "https://lite-api.jup.ag/swap/v1").replace(/\/$/, "");
  try {
    const response = await withTimeout(
      fetch(`${base}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000&slippageBps=100`),
      TIMEOUT_MS,
    );
    if (!response.ok) return "error";
    const json = await response.json();
    return json?.outAmount ? "ok" : "error";
  } catch {
    return "error";
  }
}

function getTelegramSubscriberCount(): number {
  try {
    const path = join(process.cwd(), "telegram-bot", "data", "subscribers.json");
    if (!existsSync(path)) return 0;
    const data = JSON.parse(readFileSync(path, "utf-8"));
    return Object.keys(data).length;
  } catch {
    return 0;
  }
}

function getAlerts24h(): number {
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return getAlerts().filter((a) => a.alertedAt.getTime() > cutoff).length;
  } catch {
    return 0;
  }
}

export async function GET(req: Request) {
  const access = await requireAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const listenerStatus = getListenerStatus();
  const telegramLinked = getTelegramSubscriberCount();
  const alerts24h = getAlerts24h();

  const [solanaRpc, jupiter] = await Promise.all([
    checkSolanaRpc(process.env.SOLANA_RPC_URL),
    checkJupiter(process.env.JUPITER_API_URL),
  ]);

  return NextResponse.json({
    users: {
      total: telegramLinked,
      banned: 0,
      frozen: 0,
      telegramLinked,
    },
    activity: {
      alerts24h,
      trades24h: 0,
    },
    listener: {
      running: listenerStatus.running,
      subscriptions: listenerStatus.subscriptions ?? 0,
      uptime: listenerStatus.uptime,
      mode: listenerStatus.mode ?? "dexscreener-api-polling",
      monitors: listenerStatus.monitors,
    },
    infra: {
      database: "disabled",
      solanaRpc,
      jupiter,
    },
    checkedAt: new Date().toISOString(),
  });
}
