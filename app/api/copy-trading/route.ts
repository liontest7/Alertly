import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function normalizeAddress(value: string) {
  return value.trim();
}

export async function GET(req: Request) {
  const session = await auth(req);
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const traders = await prisma.copyTrader.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(traders);
}

export async function POST(req: Request) {
  const session = await auth(req);
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { address, buyAmount, enabled } = await req.json();

  if (typeof address !== "string" || !SOLANA_ADDRESS_REGEX.test(normalizeAddress(address))) {
    return NextResponse.json({ message: "Valid trader address required" }, { status: 400 });
  }

  const normalizedBuyAmount =
    typeof buyAmount === "number" && Number.isFinite(buyAmount) && buyAmount > 0 ? buyAmount : 0.5;

  const trader = await prisma.copyTrader.upsert({
    where: {
      userId_traderAddress: {
        userId: session.user.id,
        traderAddress: normalizeAddress(address),
      },
    },
    create: {
      userId: session.user.id,
      traderAddress: normalizeAddress(address),
      buyAmount: normalizedBuyAmount,
      enabled: typeof enabled === "boolean" ? enabled : true,
    },
    update: {
      buyAmount: normalizedBuyAmount,
      enabled: typeof enabled === "boolean" ? enabled : true,
    },
  });

  return NextResponse.json(trader);
}

export async function DELETE(req: Request) {
  const session = await auth(req);
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const address = normalizeAddress(searchParams.get("address") || "");

  if (!SOLANA_ADDRESS_REGEX.test(address)) {
    return NextResponse.json({ message: "Valid trader address required" }, { status: 400 });
  }

  const existing = await prisma.copyTrader.findUnique({
    where: {
      userId_traderAddress: {
        userId: session.user.id,
        traderAddress: address,
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ success: true, address, deleted: false });
  }

  await prisma.copyTrader.delete({
    where: {
      userId_traderAddress: {
        userId: session.user.id,
        traderAddress: address,
      },
    },
  });

  return NextResponse.json({ success: true, address, deleted: true });
}
