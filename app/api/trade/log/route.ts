import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const VALID_ACTIONS = new Set(["buy", "sell"])
const VALID_STATUSES = new Set(["success", "failed"])

export async function POST(req: Request) {
  try {
    const session = await auth(req)
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { tokenAddress, alertType, action, amount, slippage, status, txSig, message } = body

    if (
      typeof tokenAddress !== "string" ||
      !tokenAddress ||
      !VALID_ACTIONS.has(action) ||
      !VALID_STATUSES.has(status) ||
      typeof amount !== "number"
    ) {
      return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 })
    }

    await prisma.tradeExecutionLog.create({
      data: {
        userId: session.user.id,
        tokenAddress,
        alertType: alertType || "MANUAL",
        action,
        amount,
        slippage: typeof slippage === "number" ? slippage : 10,
        status,
        txSig: txSig || null,
        message: message || null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[trade/log]", err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
