import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await auth(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trades = await prisma.tradeExecutionLog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        tokenAddress: true,
        alertType: true,
        action: true,
        amount: true,
        slippage: true,
        status: true,
        txSig: true,
        message: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ trades });
  } catch (error) {
    console.error("Trade history error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
