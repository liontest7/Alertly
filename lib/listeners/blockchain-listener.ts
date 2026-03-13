import { getEnv } from "@/lib/env";
import { calculateRiskScore } from "@/lib/risk/scorer";
import { broadcastAlertToTelegram } from "@/lib/notifications/telegram";
import { pushAlert } from "@/lib/alert-store";
import { getTokenMeta } from "@/lib/token-metadata";

export type AlertKind = "DEX_BOOST" | "DEX_LISTING";

let listenerRunning = false;
let listenerStartedAt: number | null = null;

const BOOST_TOP_POLL_MS = 9_000;
const BOOST_LATEST_POLL_MS = 7_000;
const LISTING_POLL_MS = 12_000;
const BOOST_FINGERPRINT_RESET_MS = 4 * 60 * 60 * 1000;

const seenBoostFingerprints = new Set<string>();
const seenListingFingerprints = new Set<string>();

let boostTopTimer: ReturnType<typeof setTimeout> | null = null;
let boostLatestTimer: ReturnType<typeof setInterval> | null = null;
let listingTimer: ReturnType<typeof setTimeout> | null = null;
let fingerprintResetTimer: ReturnType<typeof setInterval> | null = null;

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
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/top/v1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });

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
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/latest/v1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });

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
  }
}

async function pollDexTokenProfiles() {
  if (!listenerRunning) return;
  try {
    const res = await fetch("https://api.dexscreener.com/token-profiles/latest/v1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });

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

    console.log("[Listener] Starting DEX monitors (Boosts top every 9s + latest every 7s + Profiles every 12s)");

    // Start all pollers immediately
    pollDexBoostsTop().catch(() => null);
    pollDexBoostsLatest().catch(() => null);
    pollDexTokenProfiles().catch(() => null);

    // Latest boosts on a fixed interval (independent from the chain above)
    boostLatestTimer = setInterval(() => {
      pollDexBoostsLatest().catch(() => null);
    }, BOOST_LATEST_POLL_MS);

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
  if (boostLatestTimer) { clearInterval(boostLatestTimer); boostLatestTimer = null; }
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
    monitors: ["DEX Boosts top (9s)", "DEX Boosts latest (7s)", "DEX Token Profiles (12s)"],
  };
}
