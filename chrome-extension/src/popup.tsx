import React from "react";
import { createRoot } from "react-dom/client";

const PRODUCTION_URL = "https://alertly-5zmw.onrender.com";
const ALERTLY_BASE_URL_STORAGE_KEY = "alertlyBaseUrl";
const GUEST_SETTINGS_COOKIE = "alertly_guest_settings";
const LOCAL_TRADING_SETTINGS_KEY = "alertlyTradingSettings";

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

type TradingWalletInfo = {
  walletAddress: string;
  balanceSol: number;
  createdAt: string;
};

type PnlInfo = {
  pnl24hSol: number;
  solIn: number;
  solOut: number;
  tradeCount24h: number;
  recentTrades: Array<{
    id: string;
    action: string;
    amount: number;
    tokenAddress: string;
    status: string;
    txSig: string | null;
    createdAt: string;
  }>;
};

type FullUserSettings = {
  buyAmount: number;
  maxBuyPerToken: number;
  slippage: number;
  stopLoss: number;
  takeProfit: number;
  trailingStop: boolean;
  autoTrade: boolean;
  autoSellMinutes: number;
  alertsEnabled: boolean;
  dexBoostEnabled: boolean;
  dexListingEnabled: boolean;
  minMarketCap: number;
  maxMarketCap: number;
  minLiquidity: number;
  minHolders: number;
  selectedBoostLevel: string | null;
};

type SyncUser = {
  walletAddress?: string;
  vipLevel?: string | number;
  telegramLinked?: boolean;
  settings?: FullUserSettings | null;
  tradingWallet?: TradingWalletInfo | null;
  pnl?: PnlInfo | null;
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

type LocalTradingSettings = {
  buyAmount: number;
  slippage: number;
  takeProfit: number;
  stopLoss: number;
  autoTrade: boolean;
};

type FilterSettings = {
  dexBoostEnabled?: boolean;
  dexListingEnabled?: boolean;
  minMarketCap?: number;
  maxMarketCap?: number;
  minLiquidity?: number;
};

const DEFAULT_LOCAL_TRADING: LocalTradingSettings = {
  buyAmount: 0.5,
  slippage: 10,
  takeProfit: 50,
  stopLoss: 25,
  autoTrade: false,
};

// ─── Cookie encode/decode ─────────────────────────────────────────

function encodeFilterCookie(value: FilterSettings): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  const binStr = Array.from(bytes, (b) => String.fromCodePoint(b)).join("");
  const b64 = btoa(binStr);
  const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return encodeURIComponent(b64url);
}

function decodeFilterCookie(value: string): FilterSettings | null {
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

// ─── Storage helpers ──────────────────────────────────────────────

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
    } catch { resolve(); }
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

function getLocalTradingSettings(): Promise<LocalTradingSettings> {
  return new Promise((resolve) => {
    chrome.storage.local.get([LOCAL_TRADING_SETTINGS_KEY], (result) => {
      const stored = result?.[LOCAL_TRADING_SETTINGS_KEY];
      resolve({ ...DEFAULT_LOCAL_TRADING, ...(stored || {}) });
    });
  });
}

function setLocalTradingSettings(settings: LocalTradingSettings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [LOCAL_TRADING_SETTINGS_KEY]: settings }, () => resolve());
  });
}

function readWebsiteFilterSettings(baseUrl: string): Promise<FilterSettings> {
  return new Promise((resolve) => {
    try {
      chrome.cookies.get({ url: baseUrl, name: GUEST_SETTINGS_COOKIE }, (cookie) => {
        if (!cookie?.value) { resolve({}); return; }
        resolve(decodeFilterCookie(cookie.value) || {});
      });
    } catch { resolve({}); }
  });
}

function writeWebsiteFilterSettings(baseUrl: string, settings: FilterSettings): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const encoded = encodeFilterCookie(settings);
      const isHttps = baseUrl.startsWith("https");
      chrome.cookies.set({
        url: baseUrl,
        name: GUEST_SETTINGS_COOKIE,
        value: encoded,
        path: "/",
        sameSite: "lax",
        secure: isHttps,
        expirationDate: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90,
      }, (cookie) => resolve(!!cookie));
    } catch { resolve(false); }
  });
}

// ─── Sound ────────────────────────────────────────────────────────

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────

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

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtSol(n: number) {
  if (Math.abs(n) >= 1000) return `${n.toFixed(0)} SOL`;
  if (Math.abs(n) >= 100) return `${n.toFixed(2)} SOL`;
  return `${n.toFixed(4)} SOL`;
}

