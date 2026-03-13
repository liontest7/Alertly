import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEnv } from "@/lib/env";
import { getLiveAlerts } from "@/lib/blockchain/solana";
import { processAutoTrade, shouldAutoTrade } from "@/lib/trading/strategies";

export const dynamic = "force-dynamic";

const INTERNAL_API_KEY = requireEnv("INTERNAL_API_KEY", {
  allowInDev: true,
  devFallback: "dev-internal-api-key",
});

const MAX_USERS_PER_RUN = 25;
const MAX_ALERTS_TO_SCAN = 10;
const DUPLICATE_TRADE_WINDOW_MINUTES = 30;

function isAuthorized(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.replace("Bearer ", "") === INTERNAL_API_KEY;
}

async function hasRecentTrade(userId: string, tokenAddress: string) {
  const recentThreshold = new Date(Date.now() - DUPLICATE_TRADE_WINDOW_MINUTES * 60 * 1000);

  const existing = await prisma.tradeExecutionLog.findFirst({
    where: {
      userId,
      tokenAddress,
      action: "buy",
      createdAt: { gte: recentThreshold },
      status: "success",
    },
    orderBy: { createdAt: "desc" },
  });

  return Boolean(existing);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = Boolean(body?.dryRun);

  const startedAt = Date.now();
  const summary: {
    dryRun: boolean;
    scannedUsers: number;
    scannedAlerts: number;
    tradesAttempted: number;
    tradesSucceeded: number;
    tradesFailed: number;
    skippedRecent: number;
    errors: Array<{ userId: string; tokenAddress?: string; message: string }>;
  } = {
    dryRun,
    scannedUsers: 0,
    scannedAlerts: 0,
    tradesAttempted: 0,
    tradesSucceeded: 0,
    tradesFailed: 0,
    skippedRecent: 0,
    errors: [],
  };

  const users = await prisma.user.findMany({
    where: {
      settings: {
        is: {
          autoTrade: true,
        },
      },
      tradingWallet: { isNot: null },
    },
    select: {
      id: true,
      settings: true,
    },
    take: MAX_USERS_PER_RUN,
  });

  summary.scannedUsers = users.length;

  for (const user of users) {
    const settings = user.settings;
    if (!settings) {
      summary.errors.push({
        userId: user.id,
        message: "User has no settings configured",
      });
      continue;
    }

    let alerts = [] as Awaited<ReturnType<typeof getLiveAlerts>>;
    try {
      alerts = await getLiveAlerts({
        minMarketCap: settings.minMarketCap,
        maxMarketCap: settings.maxMarketCap,
        minLiquidity: settings.minLiquidity,
        minHolders: settings.minHolders,
        dexBoostEnabled: settings.dexBoostEnabled,
        dexListingEnabled: settings.dexListingEnabled,
      });
    } catch (error) {
      summary.errors.push({
        userId: user.id,
        message: error instanceof Error ? error.message : "Failed to fetch alerts for user",
      });
      continue;
    }

    for (const alert of alerts.slice(0, MAX_ALERTS_TO_SCAN)) {
      summary.scannedAlerts += 1;

      try {
        const shouldTradeDecision = await shouldAutoTrade(alert, {
          userId: user.id,
          enabled: settings.autoTrade,
          buyAmount: settings.buyAmount,
          maxBuyPerToken: settings.maxBuyPerToken,
          maxSlippage: settings.slippage,
          takeProfit: settings.takeProfit,
          stopLoss: settings.stopLoss,
          trailingStop: settings.trailingStop,
          minMarketCap: settings.minMarketCap,
          maxMarketCap: settings.maxMarketCap,
          minLiquidity: settings.minLiquidity,
          minHolders: settings.minHolders,
          dexBoostEnabled: settings.dexBoostEnabled,
          dexListingEnabled: settings.dexListingEnabled,
        });

        if (!shouldTradeDecision) continue;

        const isDuplicate = await hasRecentTrade(user.id, alert.address);
        if (isDuplicate) {
          summary.skippedRecent += 1;
          continue;
        }

        summary.tradesAttempted += 1;

        if (dryRun) {
          await prisma.tradeExecutionLog.create({
            data: {
              userId: user.id,
              tokenAddress: alert.address,
              alertType: alert.type,
              action: "buy",
              amount: settings.buyAmount,
              slippage: settings.slippage,
              status: "dry_run",
              message: "Dry run: trade skipped intentionally",
            },
          });
          continue;
        }

        const result = await processAutoTrade(alert, {
          userId: user.id,
          enabled: settings.autoTrade,
          buyAmount: settings.buyAmount,
          maxBuyPerToken: settings.maxBuyPerToken,
          maxSlippage: settings.slippage,
          takeProfit: settings.takeProfit,
          stopLoss: settings.stopLoss,
          trailingStop: settings.trailingStop,
          minMarketCap: settings.minMarketCap,
          maxMarketCap: settings.maxMarketCap,
          minLiquidity: settings.minLiquidity,
          minHolders: settings.minHolders,
          dexBoostEnabled: settings.dexBoostEnabled,
          dexListingEnabled: settings.dexListingEnabled,
        });

        await prisma.tradeExecutionLog.create({
          data: {
            userId: user.id,
            tokenAddress: alert.address,
            alertType: alert.type,
            action: "buy",
            amount: settings.buyAmount,
            slippage: settings.slippage,
            status: result?.success ? "success" : "failed",
            txSig: result?.txSig || null,
            message: result?.message || null,
          },
        });

        if (result?.success) {
          summary.tradesSucceeded += 1;
        } else {
          summary.tradesFailed += 1;
        }
      } catch (error) {
        summary.tradesFailed += 1;
        summary.errors.push({
          userId: user.id,
          tokenAddress: alert.address,
          message: error instanceof Error ? error.message : "Unknown automation error",
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    summary,
  });
}
