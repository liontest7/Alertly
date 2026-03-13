import { getEnv } from "@/lib/env";
import { calculateRiskScore } from "@/lib/risk/scorer";
import { broadcastAlertToTelegram } from "@/lib/notifications/telegram";
import { pushAlert } from "@/lib/alert-store";
import { getTokenMeta } from "@/lib/token-metadata";

export type AlertKind = "DEX_BOOST" | "DEX_LISTING";

let listenerRunning = false;
let listenerStartedAt: number | null = null;

const BOOST_POLL_INTERVAL_MS = 25_000;
const LISTING_POLL_INTERVAL_MS = 30_000;
const BOOST_FINGERPRINT_RESET_MS = 4 * 60 * 60 * 1000;

const seenBoostFingerprints = new Set<string>();
const seenListingFingerprints = new Set<string>();

let boostPollerTimer: ReturnType<typeof setTimeout> | null = null;
let listingPollerTimer: ReturnType<typeof setTimeout> | null = null;
let boostFingerprintResetTimer: ReturnType<typeof setInterval> | null = null;
let boostLatestPollerTimer: ReturnType<typeof setInterval> | null = null;

function isPotentialPublicKey(value: string): boolean {
  if (!value) return false;
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  if (/[A-Z]{6,}/.test(value)) return false;
  if (/(.)\1{5,}/.test(value)) return false;
  return true;
}

async function processTokenAlert(
  addr: string,
  type: AlertKind,
  dex: string,
  alertedAt: Date,
) {
  if (!isPotentialPublicKey(addr)) return;

  const risk = calculateRiskScore({
    address: addr,
    holders: undefined,
    mintAuthority: null,
    freezeAuthority: null,
    lpLockedPct: 80,
  });

  const fingerprint = `${addr}|${type}`;
  const alertData = {
    fingerprint,
    address: addr,
    type,
    name: "Loading...",
    symbol: null as string | null,
    change: "0%",
    trend: "neutral" as string,
    mc: "N/A",
    vol: "N/A",
    liquidity: "N/A",
    holders: 0,
    imageUrl: null as string | null,
    dexUrl: `https://dexscreener.com/solana/${addr}`,
    alertedAt,
    riskScore: risk.score,
    riskLevel: risk.level,
    pairAddress: addr,
    priceUsd: null as string | null,
    website: null as string | null,
    twitter: null as string | null,
    telegram: null as string | null,
    dex,
  };

  pushAlert(alertData);

  getTokenMeta(addr).then((meta) => {
    if (!meta) return;
    const change = meta.change24h || "0%";
    const enriched = {
      ...alertData,
      name: meta.name || "Unknown Token",
      symbol: meta.symbol || null,
      imageUrl: meta.imageUrl || null,
      mc: meta.mc || "N/A",
      vol: meta.volume24h || "N/A",
      liquidity: meta.liquidity || "N/A",
      priceUsd: meta.priceUsd || null,
      change,
      trend: (change.startsWith("+") ? "up" : change.startsWith("-") ? "down" : "neutral") as string,
      pairAddress: meta.pairAddress || addr,
      dexUrl: `https://dexscreener.com/solana/${meta.pairAddress || addr}`,
      website: meta.website || null,
      twitter: meta.twitter || null,
      telegram: meta.telegram || null,
    };
    pushAlert(enriched);

    broadcastAlertToTelegram({
      address: addr,
      pairAddress: meta.pairAddress || undefined,
      type,
      name: meta.name || "Unknown Token",
      symbol: meta.symbol || undefined,
      mc: meta.mc || "N/A",
      liquidity: meta.liquidity || "N/A",
      vol: meta.volume24h || "N/A",
      alertedAt,
      imageUrl: meta.imageUrl || undefined,
    }).catch(() => null);
  }).catch(() => null);
}

async function pollDexBoostsTop() {
  if (!listenerRunning) return;
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/top/v1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return;

    const data: unknown = await res.json();
    const boosts: any[] = Array.isArray(data) ? data : [];

    const newBoosts: Array<{ addr: string; reason: string; index: number }> = [];

    for (let i = 0; i < boosts.length; i++) {
      const boost = boosts[i];
      if (boost.chainId !== "solana") continue;
      const addr = boost.tokenAddress as string | undefined;
      if (!addr || !isPotentialPublicKey(addr)) continue;

      const fingerprint = `${addr}|DEX_BOOST|top`;
      if (seenBoostFingerprints.has(fingerprint)) continue;
      seenBoostFingerprints.add(fingerprint);

      const totalAmount = boost.totalAmount ?? boost.amount;
      newBoosts.push({ addr, reason: `Top boost${totalAmount ? ` — ${totalAmount} units` : ""}`, index: i });
    }

    const now = Date.now();
    for (let j = newBoosts.length - 1; j >= 0; j--) {
      const { addr, reason } = newBoosts[j];
      const alertedAt = new Date(now - j * 1000);
      processTokenAlert(addr, "DEX_BOOST", "DexScreener", alertedAt).catch(() => null);
    }
  } catch {
  } finally {
    if (listenerRunning) {
      boostPollerTimer = setTimeout(pollDexBoostsTop, BOOST_POLL_INTERVAL_MS);
    }
  }
}

