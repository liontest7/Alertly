import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveAlerts } from "@/lib/blockchain/solana";
import { alertEmitter } from "@/lib/alert-store";
import { ensureAlertListenerStarted } from "@/lib/alert-listener";
import type { AlertFilterSettings } from "@/lib/blockchain/solana";
import { getGuestSettingsPatchFromCookieHeader } from "@/lib/guest-session";
import { DEFAULT_USER_SETTINGS } from "@/lib/settings/defaults";

export const dynamic = "force-dynamic";

function sseEvent(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

function buildFilters(settings: any): AlertFilterSettings {
  return {
    minMarketCap: settings.minMarketCap,
    maxMarketCap: settings.maxMarketCap,
    minLiquidity: settings.minLiquidity,
    minHolders: settings.minHolders,
    volumeSpikeEnabled: settings.volumeSpikeEnabled,
    whaleAlertEnabled: settings.whaleAlertEnabled,
    dexBoostEnabled: settings.dexBoostEnabled,
    dexListingEnabled: settings.dexListingEnabled,
    volumeSpikeThreshold: settings.volumeSpikeThreshold,
    whaleMinSolBalance: settings.whaleMinSolBalance,
  };
}

export async function GET(req: Request) {
  try {
    await ensureAlertListenerStarted();
  } catch {
    // stream can still work from in-memory store
  }

  const session = await auth(req);
  const userId = session?.user?.id;

  let settings: any = DEFAULT_USER_SETTINGS;

  if (userId) {
    const dbSettings = await prisma.userSetting.findUnique({ where: { userId } }).catch(() => null);
    if (dbSettings) settings = dbSettings;
  } else {
    const cookieHeader = req.headers.get("cookie");
    const guestPatch = getGuestSettingsPatchFromCookieHeader(cookieHeader);
    settings = { ...DEFAULT_USER_SETTINGS, ...guestPatch };
  }

  const filters = buildFilters(settings);

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

      const sendAlerts = async () => {
        if (closed) return;
        try {
          const alerts = await getLiveAlerts(filters);
          safeEnqueue(sseEvent("alerts", alerts));
        } catch {
          safeEnqueue(sseEvent("heartbeat", { t: Date.now() }));
        }
      };

      const onNewAlert = () => {
        sendAlerts();
      };

      alertEmitter.on("alert", onNewAlert);

      sendAlerts();
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
