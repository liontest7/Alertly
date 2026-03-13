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
  wallet?: string;
  walletBalance?: number;
  buyAmountSol?: number;
  imageUrl?: string;
};

const DAILY_ALERT_LIMIT = 50;

function shouldSendByType(
  type: string,
  settings: {
    dexBoostEnabled: boolean;
    dexListingEnabled: boolean;
    volumeSpikeEnabled: boolean;
    whaleAlertEnabled: boolean;
  },
) {
  if (type === "DEX_BOOST") return settings.dexBoostEnabled;
  if (type === "DEX_LISTING") return settings.dexListingEnabled;
  if (type === "VOLUME_SPIKE") return settings.volumeSpikeEnabled;
  if (type === "WHALE_BUY") return settings.whaleAlertEnabled;
  return true;
}

function shortAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function buildTelegramMessage(alert: AlertBroadcastPayload) {
  const symbolBlock = alert.symbol ? ` (${alert.symbol})` : "";
  const typeLabel = alert.type.replaceAll("_", " ");

  const lines = [
    `🚨 *${typeLabel}*`,
    "",
    `*Token:* ${alert.name}${symbolBlock}`,
    `*CA:* \`${shortAddress(alert.address)}\``,
    `*Market Cap:* ${alert.mc}`,
    `*Liquidity:* ${alert.liquidity}`,
    `*Volume 24h:* ${alert.vol}`,
  ];

  if (alert.type === "WHALE_BUY") {
    if (alert.wallet) lines.push(`*Whale Wallet:* \`${shortAddress(alert.wallet)}\``);
    if (typeof alert.walletBalance === "number") lines.push(`*SOL Balance:* ${alert.walletBalance.toFixed(0)} SOL`);
    if (typeof alert.buyAmountSol === "number") lines.push(`*Buy Amount:* ~${alert.buyAmountSol.toFixed(2)} SOL`);
  }

  lines.push(`*Time:* ${alert.alertedAt.toISOString()}`);
  const dexLink = alert.pairAddress || alert.address;
  lines.push(`[View on DexScreener](https://dexscreener.com/solana/${dexLink})`);

  return lines.join("\n");
}

async function sendTelegramMessage(telegramId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    }),
  }).catch(() => null);
}

async function checkAndIncrementDailyCount(userId: string, settings: any): Promise<boolean> {
  if (settings.isPremium) return true;

  const now = new Date();
  const lastReset = settings.lastAlertReset ? new Date(settings.lastAlertReset) : now;
  const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

  if (hoursSinceReset >= 24) {
    await prisma.userSetting.update({
      where: { userId },
      data: { dailyAlertCount: 1, lastAlertReset: now },
    }).catch(() => null);
    return true;
  }

  if (settings.dailyAlertCount >= DAILY_ALERT_LIMIT) {
    return false;
  }

  await prisma.userSetting.update({
    where: { userId },
    data: { dailyAlertCount: { increment: 1 } },
  }).catch(() => null);

  return true;
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
        pairAddress: alert.pairAddress,
        type: alert.type,
        name: alert.name,
        symbol: alert.symbol || undefined,
        mc: alert.mc,
        liquidity: alert.liquidity,
        vol: alert.vol,
        alertedAt: alert.alertedAt,
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
    .catch(() => []);

  const message = buildTelegramMessage(alert);

  for (const link of links) {
    const settings = link.user.settings;
    if (!settings) continue;

    if (settings.alertsEnabled === false) continue;

    if (!shouldSendByType(alert.type, settings)) continue;

    const canSend = await checkAndIncrementDailyCount(link.user.id, settings);
    if (!canSend) continue;

    await sendTelegramMessage(link.telegramId, message);
  }
}
