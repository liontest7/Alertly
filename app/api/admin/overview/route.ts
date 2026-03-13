import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { getListenerStatus } from "@/lib/listeners/blockchain-listener";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout ${ms}`)), ms)),
  ]);
}

async function checkSolanaRpc(rpcUrl?: string) {
  if (!rpcUrl) return { status: "missing" as const };
  try {
    const response = await withTimeout(
      fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getVersion", params: [] }),
      }),
      TIMEOUT_MS,
    );
    if (!response.ok) return { status: "error" as const };
    const json = await response.json();
    return { status: json?.result ? ("ok" as const) : ("error" as const) };
  } catch {
    return { status: "error" as const };
  }
}

async function checkJupiter(apiUrl?: string) {
  const base = (apiUrl || "https://lite-api.jup.ag/swap/v1").replace(/\/$/, "");
  try {
    const response = await withTimeout(
      fetch(`${base}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=So11111111111111111111111111111111111111112&amount=1000000&slippageBps=100`),
      TIMEOUT_MS,
    );
    if (!response.ok) return { status: "error" as const };
    const json = await response.json();
    return { status: json?.outAmount ? ("ok" as const) : ("error" as const) };
  } catch {
    return { status: "error" as const };
  }
}

export async function GET(req: Request) {
  const access = await requireAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const listenerStatus = getListenerStatus();

  const [solanaRpc, jupiter] = await Promise.all([
    checkSolanaRpc(process.env.SOLANA_RPC_URL),
    checkJupiter(process.env.JUPITER_API_URL),
  ]);

  return NextResponse.json({
    stats: {
      totalUsers: 0,
      activeToday: 0,
      tradesLast24h: 0,
      alertsLast24h: 0,
    },
    listeners: [listenerStatus],
    health: {
      database: { status: "disabled" },
      solanaRpc,
      jupiter,
    },
  });
}
