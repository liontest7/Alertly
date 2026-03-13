import { Commitment, Connection, LAMPORTS_PER_SOL, Logs, ParsedMessageAccount, PublicKey } from "@solana/web3.js";
import { getEnv, requireEnv } from "@/lib/env";
import { calculateRiskScore } from "@/lib/risk/scorer";
import { broadcastAlertToTelegram } from "@/lib/notifications/telegram";
import { pushAlert } from "@/lib/alert-store";
import { getTokenMeta, prefetchTokenMeta } from "@/lib/token-metadata";

const MAX_ENRICH_PER_SECOND = 12;
let enrichTokens = MAX_ENRICH_PER_SECOND;
let lastEnrichRefill = Date.now();
let enrichConcurrent = 0;
const MAX_ENRICH_CONCURRENT = 8;

function canEnrich(): boolean {
  const now = Date.now();
  const elapsed = (now - lastEnrichRefill) / 1000;
  enrichTokens = Math.min(MAX_ENRICH_PER_SECOND, enrichTokens + elapsed * MAX_ENRICH_PER_SECOND);
  lastEnrichRefill = now;
  if (enrichConcurrent >= MAX_ENRICH_CONCURRENT) return false;
  if (enrichTokens < 1) return false;
  enrichTokens -= 1;
  return true;
}

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

const VOLUME_WINDOW_MS = 60_000;
const DEFAULT_VOLUME_SPIKE_PCT = Number(getEnv("ALERT_VOLUME_SPIKE_PCT", "10"));
const DEFAULT_WHALE_MIN_SOL = Number(getEnv("ALERT_WHALE_MIN_SOL_BALANCE", "100"));

const DEX_BOOST_WALLETS = new Set(
  (getEnv("DEX_BOOST_WALLETS", "") || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
);

const DEX_LISTING_WALLETS = new Set(
  (getEnv("DEX_LISTING_WALLETS", "") || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
);

const STABLECOIN_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "So11111111111111111111111111111111111111112",
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
]);

export type AlertKind =
  | "VOLUME_SPIKE"
  | "WHALE_BUY"
  | "DEX_BOOST"
  | "DEX_LISTING";

type InternalEventKind = AlertKind | "_SWAP_INTERNAL";

export interface BlockchainEvent {
  type: InternalEventKind;
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  amount?: number;
  liquidity?: number;
  wallet?: string;
  walletBalance?: number;
  dex: string;
  timestamp: Date;
  signature: string;
  reason: string;
  spikePercent?: number;
}

type VolumeSnapshot = { timestamp: number; amount: number };

let listenerRunning = false;
let listenerStartedAt: number | null = null;
let connection: Connection | null = null;
let logSubscriptionIds: number[] = [];
let programAccountSubscriptionIds: number[] = [];
let accountSubscriptionIds: number[] = [];
const volumeByToken = new Map<string, VolumeSnapshot[]>();

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

function parseFloatFromLog(log: string): number | undefined {
  const matches = log.match(/([0-9]+(?:\.[0-9]+)?)/g);
  if (!matches?.length) return undefined;
  const num = Number(matches[matches.length - 1]);
  return Number.isFinite(num) ? num : undefined;
}

function detectDexFromProgram(programId: string): string {
  return DEX_LABEL_BY_PROGRAM.get(programId) || "Unknown";
}

function parseLogsForEvents(logs: string[], signature: string, programId: string): BlockchainEvent[] {
  const events: BlockchainEvent[] = [];
  const tokenAddress = extractTokenAddressFromLogs(logs) || signature.slice(0, 44);
  const dex = detectDexFromProgram(programId);

  let hasSwap = false;
  let isNewListing = false;

  for (const rawLog of logs) {
    const log = rawLog.toLowerCase();

    if (log.includes("swap")) {
      hasSwap = true;
      const amount = parseFloatFromLog(rawLog);
      events.push({
        type: "_SWAP_INTERNAL",
        tokenAddress,
        dex,
        amount,
        timestamp: new Date(),
        signature,
        reason: "Swap instruction detected",
      });
    }

    if (
      log.includes("initializepool") ||
      log.includes("initialize_pool") ||
      log.includes("initialize pool") ||
      (programId === DEX_PROGRAMS.PUMP_FUN && (log.includes("program log: create") || log.includes("instruction: create") || log.includes("initialize bonding curve"))) ||
      (programId === DEX_PROGRAMS.RAYDIUM_V4 && (log.includes("instruction: initialize") || log.includes("initialize2")))
    ) {
      isNewListing = true;
    }
  }

  if (isNewListing) {
    events.push({
      type: "DEX_LISTING",
      tokenAddress,
      dex,
      timestamp: new Date(),
      signature,
      reason: `New ${dex} pool/token listing detected`,
    });
  }

  return events;
}

