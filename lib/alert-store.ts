import EventEmitter from "events";

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
  pairAddress?: string;
  priceUsd?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  boostLevel?: string;
  boostAmount?: number;
  dex?: string;
}

const MAX_ALERTS = 200;
const alertBuffer: StoredAlert[] = [];
const seenFingerprints = new Set<string>();

export const alertEmitter = new EventEmitter();
alertEmitter.setMaxListeners(500);

export function pushAlert(alert: StoredAlert): void {
  if (seenFingerprints.has(alert.fingerprint)) {
    const idx = alertBuffer.findIndex((a) => a.fingerprint === alert.fingerprint);
    if (idx !== -1) {
      alertBuffer[idx] = { ...alertBuffer[idx], ...alert, alertedAt: alert.alertedAt };
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

  alertEmitter.emit("alert", alert);
}

export function getAlerts(): StoredAlert[] {
  return alertBuffer.slice();
}

export function getAlertCount(): number {
  return alertBuffer.length;
}
