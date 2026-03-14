import EventEmitter from "events";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

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

const MAX_ALERTS = 500;
const ALERTS_FILE = join(process.cwd(), "data", "alerts.json");
const SAVE_DEBOUNCE_MS = 4_000;

function loadFromDisk(): { alerts: StoredAlert[]; fps: Set<string> } {
  try {
    if (!existsSync(ALERTS_FILE)) return { alerts: [], fps: new Set() };
    const raw = readFileSync(ALERTS_FILE, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { alerts: [], fps: new Set() };
    const alerts: StoredAlert[] = (parsed as any[])
      .filter((a) => a && typeof a.fingerprint === "string" && typeof a.address === "string")
      .map((a) => ({ ...a, alertedAt: new Date(a.alertedAt) }))
      .slice(0, MAX_ALERTS);
    const fps = new Set(alerts.map((a) => a.fingerprint));
    console.log(`[AlertStore] Loaded ${alerts.length} alerts from disk`);
    return { alerts, fps };
  } catch (err) {
    console.warn("[AlertStore] Could not load alerts from disk:", (err as Error).message);
    return { alerts: [], fps: new Set() };
  }
}

function saveToDisk(buffer: StoredAlert[]): void {
  try {
    const dir = dirname(ALERTS_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(ALERTS_FILE, JSON.stringify(buffer), "utf-8");
  } catch (err) {
    console.error("[AlertStore] Failed to save alerts to disk:", (err as Error).message);
  }
}

const { alerts: initialAlerts, fps: initialFps } = loadFromDisk();

const alertBuffer: StoredAlert[] = initialAlerts;
const seenFingerprints: Set<string> = initialFps;

export const alertEmitter = new EventEmitter();
alertEmitter.setMaxListeners(500);

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveToDisk(alertBuffer.slice());
    saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

export function pushAlert(alert: StoredAlert): void {
  if (seenFingerprints.has(alert.fingerprint)) {
    const idx = alertBuffer.findIndex((a) => a.fingerprint === alert.fingerprint);
    if (idx !== -1) {
      alertBuffer[idx] = { ...alertBuffer[idx], ...alert, alertedAt: alert.alertedAt };
      scheduleSave();
    }
    alertEmitter.emit("alert", alert);
    return;
  }

  seenFingerprints.add(alert.fingerprint);
  alertBuffer.unshift(alert);

  if (alertBuffer.length > MAX_ALERTS) {
    const removed = alertBuffer.pop();
    if (removed) seenFingerprints.delete(removed.fingerprint);
  }

  scheduleSave();
  alertEmitter.emit("alert", alert);
}

export function getAlerts(): StoredAlert[] {
  return alertBuffer.slice();
}

export function getAlertCount(): number {
  return alertBuffer.length;
}
