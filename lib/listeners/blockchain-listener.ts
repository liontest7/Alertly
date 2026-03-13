import { Commitment, Connection, LAMPORTS_PER_SOL, Logs, ParsedMessageAccount, PublicKey } from "@solana/web3.js";
import { getEnv, requireEnv } from "@/lib/env";
import { calculateRiskScore } from "@/lib/risk/scorer";
import { broadcastAlertToTelegram } from "@/lib/notifications/telegram";
import { pushAlert } from "@/lib/alert-store";
import { getTokenMeta } from "@/lib/token-metadata";

const RPC_URL =
  getEnv("SOLANA_RPC_URL") ||
  requireEnv("SOLANA_RPC_URL", {
    allowInDev: true,
    devFallback: "https://api.mainnet-beta.solana.com",
  });

const DEX_PROGRAMS = {
  RAYDIUM_V4: "675kPX9MHTjS2zt1qLZXr5HCrLYUFeVNSwbJXyXEKds",
  RAYDIUM_CLMM: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
  RAYDIUM_FUSION: "EUqoRMAp5gKHrj5L2ChZAudKHfqKQ6AysUGEngkxF7y2",
  ORCA_LEGACY: "9W959DqDtw2hGQT1kcMwTKrWgQQXdJwW8JcA7dNtz9Z9",
  JUPITER_AGGREGATOR: "JUP2jxvXaqu7NQY1GmNF4m1QWDPjk3umbRX2KPwCqL8",
  JUPITER_V6: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  METEORA: "Eo7WjKq67rjYd7fqSL88j5z6zJrHcs5MY7QDcymir8a",
  PUMP_FUN: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
} as const;

const DEX_LABEL_BY_PROGRAM = new Map<string, string>([
  [DEX_PROGRAMS.RAYDIUM_V4, "Raydium"],
  [DEX_PROGRAMS.RAYDIUM_CLMM, "Raydium"],
  [DEX_PROGRAMS.RAYDIUM_FUSION, "Raydium"],
  [DEX_PROGRAMS.ORCA_LEGACY, "Orca"],
  [DEX_PROGRAMS.JUPITER_AGGREGATOR, "Jupiter"],
  [DEX_PROGRAMS.JUPITER_V6, "Jupiter"],
  [DEX_PROGRAMS.METEORA, "Meteora"],
  [DEX_PROGRAMS.PUMP_FUN, "Pump.fun"],
]);

export type AlertKind =
  | "DEX_BOOST"
  | "DEX_LISTING";

export interface BlockchainEvent {
  type: AlertKind;
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  amount?: number;
  liquidity?: number;
  wallet?: string;
  dex: string;
  timestamp: Date;
  signature: string;
  reason: string;
}

let listenerRunning = false;
let listenerStartedAt: number | null = null;
let connection: Connection | null = null;
let logSubscriptionIds: number[] = [];

export function getConnection(): Connection {
  if (!connection) connection = new Connection(RPC_URL, "confirmed" as Commitment);
  return connection;
}

const KNOWN_PROGRAM_IDS = new Set([
  "ComputeBudget111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "11111111111111111111111111111111",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bC3",
  "SysvarRent111111111111111111111111111111111",
  "SysvarC1ock11111111111111111111111111111111",
  "SysvarS1otHashes111111111111111111111111111",
  "Sysvar1nstructions1111111111111111111111111",
  "Vote111111111111111111111111111111111111111",
  "BPFLoaderUpgradeab1e11111111111111111111111",
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  ...Object.values(DEX_PROGRAMS),
]);

const STABLECOIN_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "So11111111111111111111111111111111111111112",
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
]);

function isPotentialPublicKey(value: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  if (/[A-Z]{6,}/.test(value)) return false;
  if (/(.)\1{5,}/.test(value)) return false;
  return true;
}

function extractTokenAddressFromLogs(logs: string[]): string | null {
  for (const log of logs) {
    const matches = log.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
    const found = matches.find(
      (candidate) => isPotentialPublicKey(candidate) && !KNOWN_PROGRAM_IDS.has(candidate),
    );
    if (found) return found;
  }
  return null;
}

