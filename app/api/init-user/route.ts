import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth(req);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const existingSettings = await prisma.userSetting.findUnique({
      where: { userId },
    });

    if (existingSettings) {
      return NextResponse.json({
        message: "Settings already initialized",
        initialized: true,
      });
    }

    const settings = await prisma.userSetting.create({
      data: {
        userId,
        buyAmount: 0.5,
        maxBuyPerToken: 2.0,
        slippage: 10.0,
        autoTrade: false,
        minMarketCap: 10000,
        maxMarketCap: 10000000,
        minHolders: 100,
        minLiquidity: 50000,
        takeProfit: 50,
        stopLoss: 25,
        trailingStop: false,
        autoSellMinutes: 0,
        volumeSpikeEnabled: true,
        whaleAlertEnabled: true,
        dexBoostEnabled: true,
        dexListingEnabled: true,
      },
    });

    console.log(`[init-user] Initialized settings for user ${userId}`);

    return NextResponse.json({
      message: "Settings initialized successfully",
      initialized: true,
      settings,
    });
  } catch (error) {
    console.error("Init user error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { message: "Failed to initialize user settings", error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
