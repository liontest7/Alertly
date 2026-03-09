import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/access";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const note = typeof body.note === "string" ? body.note : null;

  const data: { isBanned?: boolean; isFrozen?: boolean; adminNote?: string | null } = {};
  if (action === "ban") data.isBanned = true;
  if (action === "unban") data.isBanned = false;
  if (action === "freeze") data.isFrozen = true;
  if (action === "unfreeze") data.isFrozen = false;
  if (action === "note") {
    data.adminNote = note;
  } else if (note !== null) {
    data.adminNote = note;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
    select: {
      id: true,
      walletAddress: true,
      isBanned: true,
      isFrozen: true,
      adminNote: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ success: true, user: updated });
}
