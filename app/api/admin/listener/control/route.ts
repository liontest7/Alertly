import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { getListenerStatus, startBlockchainListener, stopBlockchainListener } from "@/lib/listeners/blockchain-listener";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireAdmin(req);
  if (!access.ok) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  return NextResponse.json(getListenerStatus());
}

export async function POST(req: Request) {
  const access = await requireAdmin(req);
  if (!access.ok) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { action } = await req.json();
  if (action === "start") {
    await startBlockchainListener();
  } else if (action === "stop") {
    await stopBlockchainListener();
  }
  return NextResponse.json(getListenerStatus());
}
