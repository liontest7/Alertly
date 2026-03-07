import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth(req);
    if (!session?.user?.id) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        settings: true,
        walletConnections: true,
        telegramLink: true,
      },
    });

    return NextResponse.json({
      authenticated: true,
      user: {
        walletAddress: user?.walletAddress,
        vipLevel: user?.vipLevel,
        settings: user?.settings,
        wallets: user?.walletConnections,
        telegramLinked: !!user?.telegramLink,
      }
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
