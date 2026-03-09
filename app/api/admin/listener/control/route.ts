import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { getListenerStatus, startBlockchainListener, stopBlockchainListener } from "@/lib/listeners/blockchain-listener";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const access = await requireAdmin(req);
  if (!access.ok) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "start") {
    await startBlockchainListener();
  } else if (action === "stop") {
    await stopBlockchainListener();
  } else if (action === "restart") {
    await stopBlockchainListener().catch(() => null);
    await startBlockchainListener();
  } else {
    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  }

  const status = getListenerStatus();

  await prisma.listenerStatus.upsert({
    where: { name: "blockchain-listener" },
    create: {
      name: "blockchain-listener",
      running: status.running,
      subscriptions: status.subscriptions,
    },
    update: {
      running: status.running,
      subscriptions: status.subscriptions,
      lastEventAt: new Date(),
    },
  }).catch(() => null);

  return NextResponse.json({ success: true, status });
}
