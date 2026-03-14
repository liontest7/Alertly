import type { NextResponse } from "next/server";
import { DEFAULT_USER_SETTINGS } from "@/lib/settings/defaults";

export const GUEST_SETTINGS_COOKIE = "alertly_guest_settings";
export const GUEST_ALERT_STATE_COOKIE = "alertly_guest_alert_state";
export const GUEST_DAILY_ALERT_LIMIT = 50;

export type GuestSettings = Partial<typeof DEFAULT_USER_SETTINGS>;

type GuestAlertState = {
  day: string;
  seen: string[];
  used: number;
};

type AnyRequestCookies = { get(name: string): { name: string; value: string } | undefined };

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function decodeCookieValue<T>(value?: string): T | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(decodeURIComponent(value), "base64url").toString("utf8");
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

function encodeCookieValue(value: unknown) {
  return encodeURIComponent(Buffer.from(JSON.stringify(value), "utf8").toString("base64url"));
}

function pickAllowedSettings(input: GuestSettings, authenticated: boolean = false): GuestSettings {
  const out: GuestSettings = {};
  if (typeof input.buyAmount === "number" && input.buyAmount > 0) out.buyAmount = input.buyAmount;
  if (typeof input.maxBuyPerToken === "number" && input.maxBuyPerToken > 0) out.maxBuyPerToken = input.maxBuyPerToken;
  if (typeof input.slippage === "number" && input.slippage >= 0 && input.slippage <= 100) out.slippage = input.slippage;
  if (typeof input.stopLoss === "number") out.stopLoss = input.stopLoss;
  if (typeof input.takeProfit === "number") out.takeProfit = input.takeProfit;
  if (typeof input.trailingStop === "boolean") out.trailingStop = input.trailingStop;
  if (typeof input.autoSellMinutes === "number") out.autoSellMinutes = Math.floor(input.autoSellMinutes);
  if (typeof input.minMarketCap === "number" && input.minMarketCap >= 0) out.minMarketCap = input.minMarketCap;
  if (typeof input.maxMarketCap === "number" && input.maxMarketCap >= 0) out.maxMarketCap = input.maxMarketCap;
  if (typeof input.minHolders === "number" && input.minHolders >= 0) out.minHolders = Math.floor(input.minHolders);
  if (typeof input.minLiquidity === "number" && input.minLiquidity >= 0) out.minLiquidity = input.minLiquidity;
  if (typeof input.dexBoostEnabled === "boolean") out.dexBoostEnabled = input.dexBoostEnabled;
  if (typeof input.dexListingEnabled === "boolean") out.dexListingEnabled = input.dexListingEnabled;
  if (typeof input.selectedBoostLevel === "string") out.selectedBoostLevel = input.selectedBoostLevel;
  if (typeof input.alertsEnabled === "boolean") out.alertsEnabled = input.alertsEnabled;
  if (authenticated && typeof input.autoTrade === "boolean") out.autoTrade = input.autoTrade;
  if (!authenticated) out.autoTrade = false;
  return out;
}

function parseCookieHeader(cookieHeader?: string | null) {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const chunk of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = chunk.trim().split("=");
    if (!rawKey) continue;
    map.set(rawKey.trim(), rawValue.join("="));
  }
  return map;
}

export function getSettingsPatch(cookieStore: AnyRequestCookies, authenticated: boolean = false): GuestSettings {
  const decoded = decodeCookieValue<GuestSettings>(cookieStore.get(GUEST_SETTINGS_COOKIE)?.value);
  return pickAllowedSettings(decoded ?? {}, authenticated);
}

export function getGuestSettingsPatch(cookieStore: AnyRequestCookies): GuestSettings {
  return getSettingsPatch(cookieStore, false);
}

export function getGuestSettingsPatchFromCookieHeader(cookieHeader?: string | null): GuestSettings {
  const cookieMap = parseCookieHeader(cookieHeader);
  const decoded = decodeCookieValue<GuestSettings>(cookieMap.get(GUEST_SETTINGS_COOKIE));
  return pickAllowedSettings(decoded ?? {}, false);
}

export function getSettingsPatchFromCookieHeader(cookieHeader?: string | null, authenticated: boolean = false): GuestSettings {
  const cookieMap = parseCookieHeader(cookieHeader);
  const decoded = decodeCookieValue<GuestSettings>(cookieMap.get(GUEST_SETTINGS_COOKIE));
  return pickAllowedSettings(decoded ?? {}, authenticated);
}

export function getGuestSettings(cookieStore: AnyRequestCookies): typeof DEFAULT_USER_SETTINGS {
  const patch = getSettingsPatch(cookieStore, false);
  return { ...DEFAULT_USER_SETTINGS, ...patch, autoTrade: false };
}

export function getUserSettings(cookieStore: AnyRequestCookies, authenticated: boolean = false): typeof DEFAULT_USER_SETTINGS {
  const patch = getSettingsPatch(cookieStore, authenticated);
  return { ...DEFAULT_USER_SETTINGS, ...patch };
}

export function setGuestSettings(response: NextResponse, settings: GuestSettings, authenticated: boolean = false) {
  const sanitized = pickAllowedSettings(settings, authenticated);
  const secure = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
  response.cookies.set(GUEST_SETTINGS_COOKIE, encodeCookieValue(sanitized), {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export function clearGuestCookies(response: NextResponse) {
  const secure = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
  response.cookies.set(GUEST_SETTINGS_COOKIE, "", { httpOnly: false, sameSite: "lax", secure, path: "/", maxAge: 0 });
  response.cookies.set(GUEST_ALERT_STATE_COOKIE, "", { httpOnly: false, sameSite: "lax", secure, path: "/", maxAge: 0 });
}

function getGuestAlertState(cookieStore: AnyRequestCookies): GuestAlertState {
  const parsed = decodeCookieValue<GuestAlertState>(cookieStore.get(GUEST_ALERT_STATE_COOKIE)?.value);
  const today = todayKey();
  if (!parsed || parsed.day !== today) return { day: today, seen: [], used: 0 };
  return {
    day: today,
    seen: Array.isArray(parsed.seen) ? parsed.seen.slice(0, 200) : [],
    used: Number.isFinite(parsed.used) ? Math.max(0, Math.floor(parsed.used)) : 0,
  };
}

export function applyGuestAlertQuota(
  cookieStore: AnyRequestCookies,
  alerts: Array<{ address: string; type: string } & Record<string, unknown>>,
) {
  const state = getGuestAlertState(cookieStore);
  const seenSet = new Set(state.seen);
  let used = state.used;

  const result = alerts.filter((alert) => {
    const fingerprint = `${alert.address}:${alert.type}`;
    if (seenSet.has(fingerprint)) return true;
    if (used >= GUEST_DAILY_ALERT_LIMIT) return false;
    seenSet.add(fingerprint);
    used += 1;
    return true;
  });

  return {
    alerts: result,
    state: { day: state.day, seen: Array.from(seenSet).slice(0, 200), used } satisfies GuestAlertState,
  };
}

export function setGuestAlertState(response: NextResponse, state: { day: string; seen: string[]; used: number }) {
  const secure = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
  response.cookies.set(GUEST_ALERT_STATE_COOKIE, encodeCookieValue(state), {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}
