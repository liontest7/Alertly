const DEFAULT_ALERTLY_BASE_URL = "http://localhost:10000";
const ALERTLY_BASE_URL_STORAGE_KEY = "alertlyBaseUrl";
const LAST_ALERT_STORAGE_KEY = "lastAlertFingerprint";
const SESSION_ALERTS_KEY = "sessionAlerts";

type AlertItem = {
  address?: string;
  type?: string;
  change?: string;
  name?: string;
  symbol?: string;
  mc?: string;
  vol?: string;
  liquidity?: string;
  wallet?: string;
  walletBalance?: number;
};

function normalizeBaseUrl(input?: string | null) {
  if (!input) return DEFAULT_ALERTLY_BASE_URL;
  try {
    const normalized = new URL(input.trim());
    return normalized.origin;
  } catch {
    return DEFAULT_ALERTLY_BASE_URL;
  }
}

function getBaseUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([ALERTLY_BASE_URL_STORAGE_KEY], (result) => {
      resolve(normalizeBaseUrl(result?.[ALERTLY_BASE_URL_STORAGE_KEY]));
    });
  });
}

function getLastFingerprint(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.session.get([LAST_ALERT_STORAGE_KEY], (result) => {
      const value = result?.[LAST_ALERT_STORAGE_KEY];
      resolve(typeof value === "string" ? value : null);
    });
  });
}

function setLastFingerprint(fingerprint: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.session.set({ [LAST_ALERT_STORAGE_KEY]: fingerprint }, () => resolve());
  });
}

function saveSessionAlerts(alerts: AlertItem[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.session.set({ [SESSION_ALERTS_KEY]: alerts }, () => resolve());
  });
}

function createFingerprint(alert: AlertItem) {
  return [alert?.address || "unknown", alert?.type || "signal", alert?.change || "0"].join("|");
}

function getTokenDisplayName(alert: AlertItem): string {
  if (alert.symbol && alert.symbol !== "???") return alert.symbol;
  if (alert.name && alert.name !== "Unknown Token" && alert.name !== "Loading...") return alert.name;
  if (alert.address) return `${alert.address.slice(0, 4)}…${alert.address.slice(-4)}`;
  return "Unknown Token";
}

function buildNotificationMessage(alert: AlertItem): string {
  const parts: string[] = [];
  if (alert.type) parts.push(alert.type);
  if (alert.mc && alert.mc !== "N/A") parts.push(`MC ${alert.mc}`);
  if (alert.liquidity && alert.liquidity !== "N/A") parts.push(`Liq ${alert.liquidity}`);
  if (alert.vol && alert.vol !== "N/A") parts.push(`Vol ${alert.vol}`);
  if (alert.type === "WHALE BUY" && alert.walletBalance) {
    parts.push(`${Math.round(alert.walletBalance)} SOL wallet`);
  }
  return parts.join(" • ") || "New Solana Alert";
}

async function checkAlerts() {
  try {
    const baseUrl = await getBaseUrl();

    const syncRes = await fetch(`${baseUrl}/api/extension/sync`, {
      credentials: "include",
    });

    const syncData = await syncRes.json();
    const canUseFeed = syncData?.authenticated || syncData?.guestEnabled;
    if (!canUseFeed) return;

    if (syncData?.alertsEnabled === false) return;

    const alertsRes = await fetch(`${baseUrl}/api/alerts`, {
      credentials: "include",
    });

    if (!alertsRes.ok) return;
    const alerts = await alertsRes.json();
    if (!Array.isArray(alerts) || alerts.length === 0) {
      await saveSessionAlerts([]);
      return;
    }

    await saveSessionAlerts(alerts);

    const latest = alerts[0] as AlertItem;
    const fingerprint = createFingerprint(latest);
    const previousFingerprint = await getLastFingerprint();

    if (previousFingerprint === fingerprint) {
      return;
    }

    await setLastFingerprint(fingerprint);

    const displayName = getTokenDisplayName(latest);

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon128.png",
      title: `Alertly • ${displayName}`,
      message: buildNotificationMessage(latest),
      priority: 2,
    });
  } catch {
    // silent fail; extension retries on next alarm
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("checkAlerts", { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkAlerts") {
    checkAlerts();
  }
});


chrome.runtime.onStartup.addListener(() => {
  checkAlerts();
});

checkAlerts();
