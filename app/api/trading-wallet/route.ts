import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth(req);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const wallet = await prisma.tradingWallet.findUnique({
    where: { userId: session.user.id }
  });

  if (!wallet) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    address: wallet.walletAddress,
    createdAt: wallet.createdAt
  });
}
