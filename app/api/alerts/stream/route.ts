import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { alertEmitter } from "@/lib/alert-store";
import { ensureAlertListenerStarted } from "@/lib/alert-listener";
import { getGuestSettingsPatchFromCookieHeader } from "@/lib/guest-session";
import { DEFAULT_USER_SETTINGS } from "@/lib/settings/defaults";
import { getLiveAlerts } from "@/lib/blockchain/solana";
import type { AlertFilterSettings } from "@/lib/blockchain/solana";

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
    if (dbSettings && dbSettings.alertsEnabled === false) {
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

      const sendNewAlert = async (newAlerts: any[]) => {
        if (closed) return;
        try {
          const { getLiveAlerts } = await import("@/lib/blockchain/solana");
          const filtered = await getLiveAlerts(filters);
          safeEnqueue(sseEvent("alerts", filtered));
        } catch {
          safeEnqueue(sseEvent("heartbeat", { t: Date.now() }));
        }
      };

      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const onNewAlert = () => {
        if (closed) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          sendNewAlert([]);
        }, 300);
      };

      alertEmitter.on("alert", onNewAlert);

      const heartbeat = setInterval(() => {
        safeEnqueue(sseEvent("heartbeat", { t: Date.now() }));
      }, 15000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        if (debounceTimer) clearTimeout(debounceTimer);
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
