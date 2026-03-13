import React from "react";
import { createRoot } from "react-dom/client";

const PRODUCTION_URL = "https://alertly-5zmw.onrender.com";
const ALERTLY_BASE_URL_STORAGE_KEY = "alertlyBaseUrl";

type AlertItem = {
  address?: string;
  name?: string;
  symbol?: string;
  type?: string;
  mc?: string;
  vol?: string;
  liquidity?: string;
  change?: string;
  boostAmount?: number;
};

type UserSettings = {
  alertsEnabled?: boolean;
  dexBoostEnabled?: boolean;
  dexListingEnabled?: boolean;
  minMarketCap?: number;
  maxMarketCap?: number;
  minLiquidity?: number;
  minHolders?: number;
  sources?: string[];
  selectedBoostLevel?: string;
  autoTrade?: boolean;
  buyAmount?: number;
  maxBuyPerToken?: number;
  slippage?: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: boolean;
  autoSellMinutes?: number;
};

type SyncUser = {
  walletAddress?: string;
  vipLevel?: string | number;
  telegramLinked?: boolean;
  settings?: UserSettings;
  wallets?: { publicKey: string }[];
};

type SyncData = {
  authenticated: boolean;
  guestEnabled?: boolean;
  alertsEnabled?: boolean;
  user?: SyncUser;
};

type ExtSettings = {
  paused: boolean;
  popupEnabled: boolean;
};

type FilterSettings = {
  dexBoostEnabled?: boolean;
  dexListingEnabled?: boolean;
  minMarketCap?: number;
  maxMarketCap?: number;
  minLiquidity?: number;
};

// ─── Storage helpers ─────────────────────────────────────────────
function getStoredBaseUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([ALERTLY_BASE_URL_STORAGE_KEY], (result) => {
      const val = result?.[ALERTLY_BASE_URL_STORAGE_KEY];
      if (val) {
        try { resolve(new URL(val.trim()).origin); return; } catch {}
      }
      resolve(PRODUCTION_URL);
    });
  });
}

function setStoredBaseUrl(value: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const origin = new URL(value.trim()).origin;
      chrome.storage.sync.set({ [ALERTLY_BASE_URL_STORAGE_KEY]: origin }, () => resolve());
    } catch {
      resolve();
    }
  });
}

function getExtSettings(): Promise<ExtSettings> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_EXT_SETTINGS" }, (res) => {
      resolve(res || { paused: false, popupEnabled: true });
    });
  });
}

function setExtSettings(settings: ExtSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "SET_EXT_SETTINGS", settings }, () => resolve());
  });
}

function getFilterSettings(): Promise<FilterSettings> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_FILTER_SETTINGS" }, (res) => {
      resolve(res || {});
    });
  });
}

// ─── Sound ───────────────────────────────────────────────────────
function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

// ─── Alert type helpers ──────────────────────────────────────────
const TYPE_LABEL_MAP: Record<string, string> = {
  "DEX_BOOST": "DEX BOOST",
  "DEX BOOST": "DEX BOOST",
  "DEX_LISTING": "DEX LISTING",
  "DEX LISTING": "DEX LISTING",
};

const TYPE_COLOR_MAP: Record<string, string> = {
  "DEX BOOST": "#5100fd",
  "DEX LISTING": "#2563eb",
};

function normalizeType(raw?: string): string {
  if (!raw) return "SIGNAL";
  const upper = raw.toUpperCase().trim();
  return TYPE_LABEL_MAP[upper] || upper.replace(/_/g, " ");
}

// ─── Color tokens ─────────────────────────────────────────────────
const C = {
  bg: "#050507",
  surface: "#0d0d12",
  surfaceBorder: "#1a1a2e",
  accent: "#5100fd",
  accentHover: "#6610ff",
  accentLight: "rgba(81,0,253,0.12)",
  accentBorder: "rgba(81,0,253,0.35)",
  green: "#22c55e",
  greenLight: "rgba(34,197,94,0.12)",
  greenBorder: "rgba(34,197,94,0.35)",
  yellow: "#f59e0b",
  yellowLight: "rgba(245,158,11,0.12)",
  red: "#ef4444",
  redLight: "rgba(239,68,68,0.12)",
  redBorder: "rgba(239,68,68,0.35)",
  blue: "#2563eb",
  blueLight: "rgba(37,99,235,0.12)",
  blueBorder: "rgba(37,99,235,0.35)",
  text: "#ffffff",
  textMuted: "#9ca3af",
  textDim: "#6b7280",
  border: "#1f1f2e",
};

