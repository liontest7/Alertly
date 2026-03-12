import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { DEFAULT_USER_SETTINGS } from "@/lib/settings/defaults";
import {
  clearGuestCookies,
  getGuestSettings,
  getGuestSettingsPatch,
  setGuestSettings,
} from "@/lib/guest-session";

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
  volumeSpikeThreshold?: number;
  whaleAlertEnabled?: boolean;
  whaleMinSolBalance?: number;
  whaleWalletAddresses?: string[];
  dexBoostEnabled?: boolean;
  dexListingEnabled?: boolean;
  sources?: string[];
  selectedBoostLevel?: string;
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
  if (typeof input.volumeSpikeThreshold === "number" && input.volumeSpikeThreshold > 0) output.volumeSpikeThreshold = input.volumeSpikeThreshold;
  if (typeof input.whaleAlertEnabled === "boolean") output.whaleAlertEnabled = input.whaleAlertEnabled;
  if (typeof input.whaleMinSolBalance === "number" && input.whaleMinSolBalance >= 0) output.whaleMinSolBalance = input.whaleMinSolBalance;
  if (Array.isArray(input.whaleWalletAddresses)) {
    output.whaleWalletAddresses = input.whaleWalletAddresses.filter((value) => typeof value === "string");
  }
  if (typeof input.dexBoostEnabled === "boolean") output.dexBoostEnabled = input.dexBoostEnabled;
  if (typeof input.dexListingEnabled === "boolean") output.dexListingEnabled = input.dexListingEnabled;
  if (Array.isArray(input.sources)) {
    output.sources = input.sources.filter((value) => typeof value === "string");
  }
  if (typeof input.selectedBoostLevel === "string") output.selectedBoostLevel = input.selectedBoostLevel;

  return output;
}

export async function GET(req: Request) {
  const session = await auth(req);
  const cookieStore = cookies();

  if (!session?.user?.id) {
    const guest = getGuestSettings(cookieStore);
    return NextResponse.json(guest);
  }

  const settings = await prisma.userSetting.findUnique({
    where: { userId: session.user.id },
  });

  if (settings) {
    return NextResponse.json(settings);
  }

  const guestPatch = getGuestSettingsPatch(cookieStore);
  if (Object.keys(guestPatch).length > 0) {
    const migrated = await prisma.userSetting.create({
      data: {
        userId: session.user.id,
        ...guestPatch,
        sources: guestPatch.sources ?? DEFAULT_USER_SETTINGS.sources,
      },
    });

    const response = NextResponse.json({ ...migrated, migratedFromGuest: true });
    clearGuestCookies(response);
    return response;
  }

  return NextResponse.json(DEFAULT_USER_SETTINGS);
}

export async function POST(req: Request) {
  const session = await auth(req);
  const body = (await req.json()) as SettingsPayload;
  const sanitized = sanitizeSettings(body);

  if (Object.keys(sanitized).length === 0) {
    return NextResponse.json({ message: "No valid settings provided" }, { status: 400 });
  }

  if (
    typeof sanitized.minMarketCap === "number" &&
    typeof sanitized.maxMarketCap === "number" &&
    sanitized.maxMarketCap > 0 &&
    sanitized.maxMarketCap < sanitized.minMarketCap
  ) {
    return NextResponse.json({ message: "maxMarketCap must be greater than minMarketCap" }, { status: 400 });
  }

  if (!session?.user?.id) {
    const response = NextResponse.json({ ...DEFAULT_USER_SETTINGS, ...sanitized, autoTrade: false });
    setGuestSettings(response, sanitized);
    return response;
  }

  const saved = await prisma.userSetting.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      ...sanitized,
      sources: sanitized.sources ?? DEFAULT_USER_SETTINGS.sources,
    },
    update: sanitized,
  });

  const response = NextResponse.json(saved);
  clearGuestCookies(response);
  return response;
}
