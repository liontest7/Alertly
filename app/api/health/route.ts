import { NextResponse } from "next/server";
import { getMissingRequiredEnv } from "@/lib/env";

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


export async function GET() {
  const requiredEnv = [
    "ENCRYPTION_KEY",
    "SOLANA_RPC_URL",
    "INTERNAL_API_KEY",
    "TELEGRAM_BOT_TOKEN",
    "ALERTLY_API_BASE_URL",
    "NEXT_PUBLIC_APP_URL",
  ] as const;

  const missingEnv = new Set(getMissingRequiredEnv(requiredEnv));
  const authSecretConfigured = Boolean(process.env.AUTH_SECRET || process.env.JWT_SECRET);

  const envStatus = {
    ...Object.fromEntries(
      requiredEnv.map((name) => [name, !missingEnv.has(name)]),
    ),
    AUTH_SECRET_OR_JWT_SECRET: authSecretConfigured,
  } as Record<(typeof requiredEnv)[number] | "AUTH_SECRET_OR_JWT_SECRET", boolean>;

  const checks = {
    api: "ok",
    database: "unknown" as "ok" | "disabled" | "error",
    solanaRpc: "unknown" as "ok" | "error" | "unknown",
    latencyMs: {
      solanaRpc: null as number | null,
    },
    env: envStatus,
    readyForLaunch: false,
    timestamp: new Date().toISOString(),
  };

  if (isBuildPhase()) {
    return NextResponse.json(checks, { status: 200 });
  }

  checks.database = "disabled";

  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (rpcUrl) {
    const result = await checkSolanaRpc(rpcUrl);
    checks.solanaRpc = result.status;
    checks.latencyMs.solanaRpc = result.latencyMs;
  }

  const envReady = Object.values(envStatus).every(Boolean);
  checks.readyForLaunch =
    checks.solanaRpc === "ok" &&
    envReady;

  const status = checks.readyForLaunch ? 200 : 503;
  return NextResponse.json(checks, { status });
}
