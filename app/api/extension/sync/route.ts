import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getGuestSettings } from "@/lib/guest-session";
import { getWalletBalance } from "@/lib/blockchain/balance";

export const dynamic = "force-dynamic";

async function computePnl24h(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const logs = await prisma.tradeExecutionLog.findMany({
    where: { userId, createdAt: { gte: since }, status: "success" },
    orderBy: { createdAt: "desc" },
  });

  let solIn = 0;
  let solOut = 0;
  let tradeCount = 0;

  for (const log of logs) {
    if (log.action === "buy") {
      solIn += log.amount;
      tradeCount++;
    } else if (log.action === "sell") {
      solOut += log.amount;
    }
  }

  return {
    pnl24hSol: solOut - solIn,
    solIn,
    solOut,
    tradeCount24h: tradeCount,
    recentTrades: logs.slice(0, 10).map((l) => ({
      id: l.id,
      action: l.action,
      amount: l.amount,
      tokenAddress: l.tokenAddress,
      status: l.status,
      txSig: l.txSig ?? null,
      createdAt: l.createdAt,
    })),
  };
}

export async function GET(req: Request) {
  try {
    const session = await auth(req);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          authenticated: false,
          guestEnabled: true,
          sync: {
            provider: "browser_cookie",
            syncedAt: new Date().toISOString(),
          },
          guestSettings: getGuestSettings(cookies()),
        },
        { status: 200 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        settings: true,
        walletConnections: true,
        telegramLink: true,
        tradingWallet: {
          select: { walletAddress: true, createdAt: true },
        },
      },
    });

    const [pnlData, tradingWalletBalance] = await Promise.all([
      computePnl24h(session.user.id),
      user?.tradingWallet?.walletAddress
        ? getWalletBalance(user.tradingWallet.walletAddress).catch(() => 0)
        : Promise.resolve(0),
    ]);

    return NextResponse.json(
      {
        authenticated: true,
        guestEnabled: false,
        alertsEnabled: user?.settings?.alertsEnabled !== false,
        sync: {
          provider: "render",
          syncedAt: new Date().toISOString(),
        },
        user: {
          walletAddress: user?.walletAddress,
          vipLevel: user?.vipLevel,
          telegramLinked: !!user?.telegramLink,
          settings: user?.settings
            ? {
                buyAmount: user.settings.buyAmount,
                maxBuyPerToken: user.settings.maxBuyPerToken,
                slippage: user.settings.slippage,
                stopLoss: user.settings.stopLoss,
                takeProfit: user.settings.takeProfit,
                trailingStop: user.settings.trailingStop,
                autoTrade: user.settings.autoTrade,
                autoSellMinutes: user.settings.autoSellMinutes,
                alertsEnabled: user.settings.alertsEnabled,
                dexBoostEnabled: user.settings.dexBoostEnabled,
                dexListingEnabled: user.settings.dexListingEnabled,
                minMarketCap: user.settings.minMarketCap,
                maxMarketCap: user.settings.maxMarketCap,
                minLiquidity: user.settings.minLiquidity,
                minHolders: user.settings.minHolders,
                selectedBoostLevel: user.settings.selectedBoostLevel,
              }
            : null,
          tradingWallet: user?.tradingWallet
            ? {
                walletAddress: user.tradingWallet.walletAddress,
                balanceSol: tradingWalletBalance,
                createdAt: user.tradingWallet.createdAt,
              }
            : null,
          pnl: pnlData,
          wallets: user?.walletConnections,
        },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
