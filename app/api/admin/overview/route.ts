import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
    const response = await withTimeout(fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getVersion", params: [] }),
    }), TIMEOUT_MS);
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
    const response = await withTimeout(fetch(`${base}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=So11111111111111111111111111111111111111112&amount=1000000&slippageBps=100`), TIMEOUT_MS);
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

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    usersTotal,
    bannedUsers,
    frozenUsers,
    telegramLinked,
    alerts24h,
    trades24h,
    listenerRows,
    dbCheck,
    rpcCheck,
    jupiterCheck,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.user.count({ where: { isFrozen: true } }),
    prisma.telegramLink.count(),
    prisma.alertEvent.count({ where: { alertedAt: { gte: dayAgo } } }),
    prisma.tradeExecutionLog.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.listenerStatus.findMany({ take: 10, orderBy: { updatedAt: "desc" } }).catch(() => []),
    prisma.$queryRaw`SELECT 1`.then(() => ({ status: "ok" as const })).catch(() => ({ status: "error" as const })),
    checkSolanaRpc(process.env.SOLANA_RPC_URL),
    checkJupiter(process.env.JUPITER_API_URL),
  ]);

  const listenerStatus = getListenerStatus();

  return NextResponse.json({
    users: {
      total: usersTotal,
      banned: bannedUsers,
      frozen: frozenUsers,
      telegramLinked,
    },
    activity: {
      alerts24h,
      trades24h,
    },
    listener: listenerStatus,
    infra: {
      database: dbCheck.status,
      solanaRpc: rpcCheck.status,
      jupiter: jupiterCheck.status,
    },
    listenerRows,
    checkedAt: now.toISOString(),
  });
}