function detectDexFromProgram(programId: string): string {
  return DEX_LABEL_BY_PROGRAM.get(programId) || "Unknown";
}

function isNewListingEvent(logs: string[], programId: string): boolean {
  for (const rawLog of logs) {
    const log = rawLog.toLowerCase();
    if (
      log.includes("initializepool") ||
      log.includes("initialize_pool") ||
      log.includes("initialize pool") ||
      (programId === DEX_PROGRAMS.PUMP_FUN && (log.includes("program log: create") || log.includes("instruction: create") || log.includes("initialize bonding curve"))) ||
      (programId === DEX_PROGRAMS.RAYDIUM_V4 && (log.includes("instruction: initialize") || log.includes("initialize2")))
    ) {
      return true;
    }
  }
  return false;
}

let enrichConcurrent = 0;
const MAX_ENRICH_CONCURRENT = 4;

async function enrichTokenFromTransaction(signature: string): Promise<{ tokenAddress: string; wallet?: string } | null> {
  if (enrichConcurrent >= MAX_ENRICH_CONCURRENT) return null;
  enrichConcurrent++;
  try {
    const tx = await getConnection().getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) return null;

    const message = tx.transaction.message;
    const accountKeys = message.accountKeys as ParsedMessageAccount[];
    const wallet = accountKeys.find((entry) => entry.signer)?.pubkey.toBase58();

    const balances = tx.meta?.postTokenBalances || [];
    const nativeSolMint = "So11111111111111111111111111111111111111112";
    const mint = balances.find(
      (b) => b.mint && b.mint !== nativeSolMint && !STABLECOIN_MINTS.has(b.mint),
    )?.mint || null;

    if (!mint) return null;
    return { tokenAddress: mint, wallet };
  } catch {
    return null;
  } finally {
    enrichConcurrent--;
  }
}

const recentFingerprints = new Map<string, number>();
const FINGERPRINT_COOLDOWN_MS = 600_000;

function isCooldownActive(fingerprint: string): boolean {
  const last = recentFingerprints.get(fingerprint);
  if (!last) return false;
  if (Date.now() - last < FINGERPRINT_COOLDOWN_MS) return true;
  recentFingerprints.delete(fingerprint);
  return false;
}

function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

async function processListingEvent(event: BlockchainEvent) {
  if (KNOWN_PROGRAM_IDS.has(event.tokenAddress)) return;
  if (STABLECOIN_MINTS.has(event.tokenAddress)) return;

  const addrLen = event.tokenAddress.length;
  if (addrLen < 32 || addrLen > 44) return;
  if (!isValidPublicKey(event.tokenAddress)) return;

  const fingerprint = `${event.tokenAddress}|DEX_LISTING`;
  if (isCooldownActive(fingerprint)) return;
  recentFingerprints.set(fingerprint, Date.now());

  const risk = calculateRiskScore({
    address: event.tokenAddress,
    holders: undefined,
    mintAuthority: null,
    freezeAuthority: null,
    lpLockedPct: 80,
  });

  const pairAddress = event.tokenAddress;

  const alertData = {
    fingerprint,
    address: event.tokenAddress,
    type: "DEX_LISTING" as AlertKind,
    name: "Loading...",
    symbol: null as string | null,
    change: "0%",
    trend: "neutral" as string,
    mc: "N/A",
    vol: "N/A",
    liquidity: "N/A",
    holders: 0,
    imageUrl: null as string | null,
    dexUrl: `https://dexscreener.com/solana/${pairAddress}`,
    alertedAt: event.timestamp,
    riskScore: risk.score,
    riskLevel: risk.level,
    pairAddress,
    priceUsd: null as string | null,
    website: null as string | null,
    twitter: null as string | null,
    telegram: null as string | null,
    wallet: event.wallet,
    dex: event.dex,
  };

  pushAlert(alertData);

  getTokenMeta(event.tokenAddress).then((meta) => {
    if (!meta) return;
    const change = meta.change24h || "0%";
    pushAlert({
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
      pairAddress: meta.pairAddress || pairAddress,
      dexUrl: `https://dexscreener.com/solana/${meta.pairAddress || pairAddress}`,
      website: meta.website || null,
      twitter: meta.twitter || null,
      telegram: meta.telegram || null,
    });

    broadcastAlertToTelegram({
      address: alertData.address,
      pairAddress: meta.pairAddress || undefined,
      type: "DEX_LISTING",
      name: meta.name || "Unknown Token",
      symbol: meta.symbol || undefined,
      mc: meta.mc || "N/A",
      liquidity: meta.liquidity || "N/A",
      vol: meta.volume24h || "N/A",
      alertedAt: alertData.alertedAt,
      wallet: alertData.wallet,
      imageUrl: meta.imageUrl || undefined,
    }).catch(() => null);
  }).catch(() => null);
}

