import React from "react";
import { createRoot } from "react-dom/client";

const PRODUCTION_URL = "https://alertly-5zmw.onrender.com";
const ALERTLY_BASE_URL_STORAGE_KEY = "alertlyBaseUrl";
const LAST_ALERT_STORAGE_KEY = "lastAlertFingerprint";

type AlertItem = {
  address?: string;
  name?: string;
  symbol?: string;
  type?: string;
  mc?: string;
  vol?: string;
  liquidity?: string;
  change?: string;
  wallet?: string;
  walletBalance?: number;
};

type SyncUser = {
  walletAddress?: string;
  vipLevel?: string | number;
  telegramLinked?: boolean;
  settings?: {
    alertsEnabled?: boolean;
    minMarketCap?: number;
    maxMarketCap?: number;
    minLiquidity?: number;
    minVolume?: number;
    autoBuyEnabled?: boolean;
    autoBuyAmount?: number;
    stopLoss?: number;
    takeProfit?: number;
  };
  wallets?: { publicKey: string }[];
};

type SyncData = {
  authenticated: boolean;
  guestEnabled?: boolean;
  alertsEnabled?: boolean;
  user?: SyncUser;
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

// ─── Color tokens ─────────────────────────────────────────────────
const C = {
  bg: "#050507",
  surface: "#0d0d12",
  surfaceBorder: "#1a1a2e",
  surfaceHover: "#13131c",
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
  text: "#ffffff",
  textMuted: "#9ca3af",
  textDim: "#6b7280",
  border: "#1f1f2e",
};

// ─── Base styles ───────────────────────────────────────────────────
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

  headerText: {
    flex: 1,
  } as React.CSSProperties,

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

  statLabel: {
    fontSize: 11,
    color: C.textMuted,
  } as React.CSSProperties,

  statValue: {
    fontSize: 11,
    fontWeight: 600,
    color: C.text,
  } as React.CSSProperties,
};

