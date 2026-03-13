import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getLiveAlerts } from "@/lib/blockchain/solana";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAlertListenerStarted } from "@/lib/alert-listener";
import {
  applyGuestAlertQuota,
  GUEST_DAILY_ALERT_LIMIT,
  getGuestSettings,
  setGuestAlertState,
} from "@/lib/guest-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    try {
      await ensureAlertListenerStarted();
    } catch (error) {
      console.error("Listener bootstrap failed:", error instanceof Error ? error.message : String(error));
    }

    const session = await auth(req);
    const userId = session?.user?.id;
    const cookieStore = cookies();

    let userSettings = userId
      ? await prisma.userSetting.findUnique({ where: { userId } })
      : getGuestSettings(cookieStore);

    if (userId && !userSettings) {
      console.warn(`[alerts] User ${userId} has no settings, creating defaults`);
      userSettings = await prisma.userSetting.create({
        data: { userId },
      });
    }

    if (userId && userSettings && (userSettings as any).alertsEnabled === false) {
      return NextResponse.json([], { headers: { "Cache-Control": "no-store", "X-Alert-Mode": "paused" } });
    }

    const alerts = await getLiveAlerts(
      userSettings
        ? {
            minMarketCap: userSettings.minMarketCap,
            maxMarketCap: userSettings.maxMarketCap,
            minLiquidity: userSettings.minLiquidity,
            minHolders: userSettings.minHolders,
            dexBoostEnabled: userSettings.dexBoostEnabled,
            dexListingEnabled: userSettings.dexListingEnabled,
          }
        : undefined,
    );

    const formattedAlerts = alerts.map((a) => ({
      ...a,
      type: a.type.replace("_", " "),
      trend: a.trend || (parseFloat(a.change) > 0 ? "up" : "down"),
      mc: a.mc || "-",
      liquidity: a.liquidity || "-",
      imageUrl: a.imageUrl || "",
    }));

    let payload = formattedAlerts;
    const responseHeaders: Record<string, string> = { "Cache-Control": "no-store" };

    if (!userId) {
      const quotaApplied = applyGuestAlertQuota(cookieStore, formattedAlerts);
      payload = quotaApplied.alerts as typeof formattedAlerts;
      responseHeaders["X-Alert-Limit"] = String(GUEST_DAILY_ALERT_LIMIT);
      responseHeaders["X-Alert-Used"] = String(quotaApplied.state.used);
      responseHeaders["X-Alert-Mode"] = "guest";

      const response = NextResponse.json(payload, { headers: responseHeaders });
      setGuestAlertState(response, quotaApplied.state);
      return response;
    }

    const isPremium = (userSettings as any)?.isPremium === true;
    const isVip = session?.user?.vipStatus === true || isPremium;

    if (!isVip) {
      const quotaApplied = applyGuestAlertQuota(cookieStore, formattedAlerts);
      payload = quotaApplied.alerts as typeof formattedAlerts;
      responseHeaders["X-Alert-Limit"] = String(GUEST_DAILY_ALERT_LIMIT);
      responseHeaders["X-Alert-Used"] = String(quotaApplied.state.used);
      responseHeaders["X-Alert-Mode"] = "free";
      responseHeaders["X-Vip-Status"] = "false";

      const response = NextResponse.json(payload, { headers: responseHeaders });
      setGuestAlertState(response, quotaApplied.state);
      return response;
    }

    responseHeaders["X-Alert-Mode"] = "vip";
    responseHeaders["X-Vip-Status"] = "true";
    return NextResponse.json(payload, { headers: responseHeaders });
  } catch (error) {
    console.error("Alerts API error:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    return NextResponse.json([]);
  }
}
