import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTradingWallet } from "@/lib/blockchain/trading-wallet";

export async function POST(req: Request) {
  const session = await auth(req);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const wallet = await createTradingWallet(session.user.id);
    return NextResponse.json({
      address: wallet.walletAddress,
      createdAt: wallet.createdAt
    });
  } catch (error) {
    console.error("Failed to generate trading wallet:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
