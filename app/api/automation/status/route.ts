import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth(req);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [settings, recentLogs, copyTraders] = await Promise.all([
    prisma.userSetting.findUnique({ where: { userId: session.user.id } }),
    prisma.tradeExecutionLog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.copyTrader.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const status = {
    autoTradeEnabled: Boolean(settings?.autoTrade),
    buyAmount: settings?.buyAmount ?? 0,
    slippage: settings?.slippage ?? 0,
    copyTradingCount: copyTraders.length,
    recentExecutionCount: recentLogs.length,
    lastExecutionAt: recentLogs[0]?.createdAt ?? null,
    recentLogs,
    copyTraders,
  };

  return NextResponse.json(status);
}
