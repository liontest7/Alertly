import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWalletBalance } from "@/lib/blockchain/balance";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth(req);

  if (!session?.user?.id) {
    return NextResponse.json({
      totalBalanceSol: 0,
      profit24hSol: 0,
      tradeCount24h: 0,
      available: false,
    });
  }

  const [wallet, trades24h] = await Promise.all([
    prisma.tradingWallet.findUnique({ where: { userId: session.user.id } }),
    prisma.tradeExecutionLog.findMany({
      where: {
        userId: session.user.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
  ]);

  const totalBalanceSol = wallet ? await getWalletBalance(wallet.walletAddress) : 0;

  // Approximation based on execution success/failure because on-chain PnL attribution requires full fill history.
  const profit24hSol = trades24h.reduce((acc, t) => {
    if (t.status === "success" && t.action === "sell") return acc + t.amount;
    if (t.status === "success" && t.action === "buy") return acc - t.amount;
    return acc;
  }, 0);

  return NextResponse.json({
    totalBalanceSol,
    profit24hSol,
    tradeCount24h: trades24h.length,
    available: Boolean(wallet),
  });
}
