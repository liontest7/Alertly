import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth(req);

  if (!session?.user) {
    return NextResponse.json({
      totalBalanceSol: 0,
      profit24hSol: 0,
      tradeCount24h: 0,
      available: false,
    });
  }

  return NextResponse.json({
    totalBalanceSol: 0,
    profit24hSol: 0,
    tradeCount24h: 0,
    available: false,
  });
}
