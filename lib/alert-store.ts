import EventEmitter from "events";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface StoredAlert {
  fingerprint: string;
  address: string;
  type: string;
  name: string;
  symbol: string | null;
  mc: string;
  vol: string;
  liquidity: string;
  holders: number;
  imageUrl: string | null;
  change: string;
  trend: string;
  dexUrl: string;
  alertedAt: Date;
  riskScore: number;
  riskLevel: string;
  pairAddress?: string | null;
  priceUsd?: string | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  boostLevel?: string;
  boostAmount?: number;
  totalBoostAmount?: number;
  spikePercent?: number;
  dex?: string;
  wallet?: string;
  walletBalance?: number;
  buyAmountSol?: number;
}

const MAX_ALERTS = 1000;
const DATA_DIR = join(process.cwd(), "data");
const ALERTS_FILE = join(DATA_DIR, "alerts.json");

const alertBuffer: StoredAlert[] = [];
const seenFingerprints = new Set<string>();

export const alertEmitter = new EventEmitter();
alertEmitter.setMaxListeners(500);

function loadFromDisk(): void {
  try {
    if (!existsSync(ALERTS_FILE)) return;
    const raw = readFileSync(ALERTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    for (const item of parsed) {
      if (!item.fingerprint || !item.address) continue;
      if (seenFingerprints.has(item.fingerprint)) continue;
      const alert: StoredAlert = {
        ...item,
        alertedAt: new Date(item.alertedAt),
        holders: item.holders || 0,
      };
      seenFingerprints.add(alert.fingerprint);
      alertBuffer.push(alert);
    }

    alertBuffer.sort((a, b) => b.alertedAt.getTime() - a.alertedAt.getTime());

    if (alertBuffer.length > MAX_ALERTS) {
      const removed = alertBuffer.splice(MAX_ALERTS);
      for (const r of removed) seenFingerprints.delete(r.fingerprint);
    }

    if (alertBuffer.length > 0) {
      console.log(`[AlertStore] Loaded ${alertBuffer.length} alerts from disk`);
    }
  } catch (err) {
    console.error("[AlertStore] Failed to load from disk:", err instanceof Error ? err.message : err);
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveToDisk();
  }, 3000);
}

function saveToDisk(): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(ALERTS_FILE, JSON.stringify(alertBuffer.slice(0, MAX_ALERTS)), "utf-8");
  } catch (err) {
    console.error("[AlertStore] Failed to save to disk:", err instanceof Error ? err.message : err);
  }
}

loadFromDisk();

export function getHistoricalFingerprints(): Set<string> {
  return new Set(seenFingerprints);
}

export function pushAlert(alert: StoredAlert): void {
  if (seenFingerprints.has(alert.fingerprint)) {
    const idx = alertBuffer.findIndex((a) => a.fingerprint === alert.fingerprint);
    if (idx !== -1) {
      alertBuffer[idx] = { ...alertBuffer[idx], ...alert, alertedAt: alert.alertedAt };
    }
    alertEmitter.emit("alert", alert);
    scheduleSave();
    return;
  }

  seenFingerprints.add(alert.fingerprint);
  alertBuffer.unshift(alert);

  if (alertBuffer.length > MAX_ALERTS) {
    const removed = alertBuffer.pop();
    if (removed) seenFingerprints.delete(removed.fingerprint);
  }

  alertEmitter.emit("alert", alert);
  scheduleSave();
}

export function getAlerts(): StoredAlert[] {
  return alertBuffer.slice();
}

export function getAlertCount(): number {
  return alertBuffer.length;
}