function fmtPnl(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${fmtSol(n)}`;
}

// ─── Colors & Styles ─────────────────────────────────────────────

const C = {
  bg: "#050507",
  surface: "#0d0d12",
  surfaceBorder: "#1a1a2e",
  accent: "#5100fd",
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
    width: 30, height: 30, borderRadius: 8,
    border: `1px solid rgba(255,255,255,0.08)`, flexShrink: 0,
  } as React.CSSProperties,

  headerText: { flex: 1 } as React.CSSProperties,

  headerTitle: {
    fontSize: 14, fontWeight: 700, color: C.text,
    letterSpacing: "-0.2px", margin: 0, lineHeight: 1.2,
  } as React.CSSProperties,

  headerSub: {
    fontSize: 10, color: C.textDim, margin: 0, marginTop: 1, letterSpacing: "0.02em",
  } as React.CSSProperties,

  card: {
    backgroundColor: C.surface,
    border: `1px solid ${C.surfaceBorder}`,
    borderRadius: 12,
    padding: "12px 14px",
  } as React.CSSProperties,

  pill: (color: string, bg: string, border: string): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "3px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700,
    letterSpacing: "0.06em", color, backgroundColor: bg, border: `1px solid ${border}`,
  }),

  btn: (variant: "primary" | "ghost" | "danger" | "success" | "small"): React.CSSProperties => ({
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: variant === "primary" ? "11px 16px" : variant === "small" ? "5px 10px" : "7px 12px",
    borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 700,
    fontSize: variant === "primary" ? 13 : 11,
    letterSpacing: variant === "primary" ? "0.02em" : "0.04em",
    transition: "opacity 0.15s",
    width: variant === "primary" ? "100%" : "auto",
    ...(variant === "primary" && {
      background: `linear-gradient(135deg, ${C.accent} 0%, #7c3aed 100%)`,
      color: "#fff", boxShadow: `0 4px 16px rgba(81,0,253,0.35)`,
    }),
    ...(variant === "ghost" && { backgroundColor: C.surfaceBorder, color: C.textMuted }),
    ...(variant === "small" && { backgroundColor: C.surfaceBorder, color: C.textMuted }),
    ...(variant === "danger" && {
      backgroundColor: C.redLight, border: `1px solid ${C.redBorder}`, color: C.red,
    }),
    ...(variant === "success" && {
      backgroundColor: C.greenLight, border: `1px solid ${C.greenBorder}`, color: C.green,
    }),
  }),

  tab: (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "8px 0", border: "none", cursor: "pointer",
    fontSize: 10, fontWeight: active ? 700 : 500,
    color: active ? C.accent : C.textMuted, backgroundColor: "transparent",
    borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
    transition: "all 0.15s", letterSpacing: "0.05em",
  }),

  input: {
    width: "100%", background: C.surface, border: `1px solid ${C.surfaceBorder}`,
    borderRadius: 8, color: C.text, fontSize: 12, fontFamily: "inherit",
    outline: "none", padding: "7px 10px", boxSizing: "border-box" as const,
    transition: "border-color 0.15s",
  } as React.CSSProperties,

  numInput: {
    width: "100%", background: C.surface, border: `1px solid ${C.surfaceBorder}`,
    borderRadius: 8, color: C.text, fontSize: 12, fontFamily: "inherit",
    outline: "none", padding: "6px 10px", boxSizing: "border-box" as const,
  } as React.CSSProperties,
};

// ─── Toggle Switch ────────────────────────────────────────────────

function ToggleSwitch({ on, onChange, label, sub }: {
  on: boolean; onChange: (v: boolean) => void; label: string; sub?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={() => onChange(!on)} style={{
        width: 40, height: 22, borderRadius: 999, border: "none", cursor: "pointer",
        backgroundColor: on ? C.accent : C.surfaceBorder, position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <span style={{
          position: "absolute", top: 3, left: on ? 21 : 3,
          width: 16, height: 16, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s",
        }} />
      </button>
    </div>
  );
}

// ─── Number field ─────────────────────────────────────────────────

function NumberField({ label, value, onChange, min, max, step, suffix }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; suffix?: string;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 3, fontWeight: 600, letterSpacing: "0.05em" }}>
        {label}{suffix ? ` (${suffix})` : ""}
      </div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 0.1}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        style={s.numInput}
      />
    </div>
  );
}

// ─── Money input ──────────────────────────────────────────────────

