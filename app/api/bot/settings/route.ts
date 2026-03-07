import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEnv } from "@/lib/env";

const INTERNAL_API_KEY = requireEnv("INTERNAL_API_KEY", {
  allowInDev: true,
  devFallback: "dev-internal-api-key",
});

function isAuthorized(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  return auth.replace("Bearer ", "") === INTERNAL_API_KEY;
}

function sanitizeUpdate(input: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  if (typeof input.autoTrade === "boolean") output.autoTrade = input.autoTrade;
  if (typeof input.buyAmount === "number" && input.buyAmount > 0) output.buyAmount = input.buyAmount;
  if (typeof input.slippage === "number" && input.slippage >= 0 && input.slippage <= 100) output.slippage = input.slippage;
  if (typeof input.stopLoss === "number" && input.stopLoss <= 0 && input.stopLoss >= -100) output.stopLoss = input.stopLoss;
  if (typeof input.takeProfit === "number" && input.takeProfit > 0 && input.takeProfit <= 1000) output.takeProfit = input.takeProfit;
  if (typeof input.minMarketCap === "number" && input.minMarketCap >= 0) output.minMarketCap = input.minMarketCap;
  if (typeof input.maxMarketCap === "number" && input.maxMarketCap >= 0) output.maxMarketCap = input.maxMarketCap;
  if (typeof input.minHolders === "number" && input.minHolders >= 0) output.minHolders = Math.floor(input.minHolders);
  if (Array.isArray(input.sources)) output.sources = input.sources.filter((v) => typeof v === "string");
  return output;
}

async function resolveUserIdByTelegramId(telegramId: string) {
  const link = await prisma.telegramLink.findUnique({ where: { telegramId } });
  return link?.userId;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const telegramId = searchParams.get("telegramId");
  if (!telegramId) return NextResponse.json({ message: "telegramId is required" }, { status: 400 });

  const userId = await resolveUserIdByTelegramId(telegramId);
  if (!userId) return NextResponse.json({ message: "Telegram user not linked" }, { status: 404 });

  const settings = await prisma.userSetting.findUnique({ where: { userId } });
  return NextResponse.json(
    settings ?? {
      autoTrade: true,
      buyAmount: 0.5,
      slippage: 15,
      stopLoss: -30,
      takeProfit: 100,
      minMarketCap: 100000,
      maxMarketCap: 50000000,
      minHolders: 100,
      sources: ["Raydium", "Jupiter"],
    },
  );
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const telegramId = String(body.telegramId || "");
  if (!telegramId) return NextResponse.json({ message: "telegramId is required" }, { status: 400 });

  const userId = await resolveUserIdByTelegramId(telegramId);
  if (!userId) return NextResponse.json({ message: "Telegram user not linked" }, { status: 404 });

  const update = sanitizeUpdate(body);
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ message: "No valid settings provided" }, { status: 400 });
  }

  const saved = await prisma.userSetting.upsert({
    where: { userId },
    create: { userId, ...update },
    update,
  });

  return NextResponse.json(saved);
}
