import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireAdmin(req);
  if (!access.ok) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const [recentAlerts, recentEvents, failedTrades] = await Promise.all([
    prisma.alertEvent.findMany({
      orderBy: { alertedAt: "desc" },
      take: 20,
      select: {
        id: true,
        address: true,
        type: true,
        name: true,
        riskScore: true,
        riskLevel: true,
        alertedAt: true,
      },
    }),
    prisma.blockchainEvent.findMany({
      orderBy: { timestamp: "desc" },
      take: 20,
      select: {
        id: true,
        signature: true,
        tokenAddress: true,
        eventType: true,
        dex: true,
        timestamp: true,
      },
    }),
    prisma.tradeExecutionLog.findMany({
      where: { status: { in: ["error", "failed"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        userId: true,
        tokenAddress: true,
        action: true,
        status: true,
        message: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({ recentAlerts, recentEvents, failedTrades });
}
