import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SettingsPayload = {
  autoTrade?: boolean;
  buyAmount?: number;
  maxBuyPerToken?: number;
  slippage?: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: boolean;
  autoSellMinutes?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  minHolders?: number;
  minLiquidity?: number;
  volumeSpikeEnabled?: boolean;
  whaleAlertEnabled?: boolean;
  dexBoostEnabled?: boolean;
  dexListingEnabled?: boolean;
  sources?: string[];
};

function sanitizeSettings(input: SettingsPayload) {
  const output: SettingsPayload = {};

  if (typeof input.autoTrade === "boolean") output.autoTrade = input.autoTrade;
  if (typeof input.buyAmount === "number" && input.buyAmount > 0) output.buyAmount = input.buyAmount;
  if (typeof input.maxBuyPerToken === "number" && input.maxBuyPerToken > 0) output.maxBuyPerToken = input.maxBuyPerToken;
  if (typeof input.slippage === "number" && input.slippage >= 0 && input.slippage <= 100) output.slippage = input.slippage;
  if (typeof input.stopLoss === "number") output.stopLoss = input.stopLoss;
  if (typeof input.takeProfit === "number") output.takeProfit = input.takeProfit;
  if (typeof input.trailingStop === "boolean") output.trailingStop = input.trailingStop;
  if (typeof input.autoSellMinutes === "number") output.autoSellMinutes = Math.floor(input.autoSellMinutes);
  if (typeof input.minMarketCap === "number" && input.minMarketCap >= 0) output.minMarketCap = input.minMarketCap;
  if (typeof input.maxMarketCap === "number" && input.maxMarketCap >= 0) output.maxMarketCap = input.maxMarketCap;
  if (typeof input.minHolders === "number" && input.minHolders >= 0) output.minHolders = Math.floor(input.minHolders);
  if (typeof input.minLiquidity === "number" && input.minLiquidity >= 0) output.minLiquidity = input.minLiquidity;
  if (typeof input.volumeSpikeEnabled === "boolean") output.volumeSpikeEnabled = input.volumeSpikeEnabled;
  if (typeof input.whaleAlertEnabled === "boolean") output.whaleAlertEnabled = input.whaleAlertEnabled;
  if (typeof input.dexBoostEnabled === "boolean") output.dexBoostEnabled = input.dexBoostEnabled;
  if (typeof input.dexListingEnabled === "boolean") output.dexListingEnabled = input.dexListingEnabled;
  if (Array.isArray(input.sources)) {
    output.sources = input.sources.filter((value) => typeof value === "string");
  }

  return output;
}

export async function GET(req: Request) {
  const session = await auth(req);

  const defaultSettings = {
    autoTrade: false,
    buyAmount: 0.5,
    maxBuyPerToken: 2.0,
    slippage: 10,
    stopLoss: 25,
    takeProfit: 50,
    trailingStop: false,
    autoSellMinutes: 0,
    minMarketCap: 10000,
    maxMarketCap: 10000000,
    minHolders: 100,
    minLiquidity: 50000,
    volumeSpikeEnabled: true,
    whaleAlertEnabled: true,
    dexBoostEnabled: true,
    dexListingEnabled: true,
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
      sources: sanitized.sources ?? ["Raydium", "Jupiter"],
    },
    update: sanitized,
  });

  return NextResponse.json(saved);
}