const s = {
  root: {
    width: 380,
    minHeight: 200,
    backgroundColor: C.bg,
    color: C.text,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 13,
    userSelect: "none" as const,
    overflow: "hidden",
  } as React.CSSProperties,

  header: {
    padding: "14px 16px 12px",
    borderBottom: `1px solid ${C.border}`,
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: `linear-gradient(180deg, #0a0a12 0%, ${C.bg} 100%)`,
  } as React.CSSProperties,

  logo: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: `1px solid rgba(255,255,255,0.08)`,
    flexShrink: 0,
  } as React.CSSProperties,

  headerText: { flex: 1 } as React.CSSProperties,

  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: C.text,
    letterSpacing: "-0.2px",
    margin: 0,
    lineHeight: 1.2,
  } as React.CSSProperties,

  headerSub: {
    fontSize: 10,
    color: C.textDim,
    margin: 0,
    marginTop: 1,
    letterSpacing: "0.02em",
  } as React.CSSProperties,

  card: {
    backgroundColor: C.surface,
    border: `1px solid ${C.surfaceBorder}`,
    borderRadius: 12,
    padding: "12px 14px",
  } as React.CSSProperties,

  pill: (color: string, bg: string, border: string): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "3px 9px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.06em",
    color,
    backgroundColor: bg,
    border: `1px solid ${border}`,
  }),

  btn: (variant: "primary" | "ghost" | "danger"): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: variant === "primary" ? "11px 16px" : "7px 12px",
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: variant === "primary" ? 13 : 11,
    letterSpacing: variant === "primary" ? "0.02em" : "0.04em",
    transition: "opacity 0.15s",
    width: variant === "primary" ? "100%" : "auto",
    ...(variant === "primary" && {
      background: `linear-gradient(135deg, ${C.accent} 0%, #7c3aed 100%)`,
      color: "#fff",
      boxShadow: `0 4px 16px rgba(81,0,253,0.35)`,
    }),
    ...(variant === "ghost" && {
      backgroundColor: C.surfaceBorder,
      color: C.textMuted,
    }),
    ...(variant === "danger" && {
      backgroundColor: C.redLight,
      border: `1px solid ${C.redBorder}`,
      color: C.red,
    }),
  }),

  tab: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "8px 0",
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: active ? 700 : 500,
    color: active ? C.accent : C.textMuted,
    backgroundColor: "transparent",
    borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
    transition: "all 0.15s",
    letterSpacing: "0.05em",
  }),

  divider: {
    height: 1,
    backgroundColor: C.border,
    margin: "0 16px",
  } as React.CSSProperties,

  statRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    borderBottom: `1px solid rgba(255,255,255,0.04)`,
  } as React.CSSProperties,

  statLabel: { fontSize: 11, color: C.textMuted } as React.CSSProperties,
  statValue: { fontSize: 11, fontWeight: 600, color: C.text } as React.CSSProperties,
};

// ─── Toggle Switch component ──────────────────────────────────────
function ToggleSwitch({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: `1px solid rgba(255,255,255,0.04)`,
      }}
    >
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        onClick={() => onChange(!on)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          backgroundColor: on ? C.accent : C.surfaceBorder,
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: on ? 21 : 3,
            width: 16,
            height: 16,
            borderRadius: "50%",
            backgroundColor: "#fff",
            transition: "left 0.2s",
          }}
        />
      </button>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────
