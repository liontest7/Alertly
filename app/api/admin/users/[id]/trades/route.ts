import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const access = await requireAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = params;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit") || 50)));

  const [trades, stats] = await Promise.all([
    prisma.tradeExecutionLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.tradeExecutionLog.groupBy({
      by: ["status"],
      where: { userId: id },
      _count: { id: true },
      _sum: { amount: true },
    }),
  ]);

  const pnlData = await (async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs = await prisma.tradeExecutionLog.findMany({
      where: { userId: id, createdAt: { gte: since }, status: "success" },
    });
    let solIn = 0, solOut = 0;
    for (const l of logs) {
      if (l.action === "buy") solIn += l.amount;
      else if (l.action === "sell") solOut += l.amount;
    }
    return { pnl24hSol: solOut - solIn, solIn, solOut };
  })();

  const totalBought = stats.find(s => s.status === "success")?._sum?.amount ?? 0;
  const totalSuccess = stats.find(s => s.status === "success")?._count?.id ?? 0;
  const totalFailed = stats.find(s => s.status === "failed")?._count?.id ?? 0;

  return NextResponse.json({
    userId: id,
    summary: {
      totalSuccess,
      totalFailed,
      totalBoughtSol: totalBought,
      pnl24h: pnlData,
    },
    trades,
  });
}
