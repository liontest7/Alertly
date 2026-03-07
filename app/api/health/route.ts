import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const HEALTH_TIMEOUT_MS = 8000;

function isBuildPhase() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)),
  ]);
}

async function checkSolanaRpc(rpcUrl: string) {
  const start = Date.now();
  try {
    const response = await withTimeout(
      fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getVersion", params: [] }),
      }),
      HEALTH_TIMEOUT_MS,
    );

    if (!response.ok) return { status: "error" as const, latencyMs: Date.now() - start };
    const json = await response.json();
    return {
      status: json?.result ? ("ok" as const) : ("error" as const),
      latencyMs: Date.now() - start,
    };
  } catch {
    return { status: "error" as const, latencyMs: Date.now() - start };
  }
}

async function checkJupiter(apiUrl: string) {
  const start = Date.now();
  try {
    const response = await withTimeout(
      fetch(
        `${apiUrl}/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=So11111111111111111111111111111111111111112&amount=1000000&slippageBps=100`,
      ),
      HEALTH_TIMEOUT_MS,
    );

    if (!response.ok) return { status: "error" as const, latencyMs: Date.now() - start };
    const json = await response.json();
    return {
      status: typeof json === "object" ? ("ok" as const) : ("error" as const),
      latencyMs: Date.now() - start,
    };
  } catch {
    return { status: "error" as const, latencyMs: Date.now() - start };
  }
}

export async function GET() {
  const requiredEnv = [
    "DATABASE_URL",
    "ENCRYPTION_KEY",
    "SOLANA_RPC_URL",
    "INTERNAL_API_KEY",
    "NEXTAUTH_URL",
    "AUTH_SECRET",
    "TELEGRAM_BOT_TOKEN",
  ] as const;

  const envStatus = Object.fromEntries(
    requiredEnv.map((name) => [name, Boolean(process.env[name] && process.env[name]?.trim())]),
  ) as Record<(typeof requiredEnv)[number], boolean>;

  const checks = {
    api: "ok",
    database: "unknown" as "ok" | "error" | "unknown",
    solanaRpc: "unknown" as "ok" | "error" | "unknown",
    jupiter: "unknown" as "ok" | "error" | "unknown",
    latencyMs: {
      solanaRpc: null as number | null,
      jupiter: null as number | null,
    },
    env: envStatus,
    readyForLaunch: false,
    timestamp: new Date().toISOString(),
  };

  if (isBuildPhase()) {
    return NextResponse.json(checks, { status: 200 });
  }

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, HEALTH_TIMEOUT_MS);
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (rpcUrl) {
    const result = await checkSolanaRpc(rpcUrl);
    checks.solanaRpc = result.status;
    checks.latencyMs.solanaRpc = result.latencyMs;
  }

  const jupiterUrl = process.env.JUPITER_API_URL || "https://quote-api.jup.ag";
  const jupiterResult = await checkJupiter(jupiterUrl);
  checks.jupiter = jupiterResult.status;
  checks.latencyMs.jupiter = jupiterResult.latencyMs;

  const envReady = Object.values(envStatus).every(Boolean);
  checks.readyForLaunch =
    checks.database === "ok" &&
    checks.solanaRpc === "ok" &&
    checks.jupiter === "ok" &&
    envReady;

  const status = checks.readyForLaunch ? 200 : 503;
  return NextResponse.json(checks, { status });
}
