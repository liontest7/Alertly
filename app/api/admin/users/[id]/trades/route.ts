import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await requireAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ trades: [], summary: {} });
}
