import { prisma } from "@/lib/prisma";
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
};

type UserSettingsLike = {
  alertsEnabled?: boolean | null;
  dexBoostEnabled?: boolean | null;
  dexListingEnabled?: boolean | null;
};

function isAlertTypeEnabled(type: string, settings: UserSettingsLike | null | undefined): boolean {
  if (type === "DEX_BOOST") return settings?.dexBoostEnabled !== false;
  if (type === "DEX_LISTING") return settings?.dexListingEnabled !== false;
  return true;
}

function isAlertsEnabled(settings: UserSettingsLike | null | undefined): boolean {
  return settings?.alertsEnabled !== false;
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

  if (alert.boostAmount != null && alert.boostAmount > 0) {
    lines.push(`*Boost Amount:* ${alert.boostAmount.toLocaleString()} units`);
  }

  lines.push(`*Market Cap:* ${alert.mc}`);
  lines.push(`*Liquidity:* ${alert.liquidity}`);
  lines.push(`*Volume 24h:* ${alert.vol}`);
  lines.push(`*Time:* ${alert.alertedAt.toUTCString()}`);
  lines.push(`[View on DexScreener](https://dexscreener.com/solana/${dexLink})`);

  return lines.join("\n");
}

async function sendTelegramMessage(telegramId: string, text: string): Promise<boolean> {
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
        chat_id: telegramId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[Telegram] Failed to send to ${telegramId}: HTTP ${res.status} — ${body}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Telegram] Network error sending to ${telegramId}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

export async function sendCurrentAlertsToNewUser(telegramId: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const all = getAlerts();
  const dexBoosts = all.filter((a) => a.type === "DEX_BOOST" || a.type === "DEX_LISTING");
  if (dexBoosts.length === 0) return;

  const toSend = dexBoosts.slice(0, 8);

  await sendTelegramMessage(
    telegramId,
    `✅ *Alertly linked!* Here are ${toSend.length} active DEX alerts right now:`,
  );

  for (const alert of toSend) {
    await sendTelegramMessage(
      telegramId,
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
      }),
    );
    await new Promise((r) => setTimeout(r, 120));
  }
}

export async function broadcastAlertToTelegram(alert: AlertBroadcastPayload) {
  const links = await prisma.telegramLink
    .findMany({
      include: {
        user: {
          include: {
            settings: true,
          },
        },
      },
    })
    .catch((err) => {
      console.error("[Telegram] Failed to fetch telegram links:", err instanceof Error ? err.message : err);
      return [];
    });

  if (links.length === 0) return;

  const message = buildTelegramMessage(alert);
  let sent = 0;
  let skipped = 0;

  for (const link of links) {
    const settings = link.user?.settings ?? null;

    if (!isAlertsEnabled(settings)) {
      skipped++;
      continue;
    }

    if (!isAlertTypeEnabled(alert.type, settings)) {
      skipped++;
      continue;
    }

    const ok = await sendTelegramMessage(link.telegramId, message);
    if (ok) sent++;
  }

  console.log(`[Telegram] ${alert.type} broadcast: sent=${sent}, skipped=${skipped}, token=${alert.name}`);
}