async function pollDexBoostsLatest() {
  if (!listenerRunning) return;
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/latest/v1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return;

    const data: unknown = await res.json();
    const boosts: any[] = Array.isArray(data) ? data : [];

    const newBoosts: Array<{ addr: string; reason: string; index: number }> = [];

    for (let i = 0; i < boosts.length; i++) {
      const boost = boosts[i];
      if (boost.chainId !== "solana") continue;
      const addr = boost.tokenAddress as string | undefined;
      if (!addr || !isPotentialPublicKey(addr)) continue;

      const fingerprint = `${addr}|DEX_BOOST|latest`;
      if (seenBoostFingerprints.has(fingerprint)) continue;
      seenBoostFingerprints.add(fingerprint);

      const totalAmount = boost.totalAmount ?? boost.amount;
      newBoosts.push({ addr, reason: `New boost payment${totalAmount ? ` — ${totalAmount} units` : ""}`, index: i });
    }

    const now = Date.now();
    for (let j = newBoosts.length - 1; j >= 0; j--) {
      const { addr, reason } = newBoosts[j];
      const alertedAt = new Date(now - j * 1000);
      processTokenAlert(addr, "DEX_BOOST", "DexScreener", alertedAt).catch(() => null);
    }
  } catch {
  }
}

async function pollDexTokenProfiles() {
  if (!listenerRunning) return;
  try {
    const res = await fetch("https://api.dexscreener.com/token-profiles/latest/v1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return;

    const data: unknown = await res.json();
    const profiles: any[] = Array.isArray(data) ? data : [];

    const newProfiles: Array<{ addr: string; index: number }> = [];

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      if (profile.chainId !== "solana") continue;
      const addr = profile.tokenAddress as string | undefined;
      if (!addr || !isPotentialPublicKey(addr)) continue;

      const fingerprint = `${addr}|DEX_LISTING`;
      if (seenListingFingerprints.has(fingerprint)) continue;
      seenListingFingerprints.add(fingerprint);

      newProfiles.push({ addr, index: i });
    }

    if (newProfiles.length === 0) return;

    const now = Date.now();
    for (let j = newProfiles.length - 1; j >= 0; j--) {
      const { addr, index } = newProfiles[j];
      const alertedAt = new Date(now - index * 1000);
      processTokenAlert(addr, "DEX_LISTING", "DexScreener", alertedAt).catch(() => null);
    }
  } catch {
  } finally {
    if (listenerRunning) {
      listingPollerTimer = setTimeout(pollDexTokenProfiles, LISTING_POLL_INTERVAL_MS);
    }
  }
}

export async function startBlockchainListener() {
  if (listenerRunning) return { success: true, message: "Listener already running" };

  try {
    listenerRunning = true;
    listenerStartedAt = Date.now();

    console.log("[Listener] Starting DEX monitors (Boosts + Token Profiles)");

    pollDexBoostsTop().catch(() => null);
    pollDexBoostsLatest().catch(() => null);
    pollDexTokenProfiles().catch(() => null);

    boostLatestPollerTimer = setInterval(() => {
      pollDexBoostsLatest().catch(() => null);
    }, 20_000);

    boostFingerprintResetTimer = setInterval(() => {
      seenBoostFingerprints.clear();
      seenListingFingerprints.clear();
    }, BOOST_FINGERPRINT_RESET_MS);

    return { success: true, message: "Listener started (DEX Boosts + Token Profiles)" };
  } catch (error) {
    listenerRunning = false;
    listenerStartedAt = null;
    console.error("Listener startup error:", error instanceof Error ? error.message : error);
    return { success: false, message: "Listener failed to start" };
  }
}

export async function stopBlockchainListener() {
  listenerRunning = false;
  listenerStartedAt = null;

  if (boostPollerTimer) { clearTimeout(boostPollerTimer); boostPollerTimer = null; }
  if (listingPollerTimer) { clearTimeout(listingPollerTimer); listingPollerTimer = null; }
  if (boostLatestPollerTimer) { clearInterval(boostLatestPollerTimer); boostLatestPollerTimer = null; }
  if (boostFingerprintResetTimer) { clearInterval(boostFingerprintResetTimer); boostFingerprintResetTimer = null; }

  return { success: true, message: "Listener stopped" };
}

export function getListenerStatus() {
  return {
    running: listenerRunning,
    subscriptions: 0,
    uptime: listenerStartedAt ? `${Math.floor((Date.now() - listenerStartedAt) / 1000)}s` : undefined,
    mode: "dexscreener-api-polling",
    monitors: ["DEX Boosts (top + latest)", "DEX Token Profiles (paid listings)"],
  };
}
