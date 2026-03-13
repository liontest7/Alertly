import { NextResponse } from "next/server";
import { getListenerStatus } from "@/lib/listeners/blockchain-listener";
import { getAlertCount } from "@/lib/alert-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const listener = getListenerStatus();
  return NextResponse.json({
    ok: true,
    status: "healthy",
    listener: listener.running ? "running" : "stopped",
    alertsBuffered: getAlertCount(),
    ts: new Date().toISOString(),
  });
}
