/**
 * Automation Scheduler
 * Runs auto-trading logic every 30 seconds for users with autoTrade=ON.
 * Triggered alongside the blockchain listener on app startup.
 */

import { prisma } from "./prisma";
import { getLiveAlerts } from "./blockchain/solana";
import { processAutoTrade, shouldAutoTrade } from "./trading/strategies";

const RUN_INTERVAL_MS = 30_000;
const MAX_USERS_PER_RUN = 25;
const MAX_ALERTS_TO_SCAN = 10;
const DUPLICATE_TRADE_WINDOW_MINUTES = 30;

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function hasRecentTrade(userId: string, tokenAddress: string): Promise<boolean> {
  const recentThreshold = new Date(Date.now() - DUPLICATE_TRADE_WINDOW_MINUTES * 60 * 1000);
  const existing = await prisma.tradeExecutionLog.findFirst({
    where: {
      userId,
      tokenAddress,
      action: "buy",
      createdAt: { gte: recentThreshold },
      status: "success",
    },
  });
  return Boolean(existing);
}

async function runAutomation() {
  try {
    const users = await prisma.user.findMany({
      where: {
        settings: { is: { autoTrade: true } },
        tradingWallet: { isNot: null },
        isBanned: false,
        isFrozen: false,
      },
      select: { id: true, settings: true },
      take: MAX_USERS_PER_RUN,
    });

    if (users.length === 0) return;

    for (const user of users) {
      const settings = user.settings;
      if (!settings) continue;

      let alerts;
      try {
        alerts = await getLiveAlerts({
          minMarketCap: settings.minMarketCap,
          maxMarketCap: settings.maxMarketCap,
          minLiquidity: settings.minLiquidity,
          minHolders: settings.minHolders,
          dexBoostEnabled: settings.dexBoostEnabled,
          dexListingEnabled: settings.dexListingEnabled,
        });
      } catch {
        continue;
      }

      for (const alert of alerts.slice(0, MAX_ALERTS_TO_SCAN)) {
        try {
          const shouldTrade = await shouldAutoTrade(alert, {
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

          if (!shouldTrade) continue;

          const isDuplicate = await hasRecentTrade(user.id, alert.address);
          if (isDuplicate) continue;

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
        } catch (err) {
          console.error(
            `[AutoTrader] Trade error for user ${user.id}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }
  } catch (err) {
    console.error("[AutoTrader] Run error:", err instanceof Error ? err.message : err);
  }
}

export function startAutomationScheduler() {
  if (schedulerTimer) return;

  console.log(`[AutoTrader] Scheduler started — running every ${RUN_INTERVAL_MS / 1000}s`);

  schedulerTimer = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await runAutomation();
    } finally {
      isRunning = false;
    }
  }, RUN_INTERVAL_MS);
}

export function stopAutomationScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("[AutoTrader] Scheduler stopped");
  }
}

export function isAutomationSchedulerRunning(): boolean {
  return schedulerTimer !== null;
}
