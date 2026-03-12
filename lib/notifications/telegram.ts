import { prisma } from "@/lib/prisma";

export type AlertBroadcastPayload = {
  address: string;
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
  lines.push(`[View on DexScreener](https://dexscreener.com/solana/${alert.address})`);

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
    if (!shouldSendByType(alert.type, settings)) continue;
    await sendTelegramMessage(link.telegramId, message);
  }
}
