import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address") || "";
  const limitRaw = Number(searchParams.get("limit") || 20);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 20;

  if (!address) {
    return NextResponse.json({ message: "Missing address" }, { status: 400 });
  }

  try {
    const events = await prisma.alertEvent.findMany({
      where: { address },
      orderBy: { alertedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ address, events, count: events.length });
  } catch (error) {
    return NextResponse.json({
      address,
      events: [],
      count: 0,
      message: "Alert events table unavailable. Run prisma migrate deploy/db push.",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 503 });
  }
}
