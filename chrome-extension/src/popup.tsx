import React from "react";
import { createRoot } from "react-dom/client";

const DEFAULT_ALERTLY_BASE_URL = "http://localhost:10000";
const ALERTLY_BASE_URL_STORAGE_KEY = "alertlyBaseUrl";

type AlertItem = {
  name?: string;
  type?: string;
  mc?: string;
  vol?: string;
};

const cardStyle: React.CSSProperties = {
  padding: "10px",
  border: "1px solid #1f1f1f",
  borderRadius: "10px",
  backgroundColor: "#0b0b0b",
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

function getStoredBaseUrl(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([ALERTLY_BASE_URL_STORAGE_KEY], (result) => {
      resolve(normalizeBaseUrl(result?.[ALERTLY_BASE_URL_STORAGE_KEY]));
    });
  });
}

function setStoredBaseUrl(value: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [ALERTLY_BASE_URL_STORAGE_KEY]: normalizeBaseUrl(value) }, () => resolve());
  });
}

const Popup = () => {
  const [alerts, setAlerts] = React.useState<AlertItem[]>([]);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [baseUrl, setBaseUrl] = React.useState(DEFAULT_ALERTLY_BASE_URL);
  const [streamStatus, setStreamStatus] = React.useState<"live" | "connecting" | "offline">("offline");
  const [alertsEnabled, setAlertsEnabled] = React.useState(true);
  const [togglingAlerts, setTogglingAlerts] = React.useState(false);
  const resolvedBaseUrlRef = React.useRef(DEFAULT_ALERTLY_BASE_URL);

  React.useEffect(() => {
    let mounted = true;
    let stream: EventSource | null = null;

    async function load() {
      try {
        const resolvedBaseUrl = await getStoredBaseUrl();
        if (!mounted) return;
        setBaseUrl(resolvedBaseUrl);
        resolvedBaseUrlRef.current = resolvedBaseUrl;

        const syncRes = await fetch(`${resolvedBaseUrl}/api/extension/sync`, {
          credentials: "include",
        });
        const sync = await syncRes.json();

        const canUseFeed = sync?.authenticated || sync?.guestEnabled;
        if (!mounted) return;

        if (!canUseFeed) {
          setAuthenticated(false);
          setStreamStatus("offline");
          return;
        }

        setAuthenticated(true);
        const enabled = sync?.alertsEnabled !== false;
        setAlertsEnabled(enabled);

        if (!enabled) {
          setAlerts([]);
          setStreamStatus("offline");
          return;
        }

        setStreamStatus("connecting");
        stream = new EventSource(`${resolvedBaseUrl}/api/alerts/stream`, { withCredentials: true });

        stream.addEventListener("alerts", (event) => {
          try {
            const payload = JSON.parse((event as MessageEvent).data);
            if (Array.isArray(payload) && mounted) {
              setAlerts(payload);
              setStreamStatus("live");
            }
          } catch {
            // ignore malformed stream event
          }
        });

        stream.addEventListener("heartbeat", () => {
          if (mounted) setStreamStatus("live");
        });

        stream.addEventListener("paused", () => {
          if (mounted) {
            setAlerts([]);
            setAlertsEnabled(false);
            setStreamStatus("offline");
          }
        });

        stream.onerror = () => {
          if (mounted) setStreamStatus("offline");
        };
      } catch {
        if (mounted) {
          setAuthenticated(false);
          setStreamStatus("offline");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
      if (stream) {
        stream.close();
      }
    };
  }, []);

  const handleToggleAlerts = async () => {
    if (!authenticated) return;
    setTogglingAlerts(true);
    try {
      const newEnabled = !alertsEnabled;
      const res = await fetch(`${resolvedBaseUrlRef.current}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ alertsEnabled: newEnabled }),
      });
      if (res.ok) {
        setAlertsEnabled(newEnabled);
        if (!newEnabled) setAlerts([]);
      }
    } catch {
      // ignore
    } finally {
      setTogglingAlerts(false);
    }
  };

  return (
    <div style={{ width: 340, padding: 16, backgroundColor: "#050505", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: 0, marginBottom: 6, color: "#8b5cf6" }}>Alertly Command Feed</h1>
      <p style={{ margin: 0, marginBottom: 8, color: "#9ca3af", fontSize: 12 }}>
        Real-time Solana signals synced with your dashboard profile.
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ margin: 0, color: streamStatus === "live" ? "#22c55e" : streamStatus === "connecting" ? "#f59e0b" : "#ef4444", fontSize: 11 }}>
          Stream: {streamStatus === "live" ? "LIVE" : streamStatus === "connecting" ? "CONNECTING" : "OFFLINE"}
        </p>
        {authenticated && (
          <button
            onClick={handleToggleAlerts}
            disabled={togglingAlerts}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: alertsEnabled ? "1px solid #22c55e" : "1px solid #ef4444",
              backgroundColor: alertsEnabled ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              color: alertsEnabled ? "#22c55e" : "#ef4444",
              fontSize: 10,
              fontWeight: 700,
              cursor: togglingAlerts ? "wait" : "pointer",
            }}
          >
            {togglingAlerts ? "..." : alertsEnabled ? "⏸ Pause Alerts" : "▶ Resume Alerts"}
          </button>
        )}
      </div>

      <div style={{ ...cardStyle, marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>Dashboard URL</label>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          onBlur={async () => {
            await setStoredBaseUrl(baseUrl);
            setBaseUrl(normalizeBaseUrl(baseUrl));
          }}
          placeholder="https://your-render-app.onrender.com"
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #27272a",
            backgroundColor: "#09090b",
            color: "#fff",
            fontSize: 12,
            outline: "none",
          }}
        />
      </div>

      {loading ? (
        <p style={{ color: "#6b7280", fontSize: 12 }}>Loading your live alerts…</p>
      ) : !authenticated ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, color: "#d1d5db", fontSize: 12 }}>
            Guest mode is available. Log in to unlock full sync and VIP features.
          </p>
        </div>
      ) : !alertsEnabled ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, color: "#9ca3af", fontSize: 12 }}>⏸ Alerts are paused. Click "Resume Alerts" to start receiving signals.</p>
        </div>
      ) : alerts.length === 0 ? (
        <div style={cardStyle}>
          <p style={{ margin: 0, color: "#9ca3af", fontSize: 12 }}>No alerts right now. Your filters are active and monitoring.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
          {alerts.slice(0, 8).map((alert, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 12 }}>{alert.name || "Unknown"}</strong>
                <span style={{ fontSize: 10, color: "#a78bfa" }}>{alert.type || "Signal"}</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "#9ca3af" }}>
                MC: {alert.mc || "N/A"} · VOL: {alert.vol || "N/A"}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => window.open(`${normalizeBaseUrl(baseUrl)}/dashboard`, "_blank")}
        style={{
          width: "100%",
          marginTop: 12,
          padding: "10px 12px",
          backgroundColor: "#5100fd",
          color: "white",
          border: "none",
          borderRadius: 999,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Open Alertly Dashboard
      </button>
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
