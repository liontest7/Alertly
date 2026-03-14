import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getLiveAlerts } from "@/lib/blockchain/solana";
import { auth } from "@/lib/auth";
import { ensureAlertListenerStarted } from "@/lib/alert-listener";
import { getUserSettings } from "@/lib/guest-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    try {
      await ensureAlertListenerStarted();
    } catch (error) {
      console.error("Listener bootstrap failed:", error instanceof Error ? error.message : String(error));
    }

    const session = await auth(req);
    const authenticated = !!session?.user;
    const cookieStore = cookies();
    const userSettings = getUserSettings(cookieStore, authenticated);

    if (userSettings.alertsEnabled === false) {
      return NextResponse.json([], { headers: { "Cache-Control": "no-store", "X-Alert-Mode": "paused" } });
    }

    const alerts = await getLiveAlerts({
      minMarketCap: userSettings.minMarketCap,
      maxMarketCap: userSettings.maxMarketCap,
      minLiquidity: userSettings.minLiquidity,
      minHolders: userSettings.minHolders,
      dexBoostEnabled: userSettings.dexBoostEnabled,
      dexListingEnabled: userSettings.dexListingEnabled,
      selectedBoostLevel: userSettings.selectedBoostLevel,
    });

    const formattedAlerts = alerts.map((a) => ({
      ...a,
      type: a.type.replaceAll("_", " "),
      trend: a.trend || (parseFloat(a.change) > 0 ? "up" : "down"),
      mc: a.mc || "-",
      liquidity: a.liquidity || "-",
      imageUrl: a.imageUrl || "",
    }));

    return NextResponse.json(formattedAlerts, {
      headers: {
        "Cache-Control": "no-store",
        "X-Alert-Mode": authenticated ? "user" : "guest",
      },
    });
  } catch (error) {
    console.error("Alerts API error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json([]);
  }
}
