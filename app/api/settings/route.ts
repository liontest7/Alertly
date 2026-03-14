import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { DEFAULT_USER_SETTINGS } from "@/lib/settings/defaults";
import { getUserSettings, setGuestSettings, GuestSettings } from "@/lib/guest-session";

export const dynamic = "force-dynamic";

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
  dexBoostEnabled?: boolean;
  dexListingEnabled?: boolean;
  selectedBoostLevel?: string;
  alertsEnabled?: boolean;
};

function sanitizeSettings(input: SettingsPayload): GuestSettings {
  const output: GuestSettings = {};
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
  if (typeof input.dexBoostEnabled === "boolean") output.dexBoostEnabled = input.dexBoostEnabled;
  if (typeof input.dexListingEnabled === "boolean") output.dexListingEnabled = input.dexListingEnabled;
  if (typeof input.selectedBoostLevel === "string") output.selectedBoostLevel = input.selectedBoostLevel;
  if (typeof input.alertsEnabled === "boolean") output.alertsEnabled = input.alertsEnabled;
  return output;
}

export async function GET(req: Request) {
  const session = await auth(req);
  const authenticated = !!session?.user;
  const cookieStore = cookies();
  const settings = getUserSettings(cookieStore, authenticated);
  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  const session = await auth(req);
  const authenticated = !!session?.user;
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

  const cookieStore = cookies();
  const existing = getUserSettings(cookieStore, authenticated);
  const merged = { ...existing, ...sanitized };
  if (!authenticated) merged.autoTrade = false;

  const response = NextResponse.json(merged);
  setGuestSettings(response, merged, authenticated);
  return response;
}
