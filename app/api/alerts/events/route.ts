import { NextResponse } from "next/server";
import { getAlerts } from "@/lib/alert-store";

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
    const all = getAlerts();
    const events = all
      .filter((e) => e.address === address)
      .slice(0, limit)
      .map((e) => ({
        ...e,
        alertedAt: e.alertedAt.toISOString(),
      }));

    return NextResponse.json({ address, events, count: events.length });
  } catch (error) {
    return NextResponse.json({ address, events: [], count: 0 });
  }
}
