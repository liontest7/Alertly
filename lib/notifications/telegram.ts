import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { getAlerts } from "@/lib/alert-store";

export type AlertBroadcastPayload = {
  address: string;
  pairAddress?: string;
  type: string;
  name: string;
  symbol?: string;
  mc: string;
  liquidity: string;
  vol: string;
  alertedAt: Date;
  imageUrl?: string;
  boostAmount?: number;
  totalBoostAmount?: number;
};

type SubscriberSettings = {
  alertsEnabled?: boolean;
  dexBoostEnabled?: boolean;
  dexListingEnabled?: boolean;
  selectedBoostLevel?: string;
};

type Subscriber = {
  chatId: string;
  firstName?: string;
  subscribedAt: string;
  settings: SubscriberSettings;
};

type SubscriberStore = Record<string, Subscriber>;

const SUBSCRIBERS_FILE = join(process.cwd(), "telegram-bot", "data", "subscribers.json");

function loadSubscribers(): SubscriberStore {
  try {
    if (!existsSync(SUBSCRIBERS_FILE)) return {};
    const raw = readFileSync(SUBSCRIBERS_FILE, "utf-8");
    return JSON.parse(raw) as SubscriberStore;
  } catch {
    return {};
  }
}

function isAlertTypeEnabled(type: string, settings: SubscriberSettings): boolean {
  if (type === "DEX_BOOST") return settings.dexBoostEnabled !== false;
  if (type === "DEX_LISTING") return settings.dexListingEnabled !== false;
  return true;
}

function shortAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function typeEmoji(type: string): string {
  if (type === "DEX_BOOST") return "⚡";
  if (type === "DEX_LISTING") return "🆕";
  return "🚨";
}

function buildTelegramMessage(alert: AlertBroadcastPayload): string {
  const emoji = typeEmoji(alert.type);
  const typeLabel = alert.type.replaceAll("_", " ");
  const symbolBlock = alert.symbol ? ` ($${alert.symbol})` : "";
  const dexLink = alert.pairAddress || alert.address;

  const lines: string[] = [
    `${emoji} *${typeLabel}*`,
    "",
    `*Token:* ${alert.name}${symbolBlock}`,
    `*CA:* \`${shortAddress(alert.address)}\``,
  ];

  if (alert.type === "DEX_BOOST") {
    if (alert.boostAmount != null && alert.boostAmount > 0) {
      lines.push(`*New Boost:* +${alert.boostAmount.toLocaleString()} units`);
    }
    if (alert.totalBoostAmount != null && alert.totalBoostAmount > 0) {
      lines.push(`*Total Boosts:* ${alert.totalBoostAmount.toLocaleString()} units`);
    }
  }

  lines.push(`*Market Cap:* ${alert.mc}`);
  lines.push(`*Liquidity:* ${alert.liquidity}`);
  lines.push(`*Volume 24h:* ${alert.vol}`);
  lines.push(`*Time:* ${alert.alertedAt.toUTCString()}`);
  lines.push(`[View on DexScreener](https://dexscreener.com/solana/${dexLink})`);

  return lines.join("\n");
}

async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN is not set — skipping notification");
    return false;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[Telegram] Failed to send to ${chatId}: HTTP ${res.status} — ${body}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Telegram] Network error sending to ${chatId}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

export async function sendCurrentAlertsToNewUser(chatId: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const all = getAlerts();
  const dexAlerts = all.filter((a) => a.type === "DEX_BOOST" || a.type === "DEX_LISTING");
  if (dexAlerts.length === 0) return;

  const toSend = dexAlerts.slice(0, 8);

  await sendTelegramMessage(
    chatId,
    `✅ *Alertly activated!* Here are ${toSend.length} active DEX alerts right now:`,
  );

  for (const alert of toSend) {
    await sendTelegramMessage(
      chatId,
      buildTelegramMessage({
        address: alert.address,
        pairAddress: alert.pairAddress ?? undefined,
        type: alert.type,
        name: alert.name,
        symbol: alert.symbol || undefined,
        mc: alert.mc,
        liquidity: alert.liquidity,
        vol: alert.vol,
        alertedAt: alert.alertedAt,
        boostAmount: alert.boostAmount,
        totalBoostAmount: alert.totalBoostAmount,
      }),
    );
    await new Promise((r) => setTimeout(r, 120));
  }
}

export async function broadcastAlertToTelegram(alert: AlertBroadcastPayload) {
  const subscribers = loadSubscribers();
  const entries = Object.values(subscribers);

  if (entries.length === 0) return;

  const message = buildTelegramMessage(alert);
  let sent = 0;
  let skipped = 0;

  for (const sub of entries) {
    const settings = sub.settings ?? {};

    if (settings.alertsEnabled === false) { skipped++; continue; }
    if (!isAlertTypeEnabled(alert.type, settings)) { skipped++; continue; }

    const ok = await sendTelegramMessage(sub.chatId, message);
    if (ok) sent++;
  }

  if (sent > 0 || skipped > 0) {
    console.log(`[Telegram] ${alert.type} broadcast: sent=${sent}, skipped=${skipped}, token=${alert.name}`);
  }
}
