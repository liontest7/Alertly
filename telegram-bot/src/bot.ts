import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN for telegram bot");
}

const apiBaseUrl = process.env.ALERTLY_API_BASE_URL || process.env.NEXTAUTH_URL;
if (!apiBaseUrl) {
  throw new Error("Missing ALERTLY_API_BASE_URL (or NEXTAUTH_URL) for telegram bot API integration");
}
const internalApiKey = process.env.INTERNAL_API_KEY || "dev-internal-api-key";

const bot = new TelegramBot(token, { polling: true });

const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "🔄 Auto-Trade", callback_data: "toggle_auto" },
        { text: "💰 Buy Amount", callback_data: "set_buy" },
      ],
      [
        { text: "📊 Slippage", callback_data: "set_slippage" },
        { text: "🚨 Price Alerts", callback_data: "set_alerts" },
      ],
      [
        { text: "🛡️ Auto-Buy Protection", callback_data: "toggle_protection" },
        { text: "🚀 Signal Preferences", callback_data: "signals" },
      ],
      [{ text: "-- Exit Strategies --", callback_data: "none" }],
      [
        { text: "📈 Take Profit", callback_data: "set_tp" },
        { text: "🛑 Stop Loss", callback_data: "set_sl" },
      ],
      [
        { text: "🎯 Trailing Stop", callback_data: "set_ts" },
        { text: "⤴️ Trailing TP", callback_data: "set_ttp" },
      ],
    ],
  },
};

async function fetchBotSettings(telegramId: string) {
  const res = await fetch(`${apiBaseUrl}/api/bot/settings?telegramId=${encodeURIComponent(telegramId)}`, {
    headers: { Authorization: `Bearer ${internalApiKey}` },
  });

  if (!res.ok) throw new Error(`Failed to fetch settings: ${res.status}`);
  return res.json();
}

async function updateBotSettings(telegramId: string, payload: Record<string, unknown>) {
  const res = await fetch(`${apiBaseUrl}/api/bot/settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${internalApiKey}`,
    },
    body: JSON.stringify({ telegramId, ...payload }),
  });

  if (!res.ok) throw new Error(`Failed to update settings: ${res.status}`);
  return res.json();
}

async function confirmLink(tokenValue: string, telegramId: string) {
  const res = await fetch(`${apiBaseUrl}/api/bot/telegram-link/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${internalApiKey}`,
    },
    body: JSON.stringify({ token: tokenValue, telegramId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: "Failed to link Telegram account" }));
    throw new Error(data.message || "Failed to link Telegram account");
  }

  return res.json();
}

const getSettingsText = async (telegramId: string) => {
  try {
    const settings = await fetchBotSettings(telegramId);

    return `⚙️ *Alertly Control Center*\n\n*Trading Configuration*\n💰 Buy Amount: ${settings.buyAmount} SOL\n📊 Slippage: ${settings.slippage}%\n🔄 Auto-Trade: ${settings.autoTrade ? "✅ Enabled" : "❌ Disabled"}\n\n*Exit Strategy*\n📈 Take Profit: +${settings.takeProfit}%\n🛑 Stop Loss: ${settings.stopLoss}%\n\n*Discovery Filters*\n💹 Market Cap: $${(settings.minMarketCap / 1000).toFixed(0)}K - $${(settings.maxMarketCap / 1000000).toFixed(0)}M\n👥 Min Holders: ${settings.minHolders}\n\nStay sharp. Stay early. Stay Alertly.`;
  } catch {
    return "❌ Telegram account is not linked yet.\n\nIn the web app, open Telegram Link and run the generated command:\n`/link <token>`";
  }
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    "Welcome to *Alertly* — real-time Solana intelligence for serious traders.\n\n1) Link your account from the website (Telegram Link section).\n2) Run `/link <token>` here once.\n3) Use `/settings` to manage your live trading preferences.",
    { parse_mode: "Markdown" },
  );
});

bot.onText(/\/link\s+(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const tokenValue = match?.[1]?.trim();

  if (!tokenValue) {
    await bot.sendMessage(chatId, "Usage: /link <token>");
    return;
  }

  try {
    await confirmLink(tokenValue, String(chatId));
    await bot.sendMessage(
      chatId,
      "✅ Telegram account linked successfully.\nUse /settings to manage synced Alertly preferences.",
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not link your account.";
    await bot.sendMessage(chatId, `❌ ${message}`);
  }
});

bot.onText(/\/settings/, async (msg) => {
  const chatId = msg.chat.id;
  const text = await getSettingsText(String(chatId));
  bot.sendMessage(chatId, text, { parse_mode: "Markdown", ...mainMenu });
});

bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id;
  if (!chatId) return;
  const telegramId = String(chatId);

  if (query.data === "toggle_auto") {
    try {
      const current = await fetchBotSettings(telegramId);
      await updateBotSettings(telegramId, { autoTrade: !current.autoTrade });

      const newText = await getSettingsText(telegramId);
      bot.editMessageText(newText, {
        chat_id: chatId,
        message_id: query.message!.message_id,
        parse_mode: "Markdown",
        ...mainMenu,
      });
      bot.answerCallbackQuery(query.id, { text: `Auto-Trade ${!current.autoTrade ? "Enabled" : "Disabled"}` });
    } catch {
      bot.answerCallbackQuery(query.id, { text: "❌ Failed to update settings" });
    }
  }
});

console.log("Alertly Telegram Bot is active.");
