const DEFAULT_ALERTLY_BASE_URL = "https://alertly-5zmw.onrender.com";
const ALERTLY_BASE_URL_STORAGE_KEY = "alertlyBaseUrl";
const LAST_ALERT_STORAGE_KEY = "lastAlertFingerprint";
const SESSION_ALERTS_KEY = "sessionAlerts";
const EXT_SETTINGS_KEY = "extSettings";

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
  boostAmount?: number;
};

type FilterSettings = {
  dexBoostEnabled?: boolean;
  dexListingEnabled?: boolean;
  minMarketCap?: number;
  maxMarketCap?: number;
  minLiquidity?: number;
  minHolders?: number;
  sources?: string[];
  selectedBoostLevel?: string;
  alertsEnabled?: boolean;
};

type ExtSettings = {
  paused: boolean;
  popupEnabled: boolean;
};

const DEFAULT_EXT_SETTINGS: ExtSettings = {
  paused: false,
  popupEnabled: true,
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

function getExtSettings(): Promise<ExtSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get([EXT_SETTINGS_KEY], (result) => {
      const stored = result?.[EXT_SETTINGS_KEY];
      resolve({ ...DEFAULT_EXT_SETTINGS, ...(stored || {}) });
    });
  });
}

function decodeBase64urlCookie(value: string): FilterSettings | null {
  try {
    const urlDecoded = decodeURIComponent(value);
    const b64 = urlDecoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as FilterSettings;
  } catch {
    return null;
  }
}

function getWebsiteFilterSettings(baseUrl: string): Promise<FilterSettings> {
  return new Promise((resolve) => {
    try {
      chrome.cookies.get({ url: baseUrl, name: "alertly_guest_settings" }, (cookie) => {
        if (!cookie?.value) {
          resolve({});
          return;
        }
        const settings = decodeBase64urlCookie(cookie.value);
        resolve(settings || {});
      });
    } catch {
      resolve({});
    }
  });
}

function parseMoney(val?: string): number {
  if (!val || val === "N/A") return 0;
  const clean = val.replace(/[$,\s]/g, "").toUpperCase();
  if (clean.endsWith("B")) return parseFloat(clean) * 1_000_000_000;
  if (clean.endsWith("M")) return parseFloat(clean) * 1_000_000;
  if (clean.endsWith("K")) return parseFloat(clean) * 1_000;
  return parseFloat(clean) || 0;
}

function normalizeType(raw?: string): string {
  if (!raw) return "SIGNAL";
  const upper = raw.toUpperCase().trim();
  const map: Record<string, string> = {
    DEX_BOOST: "DEX BOOST",
    "DEX BOOST": "DEX BOOST",
    DEX_LISTING: "DEX LISTING",
    "DEX LISTING": "DEX LISTING",
  };
  return map[upper] || upper.replace(/_/g, " ");
}

function alertMatchesFilter(alert: AlertItem, filter: FilterSettings): boolean {
  const type = normalizeType(alert.type);

  if (type === "DEX BOOST" && filter.dexBoostEnabled === false) return false;
  if (type === "DEX LISTING" && filter.dexListingEnabled === false) return false;

  if (filter.minMarketCap || filter.maxMarketCap) {
    const mc = parseMoney(alert.mc);
    if (mc > 0) {
      if (filter.minMarketCap && mc < filter.minMarketCap) return false;
      if (filter.maxMarketCap && mc > filter.maxMarketCap) return false;
    }
  }

  if (filter.minLiquidity) {
    const liq = parseMoney(alert.liquidity);
    if (liq > 0 && liq < filter.minLiquidity) return false;
  }

  return true;
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
  if (alert.type) parts.push(normalizeType(alert.type));
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
    const [baseUrl, extSettings] = await Promise.all([getBaseUrl(), getExtSettings()]);

    if (extSettings.paused) return;

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
    const allAlerts = await alertsRes.json();
    if (!Array.isArray(allAlerts) || allAlerts.length === 0) {
      await saveSessionAlerts([]);
      return;
    }

    const filterSettings = await getWebsiteFilterSettings(baseUrl);

    const filteredAlerts = allAlerts.filter((a) => alertMatchesFilter(a as AlertItem, filterSettings));

    await saveSessionAlerts(filteredAlerts);

    if (filteredAlerts.length === 0) return;

    const latest = filteredAlerts[0] as AlertItem;
    const fingerprint = createFingerprint(latest);
    const previousFingerprint = await getLastFingerprint();

    if (previousFingerprint === fingerprint) {
      return;
    }

    await setLastFingerprint(fingerprint);

    if (!extSettings.popupEnabled) return;

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_EXT_SETTINGS") {
    getExtSettings().then(sendResponse);
    return true;
  }
  if (message.type === "SET_EXT_SETTINGS") {
    chrome.storage.local.set({ [EXT_SETTINGS_KEY]: message.settings }, () => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "GET_FILTER_SETTINGS") {
    getBaseUrl().then((url) => getWebsiteFilterSettings(url).then(sendResponse));
    return true;
  }
});

checkAlerts();
