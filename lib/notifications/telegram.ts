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
};

function shouldSendByType(type: string, settings: {
  dexBoostEnabled: boolean;
  dexListingEnabled: boolean;
  volumeSpikeEnabled: boolean;
  whaleAlertEnabled: boolean;
}) {
  if (type === "DEX_BOOST") return settings.dexBoostEnabled;
  if (type === "DEX_LISTING") return settings.dexListingEnabled;
  if (type === "VOLUME_SPIKE") return settings.volumeSpikeEnabled;
  if (type === "WHALE_BUY") return settings.whaleAlertEnabled;
  return true;
}

function buildTelegramMessage(alert: AlertBroadcastPayload) {
  const symbolBlock = alert.symbol ? ` (${alert.symbol})` : "";
  return [
    `🚨 *${alert.type.replaceAll("_", " ")}*`,
    "",
    `*Token:* ${alert.name}${symbolBlock}`,
    `*Contract:* \`${alert.address}\``,
    `*Market Cap:* ${alert.mc}`,
    `*Liquidity:* ${alert.liquidity}`,
    `*Volume:* ${alert.vol}`,
    `*Time:* ${alert.alertedAt.toISOString()}`,
  ].join("\n");
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
      disable_web_page_preview: true,
    }),
  }).catch(() => null);
}

export async function broadcastAlertToTelegram(alert: AlertBroadcastPayload) {
  const links = await prisma.telegramLink.findMany({
    include: {
      user: {
        include: {
          settings: true,
        },
      },
    },
  });

  const message = buildTelegramMessage(alert);
  for (const link of links) {
    const settings = link.user.settings;
    if (!settings) continue;

    if (!shouldSendByType(alert.type, settings)) continue;
    await sendTelegramMessage(link.telegramId, message);
  }
}