function MoneyInput({ label, value, onChange, placeholder }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string;
}) {
  const [raw, setRaw] = React.useState(value ? String(value) : "");

  React.useEffect(() => {
    setRaw(value ? String(value) : "");
  }, [value]);

  function commit(str: string) {
    const clean = str.replace(/[$,\s]/g, "").toUpperCase();
    let num: number | undefined;
    if (clean === "" || clean === "0") {
      num = undefined;
    } else if (clean.endsWith("M")) {
      num = parseFloat(clean) * 1_000_000;
    } else if (clean.endsWith("K")) {
      num = parseFloat(clean) * 1_000;
    } else {
      const n = parseFloat(clean);
      num = isNaN(n) ? undefined : n;
    }
    onChange(num);
    setRaw(num ? String(num) : "");
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, fontWeight: 600, letterSpacing: "0.05em" }}>{label}</div>
      <input
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        placeholder={placeholder || "Any (leave empty)"}
        style={s.input}
      />
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────

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
        ...(status === "live" ? { boxShadow: `0 0 6px ${map.dot}` } : {}),
      }} />
      {map.label}
    </span>
  );
}

// ─── Alert card ───────────────────────────────────────────────────

function AlertCard({ alert }: { alert: AlertItem }) {
  const name = alert.symbol || alert.name || (alert.address ? shortAddr(alert.address) : "?");
  const typeLabel = normalizeType(alert.type);
  const typeColor = TYPE_COLOR_MAP[typeLabel] || C.accent;
  const isBoost = typeLabel === "DEX BOOST";
  const isListing = typeLabel === "DEX LISTING";

  return (
    <div style={{ ...s.card, display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderLeft: `3px solid ${typeColor}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: C.text }}>{name}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", backgroundColor: typeColor, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.05em" }}>
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

// ─── Wallet Tab ───────────────────────────────────────────────────

function WalletTab({ syncData, openDashboard }: { syncData: SyncData | null; openDashboard: () => void }) {
  const [copied, setCopied] = React.useState(false);
  const tw = syncData?.user?.tradingWallet;
  const pnl = syncData?.user?.pnl;
  const isAuth = syncData?.authenticated;

  function copyAddr(addr: string) {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  if (!isAuth) {
    return (
      <div style={{ padding: "20px 16px" }}>
        <EmptyState icon="🔒" message="Connect your account to view your trading wallet, balance, and PnL." />
        <button style={{ ...s.btn("primary"), marginTop: 12 }} onClick={openDashboard}>
          Open Dashboard to Connect ↗
        </button>
      </div>
    );
  }

  if (!tw) {
    return (
      <div style={{ padding: "20px 16px" }}>
        <EmptyState icon="💼" message="No trading wallet yet. Generate one on the Alertly dashboard." />
        <button style={{ ...s.btn("primary"), marginTop: 12 }} onClick={openDashboard}>
          Generate Trading Wallet ↗
        </button>
      </div>
    );
  }

  const pnl24h = pnl?.pnl24hSol ?? 0;
  const pnlColor = pnl24h >= 0 ? C.green : C.red;
  const trades = pnl?.recentTrades ?? [];

  return (
    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 520 }}>
      <div style={s.card}>
        <div style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: "0.07em", marginBottom: 8 }}>TRADING WALLET</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: C.text }}>{shortAddr(tw.walletAddress)}</span>
          <button onClick={() => copyAddr(tw.walletAddress)} style={{ ...s.btn("small"), fontSize: 10, padding: "3px 8px" }}>
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div style={{ ...s.card, padding: "10px 12px", backgroundColor: "#0a0a0f" }}>
            <div style={{ fontSize: 9, color: C.textDim, fontWeight: 700, letterSpacing: "0.07em", marginBottom: 4 }}>BALANCE</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{fmtSol(tw.balanceSol)}</div>
          </div>
          <div style={{ ...s.card, padding: "10px 12px", backgroundColor: "#0a0a0f" }}>
            <div style={{ fontSize: 9, color: C.textDim, fontWeight: 700, letterSpacing: "0.07em", marginBottom: 4 }}>PNL 24H</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: pnlColor }}>{fmtPnl(pnl24h)}</div>
          </div>
        </div>
      </div>

      {pnl && (
        <div style={s.card}>
          <div style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: "0.07em", marginBottom: 8 }}>24H STATS</div>
          <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
            <div style={{ flex: 1, textAlign: "center" as const }}>
              <div style={{ color: C.textDim, fontSize: 9, marginBottom: 2 }}>TRADES</div>
              <div style={{ fontWeight: 700 }}>{pnl.tradeCount24h}</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" as const }}>
              <div style={{ color: C.textDim, fontSize: 9, marginBottom: 2 }}>SOL IN</div>
              <div style={{ fontWeight: 700, color: C.red }}>{fmtSol(pnl.solIn)}</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" as const }}>
              <div style={{ color: C.textDim, fontSize: 9, marginBottom: 2 }}>SOL OUT</div>
              <div style={{ fontWeight: 700, color: C.green }}>{fmtSol(pnl.solOut)}</div>
            </div>
          </div>
        </div>
      )}

      {trades.length > 0 && (
        <div style={s.card}>
          <div style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: "0.07em", marginBottom: 8 }}>RECENT TRADES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {trades.slice(0, 8).map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                <div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, marginRight: 6,
                    backgroundColor: t.action === "buy" ? C.greenLight : C.redLight,
                    color: t.action === "buy" ? C.green : C.red,
                    border: `1px solid ${t.action === "buy" ? C.greenBorder : C.redBorder}`,
                  }}>{t.action.toUpperCase()}</span>
                  <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>{shortAddr(t.tokenAddress)}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{fmtSol(t.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {trades.length === 0 && pnl && pnl.tradeCount24h === 0 && (
        <EmptyState icon="📊" message="No trades in the last 24 hours." />
      )}

      <button style={{ ...s.btn("ghost"), width: "100%", fontSize: 11 }} onClick={openDashboard}>
        View Full Dashboard ↗
      </button>
    </div>
  );
}

// ─── Main Popup ───────────────────────────────────────────────────

const Popup = () => {
  const [phase, setPhase] = React.useState<"loading" | "unauthenticated" | "main">("loading");
  const [tab, setTab] = React.useState<"alerts" | "wallet" | "settings">("alerts");
  const [syncData, setSyncData] = React.useState<SyncData | null>(null);
  const [alerts, setAlerts] = React.useState<AlertItem[]>([]);
  const [streamStatus, setStreamStatus] = React.useState<"connecting" | "live" | "offline">("connecting");
  const [lastSynced, setLastSynced] = React.useState<string>("");
  const [syncing, setSyncing] = React.useState(false);
  const [baseUrl, setBaseUrl] = React.useState(PRODUCTION_URL);

  const [extSettings, setExtSettingsState] = React.useState<ExtSettings>({ paused: false, popupEnabled: true });
  const [soundEnabled, setSoundEnabled] = React.useState(true);

  const [filters, setFilters] = React.useState<FilterSettings>({});
  const [filtersDirty, setFiltersDirty] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [cookieSyncAvailable, setCookieSyncAvailable] = React.useState(false);

  const [localTrading, setLocalTradingState] = React.useState<LocalTradingSettings>(DEFAULT_LOCAL_TRADING);
  const [tradingDirty, setTradingDirty] = React.useState(false);
  const [tradingSaveStatus, setTradingSaveStatus] = React.useState<"idle" | "saving" | "saved">("idle");

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

  function updateFilter(patch: Partial<FilterSettings>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setFiltersDirty(true);
    setSaveStatus("idle");
  }

  function updateLocalTrading(patch: Partial<LocalTradingSettings>) {
    setLocalTradingState((prev) => ({ ...prev, ...patch }));
    setTradingDirty(true);
    setTradingSaveStatus("idle");
  }

  async function saveLocalTrading() {
    setTradingSaveStatus("saving");
    await setLocalTradingSettings(localTrading);
    setTradingDirty(false);
    setTradingSaveStatus("saved");
    setTimeout(() => setTradingSaveStatus("idle"), 2000);
  }

  async function saveFilters() {
    setSaveStatus("saving");
    const ok = await writeWebsiteFilterSettings(baseUrlRef.current, filters);
    if (ok) {
      setSaveStatus("saved");
      setFiltersDirty(false);
      setCookieSyncAvailable(true);
      setTimeout(() => setSaveStatus("idle"), 3000);
    } else {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
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

      if (data.authenticated && data.user?.settings) {
        const ws = data.user.settings;
        setFilters({
          dexBoostEnabled: ws.dexBoostEnabled,
          dexListingEnabled: ws.dexListingEnabled,
          minMarketCap: ws.minMarketCap || undefined,
          maxMarketCap: ws.maxMarketCap || undefined,
          minLiquidity: ws.minLiquidity || undefined,
        });
        setLocalTradingState({
          buyAmount: ws.buyAmount,
          slippage: ws.slippage,
          takeProfit: ws.takeProfit,
          stopLoss: ws.stopLoss,
          autoTrade: ws.autoTrade,
        });
        setTradingDirty(false);
        setCookieSyncAvailable(true);
      }

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
      const [stored, ext, localT] = await Promise.all([
        getStoredBaseUrl(),
        getExtSettings(),
        getLocalTradingSettings(),
      ]);
      setBaseUrl(stored);
      baseUrlRef.current = stored;
      setExtSettingsState(ext);
      setLocalTradingState(localT);

      const websiteFilters = await readWebsiteFilterSettings(stored);
      if (Object.keys(websiteFilters).length > 0) {
        setFilters(websiteFilters);
        setCookieSyncAvailable(true);
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

  if (phase === "loading") {
    return (
      <div style={{ ...s.root, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 160, gap: 10 }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.surfaceBorder}`, borderTop: `3px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ margin: 0, fontSize: 11, color: C.textDim }}>Connecting to Alertly…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

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
              You can also use the extension independently without an account.
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
              style={{ ...s.input, borderRadius: 0, border: "none", borderBottom: `1px solid ${C.border}`, background: "transparent", padding: "4px 0" }}
            />
          </div>
        </div>
      </div>
    );
  }

  const isGuest = !syncData?.authenticated && syncData?.guestEnabled;
  const isAuth = syncData?.authenticated;
  const displayedAlerts = extSettings.paused ? [] : alerts;

  return (
    <div style={s.root}>
      <div style={s.header}>
        <img src="icon128.png" style={s.logo} />
        <div style={s.headerText}>
          <p style={s.headerTitle}>Alertly</p>
          <p style={s.headerSub}>
            {isGuest
              ? "GUEST MODE"
              : (syncData?.user?.walletAddress
                  ? `${syncData.user.walletAddress.slice(0, 4)}…${syncData.user.walletAddress.slice(-4)}${syncData.user.vipLevel ? ` · VIP${syncData.user.vipLevel}` : ""}`
                  : "CONNECTED"
                )
            }
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusPill status={extSettings.paused ? "paused" : streamStatus} />
          <button onClick={() => doSync()} title="Sync" style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 14, padding: 2, lineHeight: 1 }}>
            {syncing ? "⟳" : "↻"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, padding: "0 16px" }}>
        <button style={s.tab(tab === "alerts")} onClick={() => setTab("alerts")}>ALERTS</button>
        <button style={s.tab(tab === "wallet")} onClick={() => setTab("wallet")}>WALLET</button>
        <button style={s.tab(tab === "settings")} onClick={() => setTab("settings")}>SETTINGS</button>
      </div>

      {tab === "alerts" && (
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: C.textDim }}>{lastSynced ? `Synced ${lastSynced}` : "Syncing…"}</span>
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
            <EmptyState icon="📡" message="No alerts yet. Monitoring for new signals." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
              {displayedAlerts.map((alert, i) => <AlertCard key={i} alert={alert} />)}
            </div>
          )}

          <button style={s.btn("primary")} onClick={openDashboard}>Open Full Dashboard ↗</button>
        </div>
      )}

      {tab === "wallet" && (
        <WalletTab syncData={syncData} openDashboard={openDashboard} />
      )}

      {tab === "settings" && (
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", maxHeight: 520 }}>

          <p style={{ margin: "4px 0 4px", fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "0.07em" }}>EXTENSION CONTROLS</p>

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
            sub="System popups when new alerts arrive"
          />
          <ToggleSwitch
            on={soundEnabled}
            onChange={(v) => setSoundEnabled(v)}
            label="Alert Sound"
            sub="Play a sound when new alerts arrive"
          />

          <p style={{ margin: "14px 0 4px", fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "0.07em" }}>
            TRADING SETTINGS
            {isGuest && <span style={{ color: C.yellow, marginLeft: 6 }}>• Local only</span>}
            {isAuth && <span style={{ color: C.green, marginLeft: 6 }}>• Synced from account</span>}
          </p>
          <div style={{ ...s.card, padding: "12px 14px", marginTop: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <NumberField
                label="Buy Amount"
                value={localTrading.buyAmount}
                onChange={(v) => updateLocalTrading({ buyAmount: v })}
                min={0.001} max={100} step={0.1}
                suffix="SOL"
              />
              <NumberField
                label="Slippage"
                value={localTrading.slippage}
                onChange={(v) => updateLocalTrading({ slippage: v })}
                min={0.1} max={100} step={0.5}
                suffix="%"
              />
              <NumberField
                label="Take Profit"
                value={localTrading.takeProfit}
                onChange={(v) => updateLocalTrading({ takeProfit: v })}
                min={1} max={1000} step={5}
                suffix="%"
              />
              <NumberField
                label="Stop Loss"
                value={localTrading.stopLoss}
                onChange={(v) => updateLocalTrading({ stopLoss: v })}
                min={1} max={100} step={5}
                suffix="%"
              />
            </div>
            <ToggleSwitch
              on={localTrading.autoTrade}
              onChange={(v) => updateLocalTrading({ autoTrade: v })}
              label="Auto-Trade"
              sub="Automatically execute trades on new alerts"
            />
            <button
              onClick={saveLocalTrading}
              disabled={!tradingDirty && tradingSaveStatus === "idle"}
              style={{
                ...s.btn("primary"), marginTop: 10,
                opacity: tradingDirty || tradingSaveStatus !== "idle" ? 1 : 0.5,
              }}
            >
              {tradingSaveStatus === "saving" && "Saving…"}
              {tradingSaveStatus === "saved" && "✓ Saved"}
              {tradingSaveStatus === "idle" && (tradingDirty ? "💾 Save Trading Settings" : "Saved Locally")}
            </button>
            {isGuest && (
              <p style={{ margin: "6px 0 0", fontSize: 10, color: C.textDim, textAlign: "center" as const }}>
                These settings are stored locally in this browser. Connect an account to sync across devices.
              </p>
            )}
          </div>

          <p style={{ margin: "14px 0 4px", fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: "0.07em" }}>ALERT FILTERS</p>
          <div style={{ ...s.card, padding: "12px 14px", marginTop: 4 }}>
            <ToggleSwitch
              on={filters.dexBoostEnabled !== false}
              onChange={(v) => updateFilter({ dexBoostEnabled: v })}
              label="DEX Boost Alerts"
              sub="Show boosted token alerts"
            />
            <ToggleSwitch
              on={filters.dexListingEnabled !== false}
              onChange={(v) => updateFilter({ dexListingEnabled: v })}
              label="DEX Listing Alerts"
              sub="Show new token listing alerts"
            />
            <div style={{ marginTop: 8 }}>
              <MoneyInput
                label="MIN MARKET CAP"
                value={filters.minMarketCap}
                onChange={(v) => updateFilter({ minMarketCap: v })}
                placeholder="e.g. 50K or 1M"
              />
              <MoneyInput
                label="MAX MARKET CAP"
                value={filters.maxMarketCap}
                onChange={(v) => updateFilter({ maxMarketCap: v })}
                placeholder="e.g. 10M"
              />
              <MoneyInput
                label="MIN LIQUIDITY"
                value={filters.minLiquidity}
                onChange={(v) => updateFilter({ minLiquidity: v })}
                placeholder="e.g. 5K"
              />
            </div>
            <button
              onClick={saveFilters}
              style={{
                ...s.btn("primary"), marginTop: 8,
                opacity: saveStatus === "saving" ? 0.7 : 1,
              }}
            >
              {saveStatus === "saving" && "Saving…"}
              {saveStatus === "saved" && "✓ Saved & Synced to Website"}
              {saveStatus === "error" && "✗ Could not write cookie"}
              {saveStatus === "idle" && (filtersDirty ? "💾 Save & Sync to Website" : "Sync with Website Now")}
            </button>
            {saveStatus === "idle" && !filtersDirty && cookieSyncAvailable && (
              <p style={{ margin: "4px 0 0", fontSize: 10, color: C.textDim, textAlign: "center" as const }}>
                Filters are in sync with the Alertly website
              </p>
            )}
            {saveStatus === "error" && (
              <p style={{ margin: "4px 0 0", fontSize: 10, color: C.red, textAlign: "center" as const }}>
                Visit the Alertly site first so the extension can write cookies to it.
              </p>
            )}
          </div>

          <div style={{ ...s.card, padding: "10px 12px", marginTop: 10 }}>
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
              style={{ ...s.input, borderRadius: 0, border: "none", borderBottom: `1px solid ${C.border}`, background: "transparent", padding: "4px 0" }}
            />
          </div>

          <div style={{ padding: "10px 0 4px", display: "flex", justifyContent: "center" }}>
            <button style={{ ...s.btn("ghost"), fontSize: 10 }} onClick={openDashboard}>
              Full Settings on Dashboard ↗
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const root = document.getElementById("root")!;
createRoot(root).render(<Popup />);