async function handleProgramLogs(logs: Logs, programId: string) {
  if (!isNewListingEvent(logs.logs, programId)) return;

  const tokenAddress = extractTokenAddressFromLogs(logs.logs) || logs.signature.slice(0, 44);
  const dex = detectDexFromProgram(programId);

  let finalAddress = tokenAddress;
  let wallet: string | undefined;

  const enriched = await enrichTokenFromTransaction(logs.signature);
  if (enriched) {
    finalAddress = enriched.tokenAddress;
    wallet = enriched.wallet;
  }

  const event: BlockchainEvent = {
    type: "DEX_LISTING",
    tokenAddress: finalAddress,
    dex,
    timestamp: new Date(),
    signature: logs.signature,
    reason: `New ${dex} pool/token listing detected`,
    wallet,
  };

  processListingEvent(event).catch(() => null);
}

let txReceived = 0;

async function setupProgramSubscription() {
  const conn = getConnection();
  const programIds = Object.values(DEX_PROGRAMS);
  let subscribed = 0;

  for (const programId of programIds) {
    if (!isValidPublicKey(programId)) {
      console.warn(`Skipping invalid program ID: ${programId}`);
      continue;
    }
    try {
      const label = DEX_LABEL_BY_PROGRAM.get(programId) || programId.slice(0, 8);
      const subId = conn.onLogs(
        new PublicKey(programId),
        async (logs) => {
          txReceived++;
          await handleProgramLogs(logs, programId);
        },
        "confirmed",
      );
      logSubscriptionIds.push(subId);
      subscribed++;
      console.log(`[Listener] Subscribed to ${label} (${programId.slice(0, 8)}...)`);
    } catch (err) {
      console.warn(`Failed to subscribe to program ${programId}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`[Listener] ${subscribed} program subscriptions active (DEX Listing only)`);
}

const seenBoostFingerprints = new Set<string>();
const seenLatestBoostFingerprints = new Set<string>();
let boostPollerTimer: ReturnType<typeof setTimeout> | null = null;
let latestBoostPollerTimer: ReturnType<typeof setTimeout> | null = null;
let boostFingerprintResetTimer: ReturnType<typeof setInterval> | null = null;
const BOOST_FINGERPRINT_RESET_MS = 4 * 60 * 60 * 1000;

async function processBoostEvent(addr: string, reason: string) {
  if (!isPotentialPublicKey(addr)) return;
  if (!isValidPublicKey(addr)) return;

  const fingerprint = `${addr}|DEX_BOOST`;
  if (isCooldownActive(fingerprint)) return;
  recentFingerprints.set(fingerprint, Date.now());

  const risk = calculateRiskScore({
    address: addr,
    holders: undefined,
    mintAuthority: null,
    freezeAuthority: null,
    lpLockedPct: 80,
  });

  const alertData = {
    fingerprint,
    address: addr,
    type: "DEX_BOOST" as AlertKind,
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
    alertedAt: new Date(),
    riskScore: risk.score,
    riskLevel: risk.level,
    pairAddress: addr,
    priceUsd: null as string | null,
    website: null as string | null,
    twitter: null as string | null,
    telegram: null as string | null,
    dex: "DexScreener",
  };

  pushAlert(alertData);

  getTokenMeta(addr).then((meta) => {
    if (!meta) return;
    const change = meta.change24h || "0%";
    pushAlert({
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
    });

    broadcastAlertToTelegram({
      address: addr,
      pairAddress: meta.pairAddress || undefined,
      type: "DEX_BOOST",
      name: meta.name || "Unknown Token",
      symbol: meta.symbol || undefined,
      mc: meta.mc || "N/A",
      liquidity: meta.liquidity || "N/A",
      vol: meta.volume24h || "N/A",
      alertedAt: alertData.alertedAt,
      imageUrl: meta.imageUrl || undefined,
    }).catch(() => null);
  }).catch(() => null);
}

async function pollDexBoosts() {
  if (!listenerRunning) return;
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/top/v1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return;

    const data: unknown = await res.json();
    const boosts: any[] = Array.isArray(data) ? data : [];

    for (const boost of boosts) {
      if (boost.chainId !== "solana") continue;
      const addr = boost.tokenAddress as string | undefined;
      if (!addr) continue;

      const fingerprint = `${addr}|DEX_BOOST`;
      if (seenBoostFingerprints.has(fingerprint)) continue;
      seenBoostFingerprints.add(fingerprint);

      const totalAmount = boost.totalAmount ?? boost.amount;
      processBoostEvent(addr, `DexScreener top boost${totalAmount ? ` (${totalAmount} units)` : ""}`).catch(() => null);
    }
  } catch {
  } finally {
    if (listenerRunning) {
      boostPollerTimer = setTimeout(pollDexBoosts, 45_000);
    }
  }
}

async function pollLatestDexBoosts() {
  if (!listenerRunning) return;
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/latest/v1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return;

    const data: unknown = await res.json();
    const boosts: any[] = Array.isArray(data) ? data : [];

    for (const boost of boosts) {
      if (boost.chainId !== "solana") continue;
      const addr = boost.tokenAddress as string | undefined;
      if (!addr) continue;

      const timeBucket = Math.floor(Date.now() / 300_000);
      const fingerprint = `${addr}|DEX_BOOST_LATEST|${timeBucket}`;
      if (seenLatestBoostFingerprints.has(fingerprint)) continue;
      seenLatestBoostFingerprints.add(fingerprint);

      const totalAmount = boost.totalAmount ?? boost.amount;
      processBoostEvent(addr, `New DexScreener boost payment${totalAmount ? ` — ${totalAmount} units` : ""}`).catch(() => null);
    }
  } catch {
  } finally {
    if (listenerRunning) {
      latestBoostPollerTimer = setTimeout(pollLatestDexBoosts, 20_000);
    }
  }
}

export async function startBlockchainListener() {
  if (listenerRunning) return { success: true, message: "Listener already running" };

  try {
    listenerRunning = true;
    listenerStartedAt = Date.now();
    await setupProgramSubscription();
    pollDexBoosts().catch(() => null);
    pollLatestDexBoosts().catch(() => null);
    boostFingerprintResetTimer = setInterval(() => {
      seenBoostFingerprints.clear();
      seenLatestBoostFingerprints.clear();
    }, BOOST_FINGERPRINT_RESET_MS);
    return { success: true, message: "Listener started" };
  } catch (error) {
    listenerRunning = false;
    listenerStartedAt = null;
    console.error("Listener startup error (non-fatal):", error instanceof Error ? error.message : error);
    return { success: false, message: "Listener failed to start" };
  }
}

export async function stopBlockchainListener() {
  const conn = getConnection();

  for (const subId of logSubscriptionIds) {
    await conn.removeOnLogsListener(subId);
  }

  logSubscriptionIds = [];
  listenerRunning = false;
  listenerStartedAt = null;

  if (boostPollerTimer) {
    clearTimeout(boostPollerTimer);
    boostPollerTimer = null;
  }

  if (latestBoostPollerTimer) {
    clearTimeout(latestBoostPollerTimer);
    latestBoostPollerTimer = null;
  }

  if (boostFingerprintResetTimer) {
    clearInterval(boostFingerprintResetTimer);
    boostFingerprintResetTimer = null;
  }

  return { success: true, message: "Listener stopped" };
}

export function getListenerStatus() {
  return {
    running: listenerRunning,
    subscriptions: logSubscriptionIds.length,
    uptime: listenerStartedAt ? `${Math.floor((Date.now() - listenerStartedAt) / 1000)}s` : undefined,
    mode: "dex-listing-and-boost",
    monitoredPrograms: Object.keys(DEX_PROGRAMS).length,
    txReceived,
  };
}