// ─── Helpers ───────────────────────────────────────────────────────
function shortWallet(addr?: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function formatNum(n?: number | null, suffix = "") {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M${suffix}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K${suffix}`;
  return `${n}${suffix}`;
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
      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: map.dot, display: "inline-block", ...(status === "live" ? { boxShadow: `0 0 6px ${map.dot}` } : {}) }} />
      {map.label}
    </span>
  );
}

function AlertCard({ alert }: { alert: AlertItem }) {
  const name = alert.symbol || alert.name || shortWallet(alert.address);
  const typeColor = alert.type?.includes("WHALE") ? "#a78bfa"
    : alert.type?.includes("BUY") ? C.green
    : alert.type?.includes("SELL") ? C.red
    : C.accent;

  return (
    <div style={{
      ...s.card,
      display: "flex",
      flexDirection: "column",
      gap: 6,
      padding: "10px 12px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: C.text }}>{name}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: typeColor, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{alert.type || "Signal"}</span>
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 10, color: C.textMuted }}>
        {alert.mc && alert.mc !== "N/A" && <span>MC <span style={{ color: C.text }}>{alert.mc}</span></span>}
        {alert.vol && alert.vol !== "N/A" && <span>VOL <span style={{ color: C.text }}>{alert.vol}</span></span>}
        {alert.liquidity && alert.liquidity !== "N/A" && <span>LIQ <span style={{ color: C.text }}>{alert.liquidity}</span></span>}
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
  const [tab, setTab] = React.useState<"alerts" | "account">("alerts");
  const [alerts, setAlerts] = React.useState<AlertItem[]>([]);
  const [syncData, setSyncData] = React.useState<SyncData | null>(null);
  const [baseUrl, setBaseUrl] = React.useState(PRODUCTION_URL);
  const [streamStatus, setStreamStatus] = React.useState<"live" | "connecting" | "offline" | "paused">("offline");
  const [toggling, setToggling] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [lastSynced, setLastSynced] = React.useState<string | null>(null);
  const baseUrlRef = React.useRef(PRODUCTION_URL);
  const streamRef = React.useRef<EventSource | null>(null);

  const alertsEnabled = syncData?.alertsEnabled !== false && syncData?.user?.settings?.alertsEnabled !== false;

  const doSync = React.useCallback(async (url: string, quiet = false) => {
    if (!quiet) setSyncing(true);
    try {
      const res = await fetch(`${url}/api/extension/sync`, { credentials: "include" });
      if (!res.ok) throw new Error("sync failed");
      const data: SyncData = await res.json();
      setSyncData(data);
      setLastSynced(new Date().toLocaleTimeString());

      if (!data.authenticated && !data.guestEnabled) {
        setPhase("unauthenticated");
        setStreamStatus("offline");
        return;
      }

      setPhase("main");

      const enabled = data.alertsEnabled !== false && data.user?.settings?.alertsEnabled !== false;

      if (!enabled) {
        setStreamStatus("paused");
        setAlerts([]);
        closeStream();
        return;
      }

      openStream(url);
    } catch {
      if (!quiet) setPhase("unauthenticated");
    } finally {
      if (!quiet) setSyncing(false);
    }
  }, []);

  function closeStream() {
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
  }

  function openStream(url: string) {
    closeStream();
    setStreamStatus("connecting");
    const es = new EventSource(`${url}/api/alerts/stream`, { withCredentials: true });
    streamRef.current = es;

    es.addEventListener("alerts", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        if (Array.isArray(payload)) {
          setAlerts(payload);
          setStreamStatus("live");
        }
      } catch {}
    });

    es.addEventListener("heartbeat", () => setStreamStatus("live"));

    es.addEventListener("paused", () => {
      setStreamStatus("paused");
      setAlerts([]);
      closeStream();
    });

    es.onerror = () => setStreamStatus("offline");
  }

  React.useEffect(() => {
    let mounted = true;
    getStoredBaseUrl().then((url) => {
      if (!mounted) return;
      setBaseUrl(url);
      baseUrlRef.current = url;
      doSync(url);
    });
    return () => {
      mounted = false;
      closeStream();
    };
  }, []);

  const handleToggleAlerts = async () => {
    if (!syncData?.authenticated) return;
    setToggling(true);
    try {
      const newEnabled = !alertsEnabled;
      const res = await fetch(`${baseUrlRef.current}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ alertsEnabled: newEnabled }),
      });
      if (res.ok) {
        setSyncData((prev) => prev ? {
          ...prev,
          alertsEnabled: newEnabled,
          user: prev.user ? { ...prev.user, settings: { ...prev.user.settings, alertsEnabled: newEnabled } } : prev.user,
        } : prev);
        if (!newEnabled) {
          setStreamStatus("paused");
          setAlerts([]);
          closeStream();
        } else {
          openStream(baseUrlRef.current);
        }
      }
    } catch {} finally {
      setToggling(false);
    }
  };

  const handleRefresh = async () => {
    setSyncing(true);
    await doSync(baseUrlRef.current, true);
    setSyncing(false);
  };

  const openDashboard = () => window.open(`${baseUrlRef.current}/dashboard`, "_blank");
  const openLogin = () => window.open(`${baseUrlRef.current}`, "_blank");

  // ── Loading ──────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div style={{ ...s.root, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
        <img src="icon128.png" width={48} height={48} style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)" }} />
        <p style={{ color: C.textMuted, fontSize: 12, margin: 0 }}>Connecting to Alertly…</p>
        <div style={{ width: 120, height: 2, backgroundColor: C.surfaceBorder, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: "40%", backgroundColor: C.accent, borderRadius: 999, animation: "pulse 1.2s ease-in-out infinite" }} />
        </div>
      </div>
    );
  }

  // ── Unauthenticated ──────────────────────────────────────────────
  if (phase === "unauthenticated") {
    return (
      <div style={s.root}>
        <div style={{ ...s.header }}>
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
              Log in to Alertly to sync your filters, trading wallet, alert history, and settings across all platforms.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button style={s.btn("primary")} onClick={openLogin}>
              Open Alertly & Connect
            </button>
            <button style={{ ...s.btn("ghost"), width: "100%", fontSize: 11 }} onClick={handleRefresh}>
              {syncing ? "Checking…" : "↻  Already logged in? Sync now"}
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
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────
  const user = syncData?.user;
  const settings = user?.settings;

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <img src="icon128.png" style={s.logo} />
        <div style={s.headerText}>
          <p style={s.headerTitle}>Alertly</p>
          <p style={s.headerSub}>{shortWallet(user?.walletAddress)} {user?.vipLevel ? `· ${user.vipLevel}` : ""}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusPill status={alertsEnabled ? streamStatus : "paused"} />
          <button
            onClick={handleRefresh}
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
        <button style={s.tab(tab === "account")} onClick={() => setTab("account")}>ACCOUNT</button>
      </div>

      {/* Tab: Alerts */}
      {tab === "alerts" && (
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Controls */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: C.textDim }}>
              {lastSynced ? `Synced ${lastSynced}` : "Syncing…"}
            </span>
            <button
              onClick={handleToggleAlerts}
              disabled={toggling}
              style={{
                ...s.btn(alertsEnabled ? "ghost" : "primary"),
                padding: "5px 11px",
                fontSize: 10,
                borderRadius: 999,
              }}
            >
              {toggling ? "…" : alertsEnabled ? "⏸  Pause" : "▶  Resume"}
            </button>
          </div>

          {/* Feed */}
          {!alertsEnabled ? (
            <EmptyState icon="⏸" message="Alerts are paused. Click Resume to start receiving signals." />
          ) : streamStatus === "connecting" ? (
            <EmptyState icon="⟳" message="Connecting to live stream…" />
          ) : alerts.length === 0 ? (
            <EmptyState icon="📡" message="No alerts right now. Your filters are active and monitoring." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
              {alerts.slice(0, 10).map((a, i) => <AlertCard key={i} alert={a} />)}
            </div>
          )}

          {/* Open Dashboard */}
          <button style={s.btn("primary")} onClick={openDashboard}>
            Open Dashboard
          </button>
        </div>
      )}

      {/* Tab: Account */}
      {tab === "account" && (
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Identity */}
          <div style={s.card}>
            <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "0.07em" }}>IDENTITY</p>
            <div style={s.statRow}>
              <span style={s.statLabel}>Wallet</span>
              <span style={{ ...s.statValue, fontFamily: "monospace", fontSize: 10 }}>{shortWallet(user?.walletAddress)}</span>
            </div>
            <div style={s.statRow}>
              <span style={s.statLabel}>Level</span>
              <span style={{ ...s.statValue, color: C.accent }}>{user?.vipLevel || "Free"}</span>
            </div>
            <div style={{ ...s.statRow, borderBottom: "none" }}>
              <span style={s.statLabel}>Telegram</span>
              <span style={{ ...s.statValue, color: user?.telegramLinked ? C.green : C.textDim }}>
                {user?.telegramLinked ? "✓ Linked" : "Not linked"}
              </span>
            </div>
          </div>

          {/* Filters */}
          <div style={s.card}>
            <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "0.07em" }}>ACTIVE FILTERS</p>
            <div style={s.statRow}>
              <span style={s.statLabel}>Alerts</span>
              <span style={{ ...s.statValue, color: settings?.alertsEnabled !== false ? C.green : C.red }}>
                {settings?.alertsEnabled !== false ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div style={s.statRow}>
              <span style={s.statLabel}>Min Market Cap</span>
              <span style={s.statValue}>{settings?.minMarketCap != null ? formatNum(settings.minMarketCap, " $") : "Any"}</span>
            </div>
            <div style={s.statRow}>
              <span style={s.statLabel}>Max Market Cap</span>
              <span style={s.statValue}>{settings?.maxMarketCap != null ? formatNum(settings.maxMarketCap, " $") : "Any"}</span>
            </div>
            <div style={s.statRow}>
              <span style={s.statLabel}>Min Liquidity</span>
              <span style={s.statValue}>{settings?.minLiquidity != null ? formatNum(settings.minLiquidity, " $") : "Any"}</span>
            </div>
            <div style={{ ...s.statRow, borderBottom: "none" }}>
              <span style={s.statLabel}>Min Volume</span>
              <span style={s.statValue}>{settings?.minVolume != null ? formatNum(settings.minVolume, " $") : "Any"}</span>
            </div>
          </div>

          {/* Auto-Trade */}
          <div style={s.card}>
            <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "0.07em" }}>AUTO-TRADE</p>
            <div style={s.statRow}>
              <span style={s.statLabel}>Status</span>
              <span style={{ ...s.statValue, color: settings?.autoBuyEnabled ? C.green : C.textDim }}>
                {settings?.autoBuyEnabled ? "Active" : "Off"}
              </span>
            </div>
            {settings?.autoBuyEnabled && (
              <>
                <div style={s.statRow}>
                  <span style={s.statLabel}>Buy Amount</span>
                  <span style={s.statValue}>{settings?.autoBuyAmount != null ? `${settings.autoBuyAmount} SOL` : "—"}</span>
                </div>
                <div style={s.statRow}>
                  <span style={s.statLabel}>Stop Loss</span>
                  <span style={{ ...s.statValue, color: C.red }}>{settings?.stopLoss != null ? `${settings.stopLoss}%` : "—"}</span>
                </div>
                <div style={{ ...s.statRow, borderBottom: "none" }}>
                  <span style={s.statLabel}>Take Profit</span>
                  <span style={{ ...s.statValue, color: C.green }}>{settings?.takeProfit != null ? `${settings.takeProfit}%` : "—"}</span>
                </div>
              </>
            )}
          </div>

          {/* Trading Wallet */}
          {user?.wallets && user.wallets.length > 0 && (
            <div style={s.card}>
              <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "0.07em" }}>TRADING WALLETS</p>
              {user.wallets.map((w, i) => (
                <div key={i} style={{ ...s.statRow, ...(i === user.wallets!.length - 1 ? { borderBottom: "none" } : {}) }}>
                  <span style={s.statLabel}>Wallet {i + 1}</span>
                  <span style={{ ...s.statValue, fontFamily: "monospace", fontSize: 10 }}>{shortWallet(w.publicKey)}</span>
                </div>
              ))}
            </div>
          )}

          <button style={s.btn("primary")} onClick={openDashboard}>Manage in Dashboard</button>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<Popup />);
}
