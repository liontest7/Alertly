import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { alertEmitter, getAlerts, StoredAlert } from "@/lib/alert-store";
import { ensureAlertListenerStarted } from "@/lib/alert-listener";
import { getGuestSettingsPatchFromCookieHeader } from "@/lib/guest-session";
import { DEFAULT_USER_SETTINGS } from "@/lib/settings/defaults";

export const dynamic = "force-dynamic";

const DAILY_ALERT_LIMIT = 50;

function sseEvent(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

interface AlertFilters {
  minMarketCap?: number;
  maxMarketCap?: number;
  minLiquidity?: number;
  minHolders?: number;
  dexBoostEnabled?: boolean;
  dexListingEnabled?: boolean;
}

function parseMoneyValue(input?: string | null): number | null {
  if (!input) return null;
  const normalized = input.replace(/[$,\s]/g, "").toUpperCase();
  if (!normalized || normalized === "N/A") return null;
  const suffix = normalized.slice(-1);
  const num = parseFloat(normalized);
  if (isNaN(num)) return null;
  if (suffix === "B") return num * 1_000_000_000;
  if (suffix === "M") return num * 1_000_000;
  if (suffix === "K") return num * 1_000;
  return num;
}

function alertMatchesFilters(alert: StoredAlert, filters: AlertFilters): boolean {
  if (alert.type === "DEX_BOOST" && filters.dexBoostEnabled === false) return false;
  if (alert.type === "DEX_LISTING" && filters.dexListingEnabled === false) return false;

  if (filters.minMarketCap && filters.minMarketCap > 0) {
    const mc = parseMoneyValue(alert.mc);
    if (mc !== null && mc < filters.minMarketCap) return false;
  }

  if (filters.maxMarketCap && filters.maxMarketCap > 0) {
    const mc = parseMoneyValue(alert.mc);
    if (mc !== null && mc > filters.maxMarketCap) return false;
  }

  if (filters.minLiquidity && filters.minLiquidity > 0) {
    const liq = parseMoneyValue(alert.liquidity);
    if (liq !== null && liq < filters.minLiquidity) return false;
  }

  if (filters.minHolders && filters.minHolders > 1) {
    if (alert.holders < filters.minHolders) return false;
  }

  return true;
}

async function incrementDailyCount(userId: string): Promise<void> {
  try {
    const settings = await prisma.userSetting.findUnique({ where: { userId } });
    if (!settings) return;
    const now = new Date();
    const lastReset = settings.lastAlertReset ? new Date(settings.lastAlertReset) : now;
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
    if (hoursSinceReset >= 24) {
      await prisma.userSetting.update({
        where: { userId },
        data: { dailyAlertCount: 1, lastAlertReset: now },
      });
    } else {
      await prisma.userSetting.update({
        where: { userId },
        data: { dailyAlertCount: { increment: 1 } },
      });
    }
  } catch {}
}

export async function GET(req: Request) {
  try {
    await ensureAlertListenerStarted();
  } catch {
    // stream can still work
  }

  const session = await auth(req);
  const userId = session?.user?.id;

  let settings: any = DEFAULT_USER_SETTINGS;
  let isPremium = false;
  let sessionAlertCount = 0;

  if (userId) {
    const dbSettings = await prisma.userSetting.findUnique({ where: { userId } }).catch(() => null);
    if (dbSettings) {
      settings = dbSettings;
      isPremium = dbSettings.isPremium === true;

      const now = new Date();
      const lastReset = dbSettings.lastAlertReset ? new Date(dbSettings.lastAlertReset) : now;
      const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
      sessionAlertCount = hoursSinceReset >= 24 ? 0 : (dbSettings.dailyAlertCount || 0);
    }

    if (settings.alertsEnabled === false) {
      const pausedStream = new ReadableStream({
        start(controller) {
          const encode = (chunk: string) => new TextEncoder().encode(chunk);
          controller.enqueue(encode(sseEvent("paused", { message: "Alerts are paused" })));
          const heartbeat = setInterval(() => {
            try {
              controller.enqueue(encode(sseEvent("heartbeat", { t: Date.now(), paused: true })));
            } catch {
              clearInterval(heartbeat);
            }
          }, 15000);
          req.signal.addEventListener("abort", () => {
            clearInterval(heartbeat);
            try { controller.close(); } catch {}
          });
        },
      });
      return new NextResponse(pausedStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }
  } else {
    const cookieHeader = req.headers.get("cookie");
    const guestPatch = getGuestSettingsPatchFromCookieHeader(cookieHeader);
    settings = { ...DEFAULT_USER_SETTINGS, ...guestPatch };
    isPremium = false;
    sessionAlertCount = 0;
  }

  const filters: AlertFilters = {
    minMarketCap: settings.minMarketCap,
    maxMarketCap: settings.maxMarketCap,
    minLiquidity: settings.minLiquidity,
    minHolders: settings.minHolders,
    dexBoostEnabled: settings.dexBoostEnabled,
    dexListingEnabled: settings.dexListingEnabled,
  };

  let localAlertCount = sessionAlertCount;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const encode = (chunk: string) => new TextEncoder().encode(chunk);

      const safeEnqueue = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encode(data));
        } catch {
          closed = true;
        }
      };

      safeEnqueue(sseEvent("connected", { t: Date.now(), isPremium, dailyUsed: localAlertCount, dailyLimit: isPremium ? null : DAILY_ALERT_LIMIT }));

      const existingAlerts = getAlerts().filter(a => alertMatchesFilters(a, filters));
      if (existingAlerts.length > 0) {
        safeEnqueue(sseEvent("init", existingAlerts));
      }

      const onNewAlert = (alert: StoredAlert) => {
        if (closed) return;

        if (!isPremium && localAlertCount >= DAILY_ALERT_LIMIT) {
          safeEnqueue(sseEvent("quota_reached", { limit: DAILY_ALERT_LIMIT, used: localAlertCount }));
          return;
        }

        if (!alertMatchesFilters(alert, filters)) return;

        localAlertCount++;
        if (userId) {
          incrementDailyCount(userId).catch(() => null);
        }

        safeEnqueue(sseEvent("alert", alert));
      };

      alertEmitter.on("alert", onNewAlert);

      const heartbeat = setInterval(() => {
        safeEnqueue(sseEvent("heartbeat", { t: Date.now() }));
      }, 15000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        alertEmitter.off("alert", onNewAlert);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
