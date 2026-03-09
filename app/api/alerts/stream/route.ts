import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveAlerts } from "@/lib/blockchain/solana";
import { ensureAlertListenerStarted } from "@/lib/alert-listener";

export const dynamic = "force-dynamic";

function sseEvent(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: Request) {
  try {
    await ensureAlertListenerStarted();
  } catch {
    // stream can still work from persisted alerts.
  }

  const session = await auth(req);
  const userId = session?.user?.id;

  let filters;
  if (userId) {
    const settings = await prisma.userSetting.findUnique({ where: { userId } });
    if (settings) {
      filters = {
        minMarketCap: settings.minMarketCap,
        maxMarketCap: settings.maxMarketCap,
        minLiquidity: settings.minLiquidity,
        minHolders: settings.minHolders,
        volumeSpikeEnabled: settings.volumeSpikeEnabled,
        whaleAlertEnabled: settings.whaleAlertEnabled,
        dexBoostEnabled: settings.dexBoostEnabled,
        dexListingEnabled: settings.dexListingEnabled,
      };
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      let lastFingerprint = "";

      const push = async () => {
        const alerts = await getLiveAlerts(filters);
        const top = alerts[0];
        const fingerprint = top?.fingerprint || "";

        if (fingerprint && fingerprint !== lastFingerprint) {
          lastFingerprint = fingerprint;
          controller.enqueue(new TextEncoder().encode(sseEvent("alerts", alerts)));
          return;
        }

        controller.enqueue(new TextEncoder().encode(sseEvent("heartbeat", { t: Date.now() })));
      };

      push();
      const interval = setInterval(push, 2000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
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
