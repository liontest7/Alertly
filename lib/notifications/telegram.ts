import { readFileSync, existsSync } from "fs";
import { join } from "path";

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
  priceUsd?: string | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  dex?: string;
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

type InlineButton = { text: string; url: string };

type QueueItem =
  | { kind: "text"; text: string; buttons?: InlineButton[][] }
  | { kind: "photo"; imageUrl: string; caption: string; buttons?: InlineButton[][] };

const SUBSCRIBERS_FILE = join(process.cwd(), "telegram-bot", "data", "subscribers.json");
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

const MIN_DELAY_MS = 150;
const MAX_QUEUE_PER_CHAT = 50;
const MAX_RETRIES = 3;

const chatQueues = new Map<string, QueueItem[]>();
const chatBusy = new Map<string, boolean>();
const chatRateLimitedUntil = new Map<string, number>();

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

function isSubscriberPaused(chatId: string): boolean {
  const store = loadSubscribers();
  const sub = store[chatId];
  if (!sub) return true;
  return sub.settings?.alertsEnabled === false;
}

function safe(text: string): string {
  return (text || "").replace(/[*_`\[\]]/g, (c) => `\\${c}`);
}

function shortAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function buildButtons(alert: AlertBroadcastPayload): InlineButton[][] {
  const dexLink = alert.pairAddress || alert.address;
  const dexUrl = `https://dexscreener.com/solana/${dexLink}`;

  const rows: InlineButton[][] = [];

  const mainRow: InlineButton[] = [
    { text: "📈 View Chart", url: dexUrl },
  ];
  if (APP_URL) {
    mainRow.push({ text: "🌐 Alertly", url: `${APP_URL}/token/${alert.address}` });
  }
  rows.push(mainRow);

  const socialRow: InlineButton[] = [];
  if (alert.twitter) socialRow.push({ text: "🐦 Twitter", url: alert.twitter });
  if (alert.telegram) socialRow.push({ text: "📱 Telegram", url: alert.telegram });
  if (alert.website) socialRow.push({ text: "🌍 Website", url: alert.website });
  if (socialRow.length > 0) rows.push(socialRow);

  return rows;
}

function buildMessageText(alert: AlertBroadcastPayload): string {
  const isBoost = alert.type === "DEX_BOOST";
  const isListing = alert.type === "DEX_LISTING";

  const symbolBlock = alert.symbol ? ` $${safe(alert.symbol)}` : "";
  const tokenName = safe(alert.name);

  const lines: string[] = [];

  if (isBoost) {
    lines.push("⚡⚡⚡ *Token Boosted!*");
  } else if (isListing) {
    lines.push("🆕 *New Token has Paid DEX!*");
  } else {
    lines.push("🚨 *New Alert*");
  }

  lines.push("");
  lines.push(`🏷 *Token:* ${tokenName}${symbolBlock}`);
  lines.push(`🔗 *CA:* \`${shortAddress(alert.address)}\``);

  if (alert.priceUsd) {
    lines.push(`💰 *Price:* ${safe(alert.priceUsd)}`);
  }

  lines.push(`💎 *MC:* ${safe(alert.mc)}`);
  lines.push(`💧 *Liquidity:* ${safe(alert.liquidity)}`);
  lines.push(`📊 *Vol 24h:* ${safe(alert.vol)}`);

  if (isBoost) {
    if (alert.boostAmount != null && alert.boostAmount > 0) {
      lines.push(`⚡ *New Boost:* +${alert.boostAmount.toLocaleString()} units`);
    }
    if (alert.totalBoostAmount != null && alert.totalBoostAmount > 0) {
      lines.push(`📈 *Total Boosts:* ${alert.totalBoostAmount.toLocaleString()} units`);
    }
  }

  if (alert.dex) {
    lines.push(`🏦 *DEX:* ${safe(alert.dex)}`);
  }

  const timeStr = alert.alertedAt.toUTCString().replace(" GMT", " UTC");
  lines.push(`⏰ *Time:* ${timeStr}`);

  const dexLink = alert.pairAddress || alert.address;
  const dexUrl = `https://dexscreener.com/solana/${dexLink}`;
  lines.push("");
  lines.push(`[📈 View on DexScreener](${dexUrl})`);
  if (APP_URL) {
    lines.push(`[🌐 View on Alertly](${APP_URL}/token/${alert.address})`);
  }

  return lines.join("\n");
}

async function sendTelegramItem(chatId: string, item: QueueItem, attempt = 1): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN is not set — skipping notification");
    return false;
  }

  const baseUrl = `https://api.telegram.org/bot${token}`;

  const replyMarkup =
    item.buttons && item.buttons.length > 0
      ? {
          inline_keyboard: item.buttons.map((row) =>
            row.map((btn) => ({ text: btn.text, url: btn.url })),
          ),
        }
      : undefined;

  let url: string;
  let body: Record<string, unknown>;

  if (item.kind === "photo") {
    url = `${baseUrl}/sendPhoto`;
    body = {
      chat_id: chatId,
      photo: item.imageUrl,
      caption: item.caption.slice(0, 1024),
      parse_mode: "Markdown",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };
  } else {
    url = `${baseUrl}/sendMessage`;
    body = {
      chat_id: chatId,
      text: item.text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const rawBody = await res.text().catch(() => "{}");
      let retryAfterMs = 5000;
      try {
        const parsed = JSON.parse(rawBody);
        const retryAfterSec = parsed?.parameters?.retry_after;
        if (typeof retryAfterSec === "number" && retryAfterSec > 0) {
          retryAfterMs = retryAfterSec * 1000 + 200;
        }
      } catch {}
      if (attempt <= MAX_RETRIES) {
        console.warn(
          `[Telegram] 429 for ${chatId} — retrying in ${retryAfterMs}ms (attempt ${attempt}/${MAX_RETRIES})`,
        );
        chatRateLimitedUntil.set(chatId, Date.now() + retryAfterMs);
        await new Promise((r) => setTimeout(r, retryAfterMs));
        return sendTelegramItem(chatId, item, attempt + 1);
      }
      console.error(`[Telegram] Gave up on ${chatId} after ${MAX_RETRIES} retries (429)`);
      return false;
    }

    if (!res.ok && item.kind === "photo") {
      console.warn(
        `[Telegram] sendPhoto failed for ${chatId}: HTTP ${res.status} — falling back to text`,
      );
      return sendTelegramItem(
        chatId,
        { kind: "text", text: item.caption, buttons: item.buttons },
        attempt,
      );
    }

    if (!res.ok) {
      const rawBody = await res.text().catch(() => "");
      console.error(`[Telegram] Failed to send to ${chatId}: HTTP ${res.status} — ${rawBody}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(
      `[Telegram] Network error sending to ${chatId}:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

async function drainQueue(chatId: string): Promise<void> {
  if (chatBusy.get(chatId)) return;
  chatBusy.set(chatId, true);

  try {
    while (true) {
      const queue = chatQueues.get(chatId);
      if (!queue || queue.length === 0) break;

      if (isSubscriberPaused(chatId)) {
        queue.length = 0;
        break;
      }

      const rateLimitedUntil = chatRateLimitedUntil.get(chatId) ?? 0;
      const now = Date.now();
      if (now < rateLimitedUntil) {
        await new Promise((r) => setTimeout(r, rateLimitedUntil - now + 100));
      }

      const item = queue.shift();
      if (!item) break;

      await sendTelegramItem(chatId, item);
      await new Promise((r) => setTimeout(r, MIN_DELAY_MS));
    }
  } finally {
    chatBusy.set(chatId, false);
  }
}

function enqueueMessage(chatId: string, item: QueueItem): void {
  if (!chatQueues.has(chatId)) chatQueues.set(chatId, []);
  const queue = chatQueues.get(chatId)!;

  if (queue.length >= MAX_QUEUE_PER_CHAT) {
    queue.shift();
  }
  queue.push(item);

  drainQueue(chatId).catch(() => null);
}

export async function broadcastAlertToTelegram(alert: AlertBroadcastPayload) {
  const subscribers = loadSubscribers();
  const entries = Object.values(subscribers);

  if (entries.length === 0) return;

  const text = buildMessageText(alert);
  const buttons = buildButtons(alert);

  const item: QueueItem = alert.imageUrl
    ? { kind: "photo", imageUrl: alert.imageUrl, caption: text, buttons }
    : { kind: "text", text, buttons };

  let sent = 0;
  let skipped = 0;

  for (const sub of entries) {
    const settings = sub.settings ?? {};

    if (settings.alertsEnabled === false) {
      skipped++;
      continue;
    }
    if (!isAlertTypeEnabled(alert.type, settings)) {
      skipped++;
      continue;
    }

    enqueueMessage(sub.chatId, item);
    sent++;
  }

  if (sent > 0 || skipped > 0) {
    console.log(
      `[Telegram] ${alert.type} broadcast: sent=${sent}, skipped=${skipped}, token=${alert.name}`,
    );
  }
}
