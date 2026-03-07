import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SettingsPayload = {
  autoTrade?: boolean;
  buyAmount?: number;
  slippage?: number;
  stopLoss?: number;
  takeProfit?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  minHolders?: number;
  sources?: string[];
};

function sanitizeSettings(input: SettingsPayload) {
  const output: SettingsPayload = {};

  if (typeof input.autoTrade === "boolean") output.autoTrade = input.autoTrade;
  if (typeof input.buyAmount === "number" && input.buyAmount > 0) output.buyAmount = input.buyAmount;
  if (typeof input.slippage === "number" && input.slippage >= 0 && input.slippage <= 100) output.slippage = input.slippage;
  if (typeof input.stopLoss === "number" && input.stopLoss <= 0 && input.stopLoss >= -100) output.stopLoss = input.stopLoss;
  if (typeof input.takeProfit === "number" && input.takeProfit > 0 && input.takeProfit <= 1000) output.takeProfit = input.takeProfit;
  if (typeof input.minMarketCap === "number" && input.minMarketCap >= 0) output.minMarketCap = input.minMarketCap;
  if (typeof input.maxMarketCap === "number" && input.maxMarketCap >= 0) output.maxMarketCap = input.maxMarketCap;
  if (typeof input.minHolders === "number" && input.minHolders >= 0) output.minHolders = Math.floor(input.minHolders);
  if (Array.isArray(input.sources)) {
    output.sources = input.sources.filter((value) => typeof value === "string");
  }

  return output;
}

export async function GET(req: Request) {
  const session = await auth(req);

  const defaultSettings = {
    autoTrade: true,
    buyAmount: 0.5,
    slippage: 15,
    stopLoss: -30,
    takeProfit: 100,
    minMarketCap: 100000,
    maxMarketCap: 50000000,
    minHolders: 100,
    sources: ["Raydium", "Jupiter"],
  };

  if (!session?.user?.id) {
    return NextResponse.json(defaultSettings);
  }

  const settings = await prisma.userSetting.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json(settings ?? defaultSettings);
}

export async function POST(req: Request) {
  const session = await auth(req);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as SettingsPayload;
  const sanitized = sanitizeSettings(body);

  if (Object.keys(sanitized).length === 0) {
    return NextResponse.json({ message: "No valid settings provided" }, { status: 400 });
  }

  if (
    typeof sanitized.minMarketCap === "number" &&
    typeof sanitized.maxMarketCap === "number" &&
    sanitized.maxMarketCap < sanitized.minMarketCap
  ) {
    return NextResponse.json({ message: "maxMarketCap must be greater than minMarketCap" }, { status: 400 });
  }

  const saved = await prisma.userSetting.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      ...sanitized,
    },
    update: sanitized,
  });

  return NextResponse.json(saved);
}
