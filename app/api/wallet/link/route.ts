import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await auth(req);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { walletAddress } = await req.json();

    if (!walletAddress) {
      return NextResponse.json({ message: "Missing wallet address" }, { status: 400 });
    }

    const walletConnection = await prisma.walletConnection.upsert({
      where: { walletAddress },
      update: { userId: session.user.id },
      create: {
        userId: session.user.id,
        walletAddress,
      },
    });

    return NextResponse.json({ walletConnection }, { status: 200 });
  } catch (error) {
    console.error("Wallet link error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
