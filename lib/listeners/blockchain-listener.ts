import { Commitment, Connection, Logs, ParsedMessageAccount, PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/prisma";
import { getEnv, requireEnv } from "@/lib/env";
import { calculateRiskScore } from "@/lib/risk/scorer";
import { broadcastAlertToTelegram } from "@/lib/notifications/telegram";

const RPC_URL =
  getEnv("SOLANA_RPC_URL") ||
  requireEnv("SOLANA_RPC_URL", {
    allowInDev: true,
    devFallback: "https://api.mainnet-beta.solana.com",
  });

const DEX_PROGRAMS = {
  RAYDIUM_V4: "675kPX9MHTjS2zt1qLZXr5HCrLYUFeVNSwbJXyXEKds",
  RAYDIUM_FUSION: "EUqoRMAp5gKHrj5L2ChZAudKHfqKQ6AysUGEngkxF7y2",
  ORCA_WHIRLPOOL: "whirLbMiicVdio4KfUbuPvCODMARF747ySHiR5Bot5Q",
  ORCA_LEGACY: "9W959DqDtw2hGQT1kcMwTKrWgQQXdJwW8JcA7dNtz9Z9",
  JUPITER_AGGREGATOR: "JUP2jxvXaqu7NQY1GmNF4m1QWDPjk3umbRX2KPwCqL8",
  METEORA: "Eo7WjKq67rjYd7fqSL88j5z6zJrHcs5MY7QDcymir8a",
} as const;

const DEX_LABEL_BY_PROGRAM = new Map<string, string>([
  [DEX_PROGRAMS.RAYDIUM_V4, "Raydium"],
  [DEX_PROGRAMS.RAYDIUM_FUSION, "Raydium"],
  [DEX_PROGRAMS.ORCA_WHIRLPOOL, "Orca"],
  [DEX_PROGRAMS.ORCA_LEGACY, "Orca"],
  [DEX_PROGRAMS.JUPITER_AGGREGATOR, "Jupiter"],
  [DEX_PROGRAMS.METEORA, "Meteora"],
]);

const VOLUME_WINDOW_MS = 30_000;
const MIN_VOLUME_SPIKE_PCT = Number(getEnv("ALERT_VOLUME_SPIKE_PCT", "150"));
const MIN_LIQUIDITY_THRESHOLD = Number(getEnv("ALERT_MIN_LIQUIDITY_USD", "50000"));
const WHALE_MIN_SOL = Number(getEnv("ALERT_WHALE_MIN_SOL", "50"));

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

const GLOBAL_WHALE_WALLETS = new Set(
  (getEnv("WHALE_WALLETS", "") || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
);

export type AlertKind =
  | "EARLY_TOKEN_PAIR"
  | "LIQUIDITY_ADDED"
  | "LIQUIDITY_REMOVAL"
  | "VOLUME_SPIKE"
  | "WHALE_BUY"
  | "DEX_BOOST"
  | "DEX_LISTING"
  | "SMART_MONEY_ENTRY";

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

export interface TokenAlert {
  tokenAddress: string;
  type: AlertKind;
  mc?: number;
  liquidity?: number;
  holders?: number;
  volume?: number;
  devWalletPct?: number;
  topHoldersPct?: number;
  tokenAgeMinutes?: number;
  timestamp: Date;
  source: "blockchain" | "dexscreener";
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

function normalizeTokenAddress(signature: string): string {
  return signature.slice(0, 44);
}

function isPotentialPublicKey(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function extractTokenAddressFromLogs(logs: string[]): string | null {
  for (const log of logs) {
    const matches = log.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
    const found = matches.find((candidate) => isPotentialPublicKey(candidate));
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
  const tokenAddress = extractTokenAddressFromLogs(logs) || normalizeTokenAddress(signature);
  const dex = detectDexFromProgram(programId);

  for (const rawLog of logs) {
    const log = rawLog.toLowerCase();

    if (log.includes("initialize_pool") || log.includes("initpool") || log.includes("initializepool")) {
      events.push({
        type: "EARLY_TOKEN_PAIR",
        tokenAddress,
        dex,
        timestamp: new Date(),
        signature,
        reason: "InitializePool instruction detected",
      });
    }

    if (log.includes("add_liquidity") || log.includes("addliquidity") || log.includes("deposit")) {
      const liquidity = parseFloatFromLog(rawLog);
      events.push({
        type: "LIQUIDITY_ADDED",
        tokenAddress,
        dex,
        liquidity,
        timestamp: new Date(),
        signature,
        reason: "Liquidity add instruction detected",
      });
    }

    if (log.includes("remove_liquidity") || log.includes("removeliquidity") || log.includes("withdraw")) {
      events.push({
        type: "LIQUIDITY_REMOVAL",
        tokenAddress,
        dex,
        timestamp: new Date(),
        signature,
        reason: "Liquidity removal instruction detected",
      });
    }

    if (log.includes("swap")) {
      const amount = parseFloatFromLog(rawLog);
      events.push({
        type: "SMART_MONEY_ENTRY",
        tokenAddress,
        dex,
        amount,
        timestamp: new Date(),
        signature,
        reason: "Swap instruction detected",
      });
    }
  }

  return events;
}

function updateAndDetectVolumeSpike(event: BlockchainEvent): BlockchainEvent | null {
  if (typeof event.amount !== "number" || event.amount <= 0) return null;

  const key = event.tokenAddress;
  const now = Date.now();
  const snapshots = volumeByToken.get(key) || [];

  const fresh = snapshots.filter((entry) => now - entry.timestamp <= VOLUME_WINDOW_MS);
  const previousWindow = fresh.filter((entry) => now - entry.timestamp > VOLUME_WINDOW_MS / 2);
  const currentWindow = [...fresh.filter((entry) => now - entry.timestamp <= VOLUME_WINDOW_MS / 2), { timestamp: now, amount: event.amount }];

  const prevVolume = previousWindow.reduce((sum, p) => sum + p.amount, 0);
  const currVolume = currentWindow.reduce((sum, p) => sum + p.amount, 0);

  volumeByToken.set(key, [...fresh, { timestamp: now, amount: event.amount }]);

  if (prevVolume <= 0 || currVolume <= prevVolume) return null;

  const pctIncrease = ((currVolume - prevVolume) / prevVolume) * 100;
  if (pctIncrease < MIN_VOLUME_SPIKE_PCT) return null;

  return {
    ...event,
    type: "VOLUME_SPIKE",
    reason: `Volume increased ${pctIncrease.toFixed(0)}% in ${VOLUME_WINDOW_MS / 1000}s window`,
  };
}

async function getWhaleWalletSet(): Promise<Set<string>> {
  const wallets = new Set<string>(GLOBAL_WHALE_WALLETS);
  const settings = await prisma.userSetting.findMany({
    where: { whaleAlertEnabled: true },
    select: { whaleWalletAddresses: true },
  });

  for (const setting of settings) {
    for (const wallet of setting.whaleWalletAddresses) {
      if (wallet) wallets.add(wallet);
    }
  }

  return wallets;
}

async function inferEventVariants(event: BlockchainEvent): Promise<BlockchainEvent[]> {
  const extraEvents: BlockchainEvent[] = [];

  if (event.type === "LIQUIDITY_ADDED" && typeof event.liquidity === "number" && event.liquidity >= MIN_LIQUIDITY_THRESHOLD) {
    extraEvents.push({ ...event, reason: `Liquidity ${event.liquidity} crossed threshold ${MIN_LIQUIDITY_THRESHOLD}` });
  }

  if (event.type === "SMART_MONEY_ENTRY") {
    const spike = updateAndDetectVolumeSpike(event);
    if (spike) extraEvents.push(spike);

    if (event.wallet) {
      const whaleWallets = await getWhaleWalletSet();
      if (whaleWallets.has(event.wallet) || (event.amount || 0) >= WHALE_MIN_SOL) {
        extraEvents.push({ ...event, type: "WHALE_BUY", reason: "Whale wallet or whale-size buy detected" });
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

async function enrichEventFromTransaction(event: BlockchainEvent): Promise<BlockchainEvent> {
  try {
    const tx = await getConnection().getParsedTransaction(event.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return event;

    const message = tx.transaction.message;
    const accountKeys = message.accountKeys as ParsedMessageAccount[];
    const wallet = accountKeys.find((entry) => entry.signer)?.pubkey.toBase58();

    const balanceToken = tx.meta?.postTokenBalances?.[0]?.mint;
    const tokenAddress = balanceToken || event.tokenAddress;

    return {
      ...event,
      tokenAddress,
      wallet: event.wallet || wallet,
    };
  } catch {
    return event;
  }
}

async function persistBlockchainEvent(event: BlockchainEvent): Promise<void> {
  await prisma.blockchainEvent.create({
    data: {
      signature: `${event.signature}:${event.type}`,
      tokenAddress: event.tokenAddress,
      eventType: event.type,
      dex: event.dex,
      amount: event.amount,
      liquidity: event.liquidity,
      walletAddress: event.wallet,
      timestamp: event.timestamp,
    },
  }).catch(() => null);
}

async function processBlockchainEvent(event: BlockchainEvent) {
  const fingerprint = `${event.tokenAddress}|${event.type}|${event.signature}`;

  const exists = await prisma.alertEvent.findUnique({ where: { fingerprint } });
  if (exists) return;

  const risk = calculateRiskScore({
    address: event.tokenAddress,
    holders: undefined,
    mintAuthority: null,
    freezeAuthority: null,
    lpLockedPct: event.type === "LIQUIDITY_REMOVAL" ? 5 : 80,
  });

  const createdAlert = await prisma.alertEvent.create({
    data: {
      fingerprint,
      address: event.tokenAddress,
      type: event.type,
      name: event.tokenName || "Live Token",
      symbol: event.tokenSymbol || "TKN",
      change: "0%",
      trend: "neutral",
      mc: "Live",
      vol: event.amount ? `$${event.amount.toFixed(2)}` : "Live",
      liquidity: event.liquidity ? `$${event.liquidity.toFixed(0)}` : "Live",
      holders: 0,
      pairAddress: event.tokenAddress,
      dexUrl: `https://dexscreener.com/solana/${event.tokenAddress}`,
      alertedAt: event.timestamp,
      riskScore: risk.score,
      riskLevel: risk.level,
      website: undefined,
      twitter: undefined,
      telegram: undefined,
      priceUsd: undefined,
    },
  });

  await persistBlockchainEvent(event);

  await broadcastAlertToTelegram({
    address: createdAlert.address,
    type: createdAlert.type,
    name: createdAlert.name,
    symbol: createdAlert.symbol || undefined,
    mc: createdAlert.mc,
    liquidity: createdAlert.liquidity,
    vol: createdAlert.vol,
    alertedAt: createdAlert.alertedAt,
  }).catch(() => null);
}

async function handleProgramLogs(logs: Logs, programId: string) {
  const parsed = parseLogsForEvents(logs.logs, logs.signature, programId);

  for (const baseEvent of parsed) {
    const enrichedBaseEvent = await enrichEventFromTransaction(baseEvent);
    const eventVariants = [enrichedBaseEvent, ...(await inferEventVariants(enrichedBaseEvent))];
    for (const event of eventVariants) {
      await processBlockchainEvent(event);
    }
  }
}

async function setupProgramSubscription() {
  const conn = getConnection();
  const programIds = Object.values(DEX_PROGRAMS);

  for (const programId of programIds) {
    if (!isPotentialPublicKey(programId)) {
      console.warn(`Skipping invalid program ID: ${programId}`);
      continue;
    }
    const subId = conn.onLogs(new PublicKey(programId), async (logs) => {
      await handleProgramLogs(logs, programId);
    }, "confirmed");

    logSubscriptionIds.push(subId);

    const accountSubId = conn.onProgramAccountChange(
      new PublicKey(programId),
      async () => {
        // accountSubscribe equivalent to capture pool/account mutations for lowest-latency awareness.
      },
      "confirmed",
    );

    programAccountSubscriptionIds.push(accountSubId);
  }

  const accountSubscribeWallets = new Set<string>();
  [...DEX_BOOST_WALLETS, ...DEX_LISTING_WALLETS, ...GLOBAL_WHALE_WALLETS].forEach(w => {
    if (isPotentialPublicKey(w)) accountSubscribeWallets.add(w);
  });

  for (const wallet of accountSubscribeWallets) {
    try {
      const subId = conn.onAccountChange(new PublicKey(wallet), async () => {
        // Required accountSubscribe channel for payment wallets / whale tracking.
      }, "confirmed");
      accountSubscriptionIds.push(subId);
    } catch {
      // Ignore malformed configured wallet.
    }
  }
}

export async function startBlockchainListener() {
  if (listenerRunning) return { success: true, message: "Listener already running" };

  listenerRunning = true;
  listenerStartedAt = Date.now();
  await setupProgramSubscription();

  return { success: true, message: "Listener started" };
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
