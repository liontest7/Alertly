import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { getAlerts } from "@/lib/alert-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const alerts = getAlerts().slice(0, 100);

  return NextResponse.json({
    alerts,
    trades: [],
    blockchainEvents: [],
  });
}
