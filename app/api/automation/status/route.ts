import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { getUserSettings } from "@/lib/guest-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await auth(req);
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const cookieStore = cookies();
    const settings = getUserSettings(cookieStore, true);

    return NextResponse.json({
      autoTradeEnabled: settings.autoTrade,
      copyTradingCount: 0,
      recentTrades: [],
      settings: {
        buyAmount: settings.buyAmount,
        slippage: settings.slippage,
        stopLoss: settings.stopLoss,
        takeProfit: settings.takeProfit,
      },
    });
  } catch {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