function shortWallet(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function formatNum(n?: number | null) {
  if (n == null || n === 0) return "Any";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

// ─── Sub-components ────────────────────────────────────────────────
function StatusPill({ status }: { status: "live" | "connecting" | "offline" | "paused" }) {
  const map = {
    live: { label: "LIVE", color: C.green, bg: C.greenLight, border: C.greenBorder, dot: C.green },
    connecting: { label: "CONNECTING", color: C.yellow, bg: C.yellowLight, border: "rgba(245,158,11,0.35)", dot: C.yellow },
    offline: { label: "OFFLINE", color: C.red, bg: C.redLight, border: C.redBorder, dot: C.red },
    paused: { label: "PAUSED", color: C.textMuted, bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.25)", dot: C.textMuted },
  }[status];

  return (
    <span style={s.pill(map.color, map.bg, map.border)}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", backgroundColor: map.dot, display: "inline-block",
        ...(status === "live" ? { boxShadow: `0 0 6px ${map.dot}` } : {})
      }} />
      {map.label}
    </span>
  );
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const name = alert.symbol || alert.name || shortWallet(alert.address);
  const typeLabel = normalizeType(alert.type);
  const typeColor = TYPE_COLOR_MAP[typeLabel] || C.accent;
  const isBoost = typeLabel === "DEX BOOST";
  const isListing = typeLabel === "DEX LISTING";

  return (
    <div style={{
      ...s.card,
      display: "flex",
      flexDirection: "column",
      gap: 6,
      padding: "10px 12px",
      borderLeft: `3px solid ${typeColor}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: C.text }}>{name}</span>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#fff",
          backgroundColor: typeColor,
          padding: "2px 7px",
          borderRadius: 4,
          letterSpacing: "0.05em",
        }}>
          {isBoost ? "⚡ " : isListing ? "📋 " : ""}{typeLabel}
        </span>
      </div>
      <div style={{ display: "flex", gap: 10, fontSize: 10, color: C.textMuted, flexWrap: "wrap" as const }}>
        {alert.mc && alert.mc !== "N/A" && <span>MC <span style={{ color: C.text }}>{alert.mc}</span></span>}
        {alert.vol && alert.vol !== "N/A" && <span>VOL <span style={{ color: C.text }}>{alert.vol}</span></span>}
        {alert.liquidity && alert.liquidity !== "N/A" && <span>LIQ <span style={{ color: C.text }}>{alert.liquidity}</span></span>}
        {alert.boostAmount != null && <span>BOOST <span style={{ color: C.accent }}>×{alert.boostAmount}</span></span>}
        {alert.change && alert.change !== "N/A" && (
          <span style={{ color: alert.change.startsWith("-") ? C.red : C.green }}>{alert.change}</span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message, icon }: { message: string; icon: string }) {
  return (
    <div style={{ textAlign: "center" as const, padding: "24px 16px", color: C.textDim }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>{message}</p>
    </div>
  );
}

// ─── Main Popup ────────────────────────────────────────────────────
const Popup = () => {
  const [phase, setPhase] = React.useState<"loading" | "unauthenticated" | "main">("loading");
  const [tab, setTab] = React.useState<"alerts" | "settings">("alerts");
  const [syncData, setSyncData] = React.useState<SyncData | null>(null);
  const [alerts, setAlerts] = React.useState<AlertItem[]>([]);
  const [streamStatus, setStreamStatus] = React.useState<"connecting" | "live" | "offline">("connecting");
  const [lastSynced, setLastSynced] = React.useState<string>("");
  const [syncing, setSyncing] = React.useState(false);
  const [baseUrl, setBaseUrl] = React.useState(PRODUCTION_URL);
  const [extSettings, setExtSettingsState] = React.useState<ExtSettings>({ paused: false, popupEnabled: true });
  const [filterSettings, setFilterSettings] = React.useState<FilterSettings>({});
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [filterSyncSource, setFilterSyncSource] = React.useState<"website" | "none">("none");
  const prevAlertCountRef = React.useRef(0);
  const baseUrlRef = React.useRef(PRODUCTION_URL);
  const esRef = React.useRef<EventSource | null>(null);

  function openDashboard() {
    chrome.tabs.create({ url: `${baseUrlRef.current}/dashboard` });
  }

  function openLogin() {
    chrome.tabs.create({ url: baseUrlRef.current });
  }

  async function updateExtSettings(patch: Partial<ExtSettings>) {
    const next = { ...extSettings, ...patch };
    setExtSettingsState(next);
    await setExtSettings(next);
  }

  async function doSync(url?: string) {
    const base = url || baseUrlRef.current;
    setSyncing(true);
    try {
      const res = await fetch(`${base}/api/extension/sync`, {
        credentials: "include",
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error("sync failed");
      const data: SyncData = await res.json();
      setSyncData(data);
      setLastSynced(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

      if (data.authenticated || data.guestEnabled) {
        setPhase("main");
      } else {
        setPhase("unauthenticated");
      }
    } catch {
      if (phase === "loading") setPhase("unauthenticated");
    } finally {
      setSyncing(false);
    }
  }

  function connectStream(base: string) {
    if (esRef.current) esRef.current.close();
    setStreamStatus("connecting");
    const es = new EventSource(`${base}/api/alerts/stream`, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => setStreamStatus("live");

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "ping") return;
        if (data.type === "alert" && data.alert) {
          setAlerts((prev) => {
            const exists = prev.some((a) => a.address === data.alert.address && a.type === data.alert.type);
            if (exists) return prev;
            return [data.alert, ...prev].slice(0, 50);
          });
        }
        if (data.type === "history" && Array.isArray(data.alerts)) {
          setAlerts(data.alerts.slice(0, 50));
          setStreamStatus("live");
        }
      } catch {}
    };

    es.onerror = () => setStreamStatus("offline");
  }

  React.useEffect(() => {
    (async () => {
      const [stored, ext, filters] = await Promise.all([
        getStoredBaseUrl(),
        getExtSettings(),
        getFilterSettings(),
      ]);
      setBaseUrl(stored);
      baseUrlRef.current = stored;
      setExtSettingsState(ext);

      const hasFilters = Object.keys(filters).length > 0;
      if (hasFilters) {
        setFilterSettings(filters);
        setFilterSyncSource("website");
      }

      await doSync(stored);
      connectStream(stored);
    })();
    return () => { esRef.current?.close(); };
  }, []);

  React.useEffect(() => {
    if (soundEnabled && alerts.length > prevAlertCountRef.current && prevAlertCountRef.current > 0) {
      playAlertSound();
    }
    prevAlertCountRef.current = alerts.length;
  }, [alerts.length, soundEnabled]);

  // ── Loading ──────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div style={{ ...s.root, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 160, gap: 10 }}>
        <div style={{
          width: 32, height: 32, border: `3px solid ${C.surfaceBorder}`, borderTop: `3px solid ${C.accent}`,
          borderRadius: "50%", animation: "spin 0.8s linear infinite",
        }} />
        <p style={{ margin: 0, fontSize: 11, color: C.textDim }}>Connecting to Alertly…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Unauthenticated ──────────────────────────────────────────────
  if (phase === "unauthenticated") {
    return (
      <div style={s.root}>
        <div style={s.header}>
          <img src="icon128.png" style={s.logo} />
          <div style={s.headerText}>
            <p style={s.headerTitle}>Alertly</p>
            <p style={s.headerSub}>SOLANA INTELLIGENCE</p>
          </div>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...s.card, textAlign: "center" as const, padding: "20px 16px" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🔗</div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Connect your account</p>
            <p style={{ margin: 0, fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>
              Visit the Alertly dashboard to start receiving alerts. Your filter settings will sync here automatically.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button style={s.btn("primary")} onClick={openLogin}>Open Alertly Dashboard</button>
            <button style={{ ...s.btn("ghost"), width: "100%", fontSize: 11 }} onClick={() => doSync()}>
              {syncing ? "Checking…" : "↻  Already set up? Sync now"}
            </button>
          </div>

          <div style={{ ...s.card, padding: "10px 12px" }}>
            <p style={{ margin: 0, fontSize: 10, color: C.textDim, marginBottom: 6, fontWeight: 600, letterSpacing: "0.05em" }}>DASHBOARD URL</p>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              onBlur={async () => {
                try {
                  const origin = new URL(baseUrl).origin;
                  setBaseUrl(origin);
                  baseUrlRef.current = origin;
                  await setStoredBaseUrl(origin);
                  await doSync(origin);
                  connectStream(origin);
                } catch {}
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                borderBottom: `1px solid ${C.border}`,
                color: C.textMuted,
                fontSize: 11,
                fontFamily: "monospace",
                outline: "none",
                padding: "4px 0",
                boxSizing: "border-box" as const,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────
  const user = syncData?.user;
  const isGuest = !syncData?.authenticated && syncData?.guestEnabled;

  const displayedAlerts = extSettings.paused ? [] : alerts;

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <img src="icon128.png" style={s.logo} />
        <div style={s.headerText}>
          <p style={s.headerTitle}>Alertly</p>
          <p style={s.headerSub}>
            {isGuest
              ? "GUEST MODE · " + new URL(baseUrl).hostname
              : (shortWallet(user?.walletAddress) + (user?.vipLevel ? ` · ${user.vipLevel}` : ""))
            }
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusPill status={extSettings.paused ? "paused" : streamStatus} />
          <button
            onClick={() => doSync()}
            title="Sync"
            style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 14, padding: 2, lineHeight: 1 }}
          >
            {syncing ? "⟳" : "↻"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, padding: "0 16px" }}>
        <button style={s.tab(tab === "alerts")} onClick={() => setTab("alerts")}>ALERTS</button>
        <button style={s.tab(tab === "settings")} onClick={() => setTab("settings")}>SETTINGS</button>
      </div>

      {/* Tab: Alerts */}
      {tab === "alerts" && (
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: C.textDim }}>
              {lastSynced ? `Synced ${lastSynced}` : "Syncing…"}
            </span>
            <button
              onClick={() => updateExtSettings({ paused: !extSettings.paused })}
              style={{ ...s.btn(extSettings.paused ? "primary" : "ghost"), padding: "5px 11px", fontSize: 10, borderRadius: 999 }}
            >
              {extSettings.paused ? "▶  Resume" : "⏸  Pause"}
            </button>
          </div>

          {extSettings.paused ? (
            <EmptyState icon="⏸" message="Alerts are paused. Click Resume to continue receiving signals." />
          ) : streamStatus === "connecting" ? (
            <EmptyState icon="⟳" message="Connecting to live stream…" />
          ) : displayedAlerts.length === 0 ? (
            <EmptyState icon="📡" message="No alerts yet. Monitoring for new signals according to your filter settings." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
              {displayedAlerts.map((alert, i) => (
                <AlertCard key={i} alert={alert} />
              ))}
            </div>
          )}

          <button style={s.btn("primary")} onClick={openDashboard}>
            Open Full Dashboard ↗
          </button>
        </div>
      )}

      {/* Tab: Settings */}
      {tab === "settings" && (
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>

          {/* Sync status */}
          {filterSyncSource === "website" && (
            <div style={{
              ...s.card,
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
              backgroundColor: C.accentLight,
              border: `1px solid ${C.accentBorder}`,
            }}>
              <span style={{ fontSize: 14 }}>🔗</span>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.text }}>Synced from Alertly website</p>
                <p style={{ margin: 0, fontSize: 10, color: C.textMuted }}>Filter settings loaded from your browser cookies</p>
              </div>
            </div>
          )}

          {/* Extension controls */}
          <p style={{ margin: "4px 0 6px", fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "0.07em" }}>EXTENSION CONTROLS</p>

          <ToggleSwitch
            on={!extSettings.paused}
            onChange={(v) => updateExtSettings({ paused: !v })}
            label="Receive Alerts"
            sub="Enable or pause all alert monitoring"
          />

          <ToggleSwitch
            on={extSettings.popupEnabled}
            onChange={(v) => updateExtSettings({ popupEnabled: v })}
            label="Desktop Notifications"
            sub="Show system popups when new alerts arrive"
          />

          <ToggleSwitch
            on={soundEnabled}
            onChange={(v) => setSoundEnabled(v)}
            label="Sound (in popup)"
            sub="Play a sound when new alerts appear in this popup"
          />

          {/* Active filter summary */}
          {(filterSettings.dexBoostEnabled !== undefined || filterSettings.minMarketCap || filterSettings.minLiquidity) && (
            <>
              <p style={{ margin: "12px 0 6px", fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "0.07em" }}>ACTIVE FILTERS</p>
              <div style={{ ...s.card, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                {filterSettings.dexBoostEnabled === false && (
                  <div style={{ fontSize: 11, color: C.textMuted }}>⛔ DEX Boost — disabled</div>
                )}
                {filterSettings.dexListingEnabled === false && (
                  <div style={{ fontSize: 11, color: C.textMuted }}>⛔ DEX Listing — disabled</div>
                )}
                {filterSettings.minMarketCap != null && filterSettings.minMarketCap > 0 && (
                  <div style={{ fontSize: 11, color: C.textMuted }}>Min Market Cap: <span style={{ color: C.text }}>{formatNum(filterSettings.minMarketCap)}</span></div>
                )}
                {filterSettings.maxMarketCap != null && filterSettings.maxMarketCap > 0 && (
                  <div style={{ fontSize: 11, color: C.textMuted }}>Max Market Cap: <span style={{ color: C.text }}>{formatNum(filterSettings.maxMarketCap)}</span></div>
                )}
                {filterSettings.minLiquidity != null && filterSettings.minLiquidity > 0 && (
                  <div style={{ fontSize: 11, color: C.textMuted }}>Min Liquidity: <span style={{ color: C.text }}>{formatNum(filterSettings.minLiquidity)}</span></div>
                )}
              </div>
            </>
          )}

          <div style={{ marginTop: 8 }}>
            <button style={{ ...s.btn("ghost"), width: "100%", fontSize: 11 }} onClick={openDashboard}>
              Change filters on Alertly dashboard ↗
            </button>
          </div>

          {/* URL config */}
          <div style={{ ...s.card, padding: "10px 12px", marginTop: 8 }}>
            <p style={{ margin: 0, fontSize: 10, color: C.textDim, marginBottom: 6, fontWeight: 600, letterSpacing: "0.05em" }}>DASHBOARD URL</p>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              onBlur={async () => {
                try {
                  const origin = new URL(baseUrl).origin;
                  setBaseUrl(origin);
                  baseUrlRef.current = origin;
                  await setStoredBaseUrl(origin);
                  await doSync(origin);
                  connectStream(origin);
                } catch {}
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                borderBottom: `1px solid ${C.border}`,
                color: C.textMuted,
                fontSize: 11,
                fontFamily: "monospace",
                outline: "none",
                padding: "4px 0",
                boxSizing: "border-box" as const,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const root = document.getElementById("root")!;
createRoot(root).render(<Popup />);
