import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserSettings } from "@/lib/guest-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await auth(req);
    const authenticated = !!session?.user;
    const cookieStore = cookies();
    const settings = getUserSettings(cookieStore, authenticated);

    return NextResponse.json({
      authenticated,
      guestEnabled: !authenticated,
      alertsEnabled: settings.alertsEnabled !== false,
      sync: {
        provider: "cookie",
        syncedAt: new Date().toISOString(),
      },
      user: authenticated
        ? {
            walletAddress: session!.user.walletAddress,
            vipLevel: session!.user.vipStatus ? 1 : 0,
            settings: {
              buyAmount: settings.buyAmount,
              maxBuyPerToken: settings.maxBuyPerToken,
              slippage: settings.slippage,
              stopLoss: settings.stopLoss,
              takeProfit: settings.takeProfit,
              trailingStop: settings.trailingStop,
              autoTrade: settings.autoTrade,
              autoSellMinutes: settings.autoSellMinutes,
              alertsEnabled: settings.alertsEnabled,
              dexBoostEnabled: settings.dexBoostEnabled,
              dexListingEnabled: settings.dexListingEnabled,
              minMarketCap: settings.minMarketCap,
              maxMarketCap: settings.maxMarketCap,
              minLiquidity: settings.minLiquidity,
              minHolders: settings.minHolders,
              selectedBoostLevel: settings.selectedBoostLevel,
            },
          }
        : null,
      guestSettings: !authenticated ? settings : null,
    });
  } catch {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
