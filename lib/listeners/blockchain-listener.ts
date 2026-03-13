import { getEnv } from "@/lib/env";
import { calculateRiskScore } from "@/lib/risk/scorer";
import { broadcastAlertToTelegram } from "@/lib/notifications/telegram";
import { pushAlert } from "@/lib/alert-store";
import { getTokenMeta } from "@/lib/token-metadata";

export type AlertKind = "DEX_BOOST" | "DEX_LISTING";

let listenerRunning = false;
let listenerStartedAt: number | null = null;

const BOOST_TOP_POLL_MS = 6_000;
const BOOST_LATEST_POLL_MS = 5_000;
const LISTING_POLL_MS = 6_000;
const BOOST_FINGERPRINT_RESET_MS = 4 * 60 * 60 * 1000;
const RATE_LIMIT_BACKOFF_MS = 15_000;

const seenBoostFingerprints = new Set<string>();
const seenListingFingerprints = new Set<string>();

let boostTopTimer: ReturnType<typeof setTimeout> | null = null;
let boostLatestTimer: ReturnType<typeof setTimeout> | null = null;
let listingTimer: ReturnType<typeof setTimeout> | null = null;
let fingerprintResetTimer: ReturnType<typeof setInterval> | null = null;

let globalRateLimitedUntil = 0;

function isRateLimited(): boolean {
  return Date.now() < globalRateLimitedUntil;
}

function setRateLimited() {
  globalRateLimitedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
  console.warn(`[Listener] Rate limited by DexScreener — backing off ${RATE_LIMIT_BACKOFF_MS / 1000}s`);
}

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
  boostAmount?: number,
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
    boostAmount,
    dex,
  };

  pushAlert(alertData);

  getTokenMeta(addr)
    .then((meta) => {
      if (!meta) {
        console.warn(`[Listener] No metadata for ${addr.slice(0, 8)}… — broadcasting with partial data`);
        broadcastAlertToTelegram({
          address: addr,
          type,
          name: `Token ${addr.slice(0, 8)}…`,
          mc: "N/A",
          liquidity: "N/A",
          vol: "N/A",
          alertedAt,
          boostAmount,
        }).catch(() => null);
        return;
      }

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
        boostAmount,
      }).catch((err) => {
        console.error(`[Listener] Telegram broadcast failed for ${addr.slice(0, 8)}…:`, err instanceof Error ? err.message : err);
      });
    })
    .catch((err) => {
      console.error(`[Listener] Token metadata fetch failed for ${addr.slice(0, 8)}…:`, err instanceof Error ? err.message : err);
    });
}

async function pollDexBoostsTop() {
  if (!listenerRunning) return;
  if (isRateLimited()) {
    const waitMs = globalRateLimitedUntil - Date.now() + 500;
    boostTopTimer = setTimeout(pollDexBoostsTop, waitMs);
    return;
  }
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/top/v1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });

    if (res.status === 429 || res.status === 1015) {
      setRateLimited();
      return;
    }

    if (!res.ok) {
      console.warn(`[Listener] DexScreener top boosts returned HTTP ${res.status}`);
      return;
    }

    const data: unknown = await res.json();
    const boosts: any[] = Array.isArray(data) ? data : [];
    const newBoosts: Array<{ addr: string; boostAmount?: number; index: number }> = [];

    for (let i = 0; i < boosts.length; i++) {
      const boost = boosts[i];
      if (boost?.chainId !== "solana") continue;
      const addr = boost.tokenAddress as string | undefined;
      if (!addr || !isPotentialPublicKey(addr)) continue;

      const fingerprint = `${addr}|DEX_BOOST|top`;
      if (seenBoostFingerprints.has(fingerprint)) continue;
      seenBoostFingerprints.add(fingerprint);

      const totalAmount = boost.totalAmount ?? boost.amount;
      newBoosts.push({ addr, index: i, boostAmount: totalAmount != null ? Number(totalAmount) : undefined });
    }

    if (newBoosts.length > 0) {
      console.log(`[Listener] Top boosts: ${newBoosts.length} new (${boosts.length} total on Solana)`);
    }

    const now = Date.now();
    for (let j = newBoosts.length - 1; j >= 0; j--) {
      const { addr, boostAmount } = newBoosts[j];
      const alertedAt = new Date(now - j * 1000);
      processTokenAlert(addr, "DEX_BOOST", "DexScreener", alertedAt, boostAmount).catch(() => null);
    }
  } catch (err) {
    console.error("[Listener] pollDexBoostsTop error:", err instanceof Error ? err.message : err);
  } finally {
    if (listenerRunning) {
      boostTopTimer = setTimeout(pollDexBoostsTop, BOOST_TOP_POLL_MS);
    }
  }
}