function updateAndDetectVolumeSpike(event: BlockchainEvent, thresholdPct: number): BlockchainEvent | null {
  if (typeof event.amount !== "number" || event.amount <= 0) return null;
  if (STABLECOIN_MINTS.has(event.tokenAddress)) return null;

  const key = event.tokenAddress;
  const now = Date.now();
  const snapshots = volumeByToken.get(key) || [];

  const fresh = snapshots.filter((entry) => now - entry.timestamp <= VOLUME_WINDOW_MS);
  const previousWindow = fresh.filter((entry) => now - entry.timestamp > VOLUME_WINDOW_MS / 2);
  const currentWindow = [
    ...fresh.filter((entry) => now - entry.timestamp <= VOLUME_WINDOW_MS / 2),
    { timestamp: now, amount: event.amount },
  ];

  const prevVolume = previousWindow.reduce((sum, p) => sum + p.amount, 0);
  const currVolume = currentWindow.reduce((sum, p) => sum + p.amount, 0);

  volumeByToken.set(key, [...fresh, { timestamp: now, amount: event.amount }]);

  if (prevVolume <= 0 || currVolume <= prevVolume) return null;

  const pctIncrease = ((currVolume - prevVolume) / prevVolume) * 100;
  if (pctIncrease < thresholdPct) return null;

  return {
    ...event,
    type: "VOLUME_SPIKE",
    spikePercent: pctIncrease,
    reason: `Volume increased ${pctIncrease.toFixed(0)}% in ${VOLUME_WINDOW_MS / 1000}s`,
  };
}

async function getWalletSolBalance(wallet: string): Promise<number> {
  try {
    const balance = await getConnection().getBalance(new PublicKey(wallet));
    return balance / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

async function inferEventVariants(event: BlockchainEvent): Promise<BlockchainEvent[]> {
  const extraEvents: BlockchainEvent[] = [];

  const thresholdPct = DEFAULT_VOLUME_SPIKE_PCT;

  if (event.type === "_SWAP_INTERNAL") {
    if (!STABLECOIN_MINTS.has(event.tokenAddress)) {
      const spike = updateAndDetectVolumeSpike(event, thresholdPct);
      if (spike) extraEvents.push(spike);

      if (event.wallet && canEnrich()) {
        const balance = await getWalletSolBalance(event.wallet);
        if (balance >= DEFAULT_WHALE_MIN_SOL) {
          extraEvents.push({
            ...event,
            type: "WHALE_BUY",
            walletBalance: balance,
            reason: `Whale wallet: ${balance.toFixed(0)} SOL balance`,
          });
        }
      }
    }
  }

  if (event.wallet && DEX_BOOST_WALLETS.has(event.wallet)) {
    extraEvents.push({ ...event, type: "DEX_BOOST", reason: "Dex boost wallet payment detected" });
  }

  if (event.wallet && DEX_LISTING_WALLETS.has(event.wallet)) {
    extraEvents.push({ ...event, type: "DEX_LISTING", reason: "Dex listing payment detected" });
  }

  return extraEvents;
}

async function enrichEventFromTransaction(event: BlockchainEvent): Promise<BlockchainEvent | null> {
  enrichConcurrent++;
  try {
    const tx = await getConnection().getParsedTransaction(event.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return null;

    const message = tx.transaction.message;
    const accountKeys = message.accountKeys as ParsedMessageAccount[];
    const wallet = accountKeys.find((entry) => entry.signer)?.pubkey.toBase58();

    const balances = tx.meta?.postTokenBalances || [];
    const nativeSolMint = "So11111111111111111111111111111111111111112";
    const mint = balances.find((b) => b.mint && b.mint !== nativeSolMint && !STABLECOIN_MINTS.has(b.mint))?.mint || null;

    if (!mint) return null;

    return {
      ...event,
      tokenAddress: mint,
      wallet: event.wallet || wallet,
    };
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

async function processBlockchainEvent(event: BlockchainEvent) {
  if (event.type === "_SWAP_INTERNAL") return;

  if (KNOWN_PROGRAM_IDS.has(event.tokenAddress)) return;
  if (STABLECOIN_MINTS.has(event.tokenAddress)) return;

  const addrLen = event.tokenAddress.length;
  if (addrLen < 32 || addrLen > 44) return;
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(event.tokenAddress)) return;

  const alertType = event.type as AlertKind;
  const fingerprint = `${event.tokenAddress}|${alertType}`;
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
    type: alertType,
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
    buyAmountSol: event.amount,
    walletBalance: event.walletBalance,
    dex: event.dex,
    spikePercent: event.spikePercent,
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
      type: alertType,
      name: meta.name || "Unknown Token",
      symbol: meta.symbol || undefined,
      mc: meta.mc || "N/A",
      liquidity: meta.liquidity || "N/A",
      vol: meta.volume24h || "N/A",
      alertedAt: alertData.alertedAt,
      wallet: alertData.wallet,
      walletBalance: alertData.walletBalance,
      buyAmountSol: alertData.buyAmountSol,
      imageUrl: meta.imageUrl || undefined,
    }).catch(() => null);
  }).catch(() => null);
}

