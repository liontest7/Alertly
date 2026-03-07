import React from "react";
import { createRoot } from "react-dom/client";

const DEFAULT_ALERTLY_BASE_URL = "https://alertly.ai";
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

  React.useEffect(() => {
    async function load() {
      try {
        const resolvedBaseUrl = await getStoredBaseUrl();
        setBaseUrl(resolvedBaseUrl);

        const syncRes = await fetch(`${resolvedBaseUrl}/api/extension/sync`, {
          credentials: "include",
        });
        const sync = await syncRes.json();

        if (!sync?.authenticated) {
          setAuthenticated(false);
          return;
        }

        setAuthenticated(true);

        const alertRes = await fetch(`${resolvedBaseUrl}/api/alerts`, {
          credentials: "include",
        });

        if (alertRes.ok) {
          const data = await alertRes.json();
          setAlerts(Array.isArray(data) ? data : []);
        }
      } catch {
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div style={{ width: 340, padding: 16, backgroundColor: "#050505", color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <h1 style={{ fontSize: 18, margin: 0, marginBottom: 6, color: "#8b5cf6" }}>Alertly Command Feed</h1>
      <p style={{ margin: 0, marginBottom: 12, color: "#9ca3af", fontSize: 12 }}>
        Real-time Solana signals synced with your dashboard profile.
      </p>

      <div style={{ ...cardStyle, marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>Dashboard URL</label>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          onBlur={async () => {
            await setStoredBaseUrl(baseUrl);
            setBaseUrl(normalizeBaseUrl(baseUrl));
          }}
          placeholder="https://alertly.ai"
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
            You are not connected yet. Log in on Alertly with the same browser profile and this URL.
          </p>
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
