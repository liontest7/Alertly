/**
 * Telegram bot alert sender
 * Sends real Solana alerts to users via Telegram
 */

import TelegramBot from "node-telegram-bot-api";
import { prisma } from "@/lib/prisma";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required");
}

const bot = new TelegramBot(token);

export async function sendAlertToUser(
  telegramId: string,
  alert: {
    tokenAddress: string;
    alertType: string;
    change: string;
    marketCap: string;
    volume: string;
  }
) {
  try {
    const message = `
🚨 *${alert.alertType} Alert*

📍 *Token*: \`${alert.tokenAddress.slice(0, 8)}...\`
📊 *Change*: ${alert.change}
💰 *Market Cap*: ${alert.marketCap}
📈 *Volume*: ${alert.volume}

⏰ Alert Time: ${new Date().toLocaleTimeString()}
    `.trim();

    await bot.sendMessage(Number(telegramId), message, {
      parse_mode: "Markdown",
    });

    console.log(`✅ Alert sent to Telegram user ${telegramId}`);
  } catch (error) {
    console.error(`Failed to send alert to ${telegramId}:`, error);
  }
}

export async function broadcastAlert(alert: any) {
  try {
    // Get all users with this alert type enabled
    const telegramLinks = await prisma.telegramLink.findMany({
      include: {
        user: {
          include: {
            settings: true,
          },
        },
      },
    });

    for (const link of telegramLinks) {
      const settings = link.user.settings;

      if (settings?.alertsEnabled === false) continue;

      const alertType = (alert.alertType || "").toLowerCase().replace(/[_\s]/g, "-");
      const shouldSend =
        alertType === "dex-boost" ? settings?.dexBoostEnabled !== false :
        alertType === "dex-listing" ? settings?.dexListingEnabled !== false :
        true;

      if (shouldSend) {
        await sendAlertToUser(String(link.telegramId), alert);
      }
    }
  } catch (error) {
    console.error("Error broadcasting alert:", error);
  }
}