async function pollDexBoostsLatest() {
  if (!listenerRunning) return;
  if (isRateLimited()) {
    const waitMs = globalRateLimitedUntil - Date.now() + 500;
    boostLatestTimer = setTimeout(pollDexBoostsLatest, waitMs);
    return;
  }
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/latest/v1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });

    if (res.status === 429 || res.status === 1015) {
      setRateLimited();
      return;
    }

    if (!res.ok) {
      console.warn(`[Listener] DexScreener latest boosts returned HTTP ${res.status}`);
      return;
    }

    const data: unknown = await res.json();
    const boosts: any[] = Array.isArray(data) ? data : [];
    const newBoosts: Array<{ addr: string; boostAmount?: number; index: number }> = [];

    for (let i = 0; i < boosts.length; i++) {
      const boost = boosts[i];
      if (boost?.chainId !== "solana") continue;
      const addr = boost.tokenAddress as string | undefined;
      if (!addr || !isPotentialPublicKey(addr)) continue;

      const fingerprint = `${addr}|DEX_BOOST|latest`;
      if (seenBoostFingerprints.has(fingerprint)) continue;
      seenBoostFingerprints.add(fingerprint);

      const totalAmount = boost.totalAmount ?? boost.amount;
      newBoosts.push({ addr, index: i, boostAmount: totalAmount != null ? Number(totalAmount) : undefined });
    }

    if (newBoosts.length > 0) {
      console.log(`[Listener] Latest boosts: ${newBoosts.length} new (${boosts.length} total on Solana)`);
    }

    const now = Date.now();
    for (let j = newBoosts.length - 1; j >= 0; j--) {
      const { addr, boostAmount } = newBoosts[j];
      const alertedAt = new Date(now - j * 1000);
      processTokenAlert(addr, "DEX_BOOST", "DexScreener", alertedAt, boostAmount).catch(() => null);
    }
  } catch (err) {
    console.error("[Listener] pollDexBoostsLatest error:", err instanceof Error ? err.message : err);
  } finally {
    if (listenerRunning) {
      boostLatestTimer = setTimeout(pollDexBoostsLatest, BOOST_LATEST_POLL_MS);
    }
  }
}

async function pollDexTokenProfiles() {
  if (!listenerRunning) return;
  if (isRateLimited()) {
    const waitMs = globalRateLimitedUntil - Date.now() + 500;
    listingTimer = setTimeout(pollDexTokenProfiles, waitMs);
    return;
  }
  try {
    const res = await fetch("https://api.dexscreener.com/token-profiles/latest/v1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });

    if (res.status === 429 || res.status === 1015) {
      setRateLimited();
      return;
    }

    if (!res.ok) {
      console.warn(`[Listener] DexScreener token profiles returned HTTP ${res.status}`);
      return;
    }

    const data: unknown = await res.json();
    const profiles: any[] = Array.isArray(data) ? data : [];
    const newProfiles: Array<{ addr: string; index: number }> = [];

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      if (profile?.chainId !== "solana") continue;
      const addr = profile.tokenAddress as string | undefined;
      if (!addr || !isPotentialPublicKey(addr)) continue;

      const fingerprint = `${addr}|DEX_LISTING`;
      if (seenListingFingerprints.has(fingerprint)) continue;
      seenListingFingerprints.add(fingerprint);

      newProfiles.push({ addr, index: i });
    }

    if (newProfiles.length > 0) {
      console.log(`[Listener] Token profiles: ${newProfiles.length} new listings`);
    }

    const now = Date.now();
    for (let j = newProfiles.length - 1; j >= 0; j--) {
      const { addr } = newProfiles[j];
      const alertedAt = new Date(now - j * 1000);
      processTokenAlert(addr, "DEX_LISTING", "DexScreener", alertedAt).catch(() => null);
    }
  } catch (err) {
    console.error("[Listener] pollDexTokenProfiles error:", err instanceof Error ? err.message : err);
  } finally {
    if (listenerRunning) {
      listingTimer = setTimeout(pollDexTokenProfiles, LISTING_POLL_MS);
    }
  }
}

export async function startBlockchainListener() {
  if (listenerRunning) return { success: true, message: "Listener already running" };

  try {
    listenerRunning = true;
    listenerStartedAt = Date.now();

    console.log("[Listener] Starting DEX monitors (Top boosts every 6s + Latest boosts every 5s + Listings every 6s, staggered)");

    // Stagger startup: Top immediately, Latest after 2s, Listings after 4s
    // This prevents all 3 from firing at the same time and hitting rate limits
    pollDexBoostsTop().catch(() => null);
    setTimeout(() => { if (listenerRunning) pollDexBoostsLatest().catch(() => null); }, 2_000);
    setTimeout(() => { if (listenerRunning) pollDexTokenProfiles().catch(() => null); }, 4_000);

    // Reset fingerprints every 4h so repeat boosts re-alert
    fingerprintResetTimer = setInterval(() => {
      const before = seenBoostFingerprints.size + seenListingFingerprints.size;
      seenBoostFingerprints.clear();
      seenListingFingerprints.clear();
      console.log(`[Listener] Fingerprint cache cleared (had ${before} entries)`);
    }, BOOST_FINGERPRINT_RESET_MS);

    return { success: true, message: "Listener started (DEX Boosts + Token Profiles)" };
  } catch (error) {
    listenerRunning = false;
    listenerStartedAt = null;
    console.error("[Listener] Startup error:", error instanceof Error ? error.message : error);
    return { success: false, message: "Listener failed to start" };
  }
}

export async function stopBlockchainListener() {
  listenerRunning = false;
  listenerStartedAt = null;

  if (boostTopTimer) { clearTimeout(boostTopTimer); boostTopTimer = null; }
  if (boostLatestTimer) { clearTimeout(boostLatestTimer); boostLatestTimer = null; }
  if (listingTimer) { clearTimeout(listingTimer); listingTimer = null; }
  if (fingerprintResetTimer) { clearInterval(fingerprintResetTimer); fingerprintResetTimer = null; }

  console.log("[Listener] Stopped");
  return { success: true, message: "Listener stopped" };
}

export function getListenerStatus() {
  return {
    running: listenerRunning,
    subscriptions: 0,
    uptime: listenerStartedAt ? `${Math.floor((Date.now() - listenerStartedAt) / 1000)}s` : undefined,
    mode: "dexscreener-api-polling",
    monitors: ["DEX Boosts top (6s)", "DEX Boosts latest (5s)", "DEX Token Profiles (6s)"],
  };
}
