import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const status = (searchParams.get("status") || "all").trim();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const perPage = Math.min(100, Math.max(10, Number(searchParams.get("perPage") || 20)));

  const where: any = {};
  if (q) {
    where.OR = [
      { walletAddress: { contains: q, mode: "insensitive" } },
      { id: { contains: q, mode: "insensitive" } },
      { telegramLink: { telegramId: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (status === "banned") where.isBanned = true;
  if (status === "frozen") where.isFrozen = true;
  if (status === "active") {
    where.isBanned = false;
    where.isFrozen = false;
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: {
        settings: true,
        telegramLink: true,
        walletConnections: true,
        _count: {
          select: {
            tradeExecutionLogs: true,
            copyTraders: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return NextResponse.json({
    page,
    perPage,
    total,
    users,
  });
}
