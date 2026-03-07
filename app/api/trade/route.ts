import { NextResponse } from "next/server";
import { executeTrade } from "@/lib/blockchain/solana";
import { auth } from "@/lib/auth";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isValidAction(action: unknown): action is "buy" | "sell" {
  return action === "buy" || action === "sell";
}

export async function POST(req: Request) {
  try {
    const session = await auth(req);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, tokenAddress, amount, slippage } = body;

    if (!isValidAction(action)) {
      return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }

    if (typeof tokenAddress !== "string" || !SOLANA_ADDRESS_REGEX.test(tokenAddress)) {
      return NextResponse.json({ success: false, message: "Invalid token address" }, { status: 400 });
    }

    if (typeof amount !== "number" || amount <= 0 || amount > 1000) {
      return NextResponse.json({ success: false, message: "Invalid trade amount" }, { status: 400 });
    }

    const normalizedSlippage =
      typeof slippage === "number" && slippage >= 0 && slippage <= 100 ? slippage : 1.0;

    const result = await executeTrade({
      userId: session.user.id,
      action,
      tokenAddress,
      amount,
      slippage: normalizedSlippage,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Trade API error", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