async function handleProgramLogs(logs: Logs, programId: string) {
  const parsed = parseLogsForEvents(logs.logs, logs.signature, programId);
  if (parsed.length === 0) return;

  const listings = parsed.filter((e) => e.type === "DEX_LISTING");
  const swaps = parsed.filter((e) => e.type === "_SWAP_INTERNAL");

  for (const listing of listings) {
    if (canEnrich()) {
      const enriched = await enrichEventFromTransaction(listing);
      if (enriched) {
        processBlockchainEvent({ ...listing, tokenAddress: enriched.tokenAddress, wallet: enriched.wallet }).catch(() => null);
      } else {
        processBlockchainEvent(listing).catch(() => null);
      }
    } else {
      processBlockchainEvent(listing).catch(() => null);
    }
  }

  if (swaps.length === 0) return;

  const swap = swaps[0];

  const spike = updateAndDetectVolumeSpike(swap, DEFAULT_VOLUME_SPIKE_PCT);
  if (spike) {
    if (canEnrich()) {
      const enriched = await enrichEventFromTransaction(swap);
      if (enriched) {
        processBlockchainEvent({ ...spike, tokenAddress: enriched.tokenAddress, wallet: enriched.wallet }).catch(() => null);
      } else {
        processBlockchainEvent(spike).catch(() => null);
      }
    } else {
      processBlockchainEvent(spike).catch(() => null);
    }
  }

  if (canEnrich()) {
    const enriched = await enrichEventFromTransaction(swap);
    if (!enriched) return;

    const enrichedBase = { ...swap, tokenAddress: enriched.tokenAddress, wallet: enriched.wallet };

    if (enriched.wallet) {
      const balance = await getWalletSolBalance(enriched.wallet);
      if (balance >= DEFAULT_WHALE_MIN_SOL) {
        processBlockchainEvent({
          ...enrichedBase,
          type: "WHALE_BUY",
          walletBalance: balance,
          reason: `Whale wallet: ${balance.toFixed(0)} SOL`,
        }).catch(() => null);
      }
    }
  }
}

function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
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
          if (txReceived % 50 === 0) {
            console.log(`[Listener] ${txReceived} txs received across all programs`);
          }
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
  console.log(`[Listener] ${subscribed} program subscriptions active`);
}

const seenBoostFingerprints = new Set<string>();
const seenLatestBoostFingerprints = new Set<string>();
let boostPollerTimer: ReturnType<typeof setTimeout> | null = null;
let latestBoostPollerTimer: ReturnType<typeof setTimeout> | null = null;
let boostFingerprintResetTimer: ReturnType<typeof setInterval> | null = null;
const BOOST_FINGERPRINT_RESET_MS = 4 * 60 * 60 * 1000;

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
      if (!addr || !isPotentialPublicKey(addr)) continue;

      const fingerprint = `${addr}|DEX_BOOST`;
      if (seenBoostFingerprints.has(fingerprint)) continue;
      seenBoostFingerprints.add(fingerprint);

      const totalAmount = boost.totalAmount ?? boost.amount;
      const boostEvent: BlockchainEvent = {
        type: "DEX_BOOST",
        tokenAddress: addr,
        dex: "DexScreener",
        timestamp: new Date(),
        signature: `boost_${addr}_${Date.now()}`,
        reason: `DexScreener top boost${totalAmount ? ` (${totalAmount} units)` : ""}`,
      };
      processBlockchainEvent(boostEvent).catch(() => null);
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
      if (!addr || !isPotentialPublicKey(addr)) continue;

      const timeBucket = Math.floor(Date.now() / 300_000);
      const fingerprint = `${addr}|DEX_BOOST_LATEST|${timeBucket}`;
      if (seenLatestBoostFingerprints.has(fingerprint)) continue;
      seenLatestBoostFingerprints.add(fingerprint);

      const totalAmount = boost.totalAmount ?? boost.amount;
      const boostEvent: BlockchainEvent = {
        type: "DEX_BOOST",
        tokenAddress: addr,
        dex: "DexScreener",
        timestamp: new Date(),
        signature: `boost_latest_${addr}_${Date.now()}`,
        reason: `New DexScreener boost payment${totalAmount ? ` — ${totalAmount} units` : ""}`,
      };
      processBlockchainEvent(boostEvent).catch(() => null);
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

  for (const subId of accountSubscriptionIds) {
    await conn.removeAccountChangeListener(subId);
  }

  for (const subId of programAccountSubscriptionIds) {
    await conn.removeProgramAccountChangeListener(subId);
  }

  logSubscriptionIds = [];
  programAccountSubscriptionIds = [];
  accountSubscriptionIds = [];
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
    subscriptions: logSubscriptionIds.length + programAccountSubscriptionIds.length + accountSubscriptionIds.length,
    uptime: listenerStartedAt ? `${Math.floor((Date.now() - listenerStartedAt) / 1000)}s` : undefined,
    mode: "solana-rpc-streams",
    monitoredPrograms: Object.keys(DEX_PROGRAMS).length,
  };
}
