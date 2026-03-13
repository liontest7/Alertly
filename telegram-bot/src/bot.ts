import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN for telegram bot");
}

const apiBaseUrl = process.env.ALERTLY_API_BASE_URL || process.env.API_URL;
if (!apiBaseUrl) {
  throw new Error("Missing ALERTLY_API_BASE_URL (or API_URL) for telegram bot API integration");
}
const internalApiKey = process.env.INTERNAL_API_KEY || process.env.ALERTLY_INTERNAL_API_KEY || "dev-internal-api-key";

const DAILY_ALERT_LIMIT = 50;

const DEFAULT_USER_SETTINGS = {
  id: "default",
  userId: "guest",
  buyAmount: 0.5,
  maxBuyPerToken: 2.0,
  slippage: 10.0,
  autoTrade: false,
  minMarketCap: 0,
  maxMarketCap: 0,
  minHolders: 1,
  minLiquidity: 0,
  takeProfit: 50,
  stopLoss: 25,
  trailingStop: false,
  autoSellMinutes: 0,
  volumeSpikeEnabled: true,
  volumeSpikeThreshold: 50,
  whaleAlertEnabled: true,
  whaleMinSolBalance: 500,
  dexBoostEnabled: true,
  dexListingEnabled: true,
  sources: ["Raydium", "Jupiter", "Pump.fun", "Meteora", "Orca"],
  selectedBoostLevel: "all",
  alertsEnabled: true,
  isPremium: false,
  dailyAlertCount: 0,
};

const bot = new TelegramBot(token, { polling: { autoStart: true, params: { timeout: 10 } }, cancellation: true } as any);

const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "🔄 Auto-Trade", callback_data: "toggle_auto" },
        { text: "💰 Buy Amount", callback_data: "set_buy" },
      ],
      [
        { text: "📊 Slippage", callback_data: "set_slippage" },
        { text: "🚀 Max Buy/Token", callback_data: "set_max_buy" },
      ],
      [
        { text: "📈 Take Profit", callback_data: "set_tp" },
        { text: "🛑 Stop Loss", callback_data: "set_sl" },
      ],
      [
        { text: "🎯 Trailing Stop", callback_data: "toggle_ts" },
        { text: "⏱️ Auto-Sell (m)", callback_data: "set_autosell" },
      ],
      [{ text: "-- Alerts --", callback_data: "none" }],
      [{ text: "🔔 Pause / Resume Alerts", callback_data: "toggle_alerts" }],
      [
        { text: "🔊 Vol Spike", callback_data: "toggle_vol" },
        { text: "🐋 Whale", callback_data: "toggle_whale" },
      ],
      [
        { text: "⚡ Dex Boost", callback_data: "toggle_boost" },
        { text: "💎 Dex Listing", callback_data: "toggle_list" },
      ],
      [{ text: "📦 Boost Level Filter", callback_data: "boost_levels" }],
      [{ text: "-- Filters --", callback_data: "none" }],
      [
        { text: "👥 Min Holders", callback_data: "set_min_holders" },
        { text: "💧 Min Liquidity", callback_data: "set_min_liquidity" },
      ],
      [
        { text: "📉 Min MC", callback_data: "set_min_mc" },
        { text: "📈 Max MC", callback_data: "set_max_mc" },
      ],
      [
        { text: "📊 Vol Spike %", callback_data: "set_vol_threshold" },
        { text: "🐳 Min Whale SOL", callback_data: "set_whale_sol" },
      ],
    ],
  },
};

async function fetchBotSettings(telegramId: string) {
  const res = await fetch(`${apiBaseUrl}/api/bot/settings?telegramId=${encodeURIComponent(telegramId)}`, {
    headers: { Authorization: `Bearer ${internalApiKey}` },
  });

  if (!res.ok) {
    if (res.status === 404) {
      return DEFAULT_USER_SETTINGS;
    }
    throw new Error(`Failed to fetch settings: ${res.status}`);
  }
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

function formatBoostLevel(level: string): string {
  if (!level || level === "all") return "All Levels";
  return level;
}

function formatMc(val: number): string {
  if (!val || val === 0) return "No limit";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

const getSettingsText = async (telegramId: string, isUnlinked: boolean = false) => {
  try {
    const s = await fetchBotSettings(telegramId);
    const unlinkedNotice = isUnlinked ? "\n⚠️ *Account not linked yet* - /start to link your dashboard\n" : "";

    const whaleMinSol = s.whaleMinSolBalance ?? s.whaleMinSol ?? 500;
    const volThreshold = s.volumeSpikeThreshold || 50;
    const alertsStatus = s.alertsEnabled !== false ? "▶️ Active" : "⏸️ Paused";
    const planLabel = s.isPremium ? "⭐ VIP" : `🆓 Free (${s.dailyAlertCount || 0}/${DAILY_ALERT_LIMIT} today)`;

    return `⚙️ *Alertly Control Center*${unlinkedNotice}
*Plan:* ${planLabel}
*Alerts:* ${alertsStatus}

*Trading Configuration*
💰 Buy Amount: ${s.buyAmount} SOL
🚀 Max Buy/Token: ${s.maxBuyPerToken} SOL
📊 Slippage: ${s.slippage}%
🔄 Auto-Trade: ${s.autoTrade ? "✅ ON" : "❌ OFF"}

*Exit Strategy*
📈 Take Profit: +${s.takeProfit}%
🛑 Stop Loss: -${s.stopLoss}%
🎯 Trailing Stop: ${s.trailingStop ? "✅ ON" : "❌ OFF"}
⏱️ Auto-Sell: ${s.autoSellMinutes > 0 ? `${s.autoSellMinutes} min` : "OFF"}

*Active Alerts*
🔊 Volume Spike: ${s.volumeSpikeEnabled ? "✅" : "❌"}
   └ Threshold: +${volThreshold}% / 60s
🐋 Whale Alert: ${s.whaleAlertEnabled ? "✅" : "❌"}
   └ Min Balance: ${whaleMinSol} SOL (all wallets)
⚡ Dex Boost: ${s.dexBoostEnabled ? "✅" : "❌"}
   └ Level: ${formatBoostLevel(s.selectedBoostLevel || "all")}
💎 Dex Listing: ${s.dexListingEnabled ? "✅" : "❌"}

*Filters*
📉 Min MC: ${formatMc(s.minMarketCap || 0)}
📈 Max MC: ${formatMc(s.maxMarketCap || 0)}
💧 Min Liquidity: ${s.minLiquidity > 0 ? `$${(s.minLiquidity / 1000).toFixed(0)}K` : "No limit"}
👥 Min Holders: ${s.minHolders || 1}

Stay sharp. Stay early. Stay Alerty.`;
  } catch {
    return "❌ Telegram account is not linked yet.\n\nIn the web app, open Telegram Link and run the generated command:\n`/link <token>`";
  }
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    "Welcome to *Alerty* — real-time Solana intelligence for serious traders.\n\n1) Link your account from the website (Telegram Link section).\n2) Run `/link <token>` here once.\n3) Use `/settings` to manage your live trading preferences.",
    { parse_mode: "Markdown" },
  );
});


bot.onText(/\/start\s+(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const tokenValue = match?.[1]?.trim();

  if (!tokenValue) {
    return;
  }

  try {
    await confirmLink(tokenValue, String(chatId));
    await bot.sendMessage(chatId, "✅ Telegram account linked successfully from deep-link. Use /settings to manage controls.");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not link your account.";
    await bot.sendMessage(chatId, `❌ ${message}`);
  }
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
      "✅ Telegram account linked successfully.\nUse /settings to manage synced Alerty preferences.",
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
  const data = query.data;

  if (data === "none") {
    bot.answerCallbackQuery(query.id);
    return;
  }

  try {
    const s = await fetchBotSettings(telegramId);
    let update: Record<string, any> = {};
    let answer = "";

    if (data === "toggle_alerts") {
      const newEnabled = s.alertsEnabled === false ? true : false;
      update = { alertsEnabled: newEnabled };
      answer = newEnabled ? "▶️ Alerts resumed" : "⏸️ Alerts paused";
    } else if (data === "toggle_auto") {
      update = { autoTrade: !s.autoTrade };
      answer = `Auto-Trade ${!s.autoTrade ? "ON" : "OFF"}`;
    } else if (data === "toggle_ts") {
      update = { trailingStop: !s.trailingStop };
      answer = `Trailing Stop ${!s.trailingStop ? "ON" : "OFF"}`;
    } else if (data === "toggle_vol") {
      update = { volumeSpikeEnabled: !s.volumeSpikeEnabled };
      answer = `Vol Spike ${!s.volumeSpikeEnabled ? "ON" : "OFF"}`;
    } else if (data === "toggle_whale") {
      update = { whaleAlertEnabled: !s.whaleAlertEnabled };
      answer = `Whale Alert ${!s.whaleAlertEnabled ? "ON" : "OFF"}`;
    } else if (data === "toggle_boost") {
      update = { dexBoostEnabled: !s.dexBoostEnabled };
      answer = `Dex Boost ${!s.dexBoostEnabled ? "ON" : "OFF"}`;
    } else if (data === "toggle_list") {
      update = { dexListingEnabled: !s.dexListingEnabled };
      answer = `Dex Listing ${!s.dexListingEnabled ? "ON" : "OFF"}`;
    } else if (data === "boost_levels") {
      const boostMenu = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ All Levels", callback_data: "boost_level_all" },
            ],
            [
              { text: "Level 1", callback_data: "boost_level_1" },
              { text: "Level 2", callback_data: "boost_level_2" },
            ],
            [
              { text: "Level 3", callback_data: "boost_level_3" },
              { text: "Level 4", callback_data: "boost_level_4" },
            ],
            [
              { text: "Top Boost", callback_data: "boost_level_top" },
            ],
            [{ text: "← Back", callback_data: "back_menu" }],
          ],
        },
      };
      bot.editMessageText("Select boost level to track (default: All Levels):", {
        chat_id: chatId,
        message_id: query.message!.message_id,
        ...boostMenu,
      });
      bot.answerCallbackQuery(query.id);
      return;
    } else if (data?.startsWith("boost_level_")) {
      const levelMap: Record<string, string> = {
        "boost_level_all": "all",
        "boost_level_1": "Level 1",
        "boost_level_2": "Level 2",
        "boost_level_3": "Level 3",
        "boost_level_4": "Level 4",
        "boost_level_top": "Top Boost",
      };
      const level = levelMap[data];
      if (level) {
        await updateBotSettings(telegramId, { selectedBoostLevel: level });
        const newText = await getSettingsText(telegramId);
        bot.editMessageText(newText, {
          chat_id: chatId,
          message_id: query.message!.message_id,
          parse_mode: "Markdown",
          ...mainMenu,
        });
        bot.answerCallbackQuery(query.id, { text: `Selected: ${formatBoostLevel(level)}` });
      }
      return;
    } else if (data === "back_menu") {
      const newText = await getSettingsText(telegramId);
      bot.editMessageText(newText, {
        chat_id: chatId,
        message_id: query.message!.message_id,
        parse_mode: "Markdown",
        ...mainMenu,
      });
      bot.answerCallbackQuery(query.id);
      return;
    } else if (data?.startsWith("set_")) {
      const field = data.replace("set_", "");
      const promptMap: Record<string, string> = {
        buy: "Enter Buy Amount in SOL (e.g., 0.5):",
        max_buy: "Enter Max Buy Per Token in SOL (e.g., 2.0):",
        slippage: "Enter Slippage % (e.g., 10):",
        tp: "Enter Take Profit % (e.g., 50):",
        sl: "Enter Stop Loss % (e.g., 25):",
        autosell: "Enter Auto-Sell minutes (0 to disable):",
        min_holders: "Enter Min Holders (e.g., 1, default 1 = show all):",
        min_liquidity: "Enter Min Liquidity in USD (e.g., 0 = no filter, 5000 = $5K):",
        min_mc: "Enter Min Market Cap in USD (e.g., 0 = no filter, 10000 = $10K):",
        max_mc: "Enter Max Market Cap in USD (e.g., 0 = no filter, 1000000 = $1M):",
        vol_threshold: "Enter Volume Spike threshold % (e.g., 50 = alert when volume +50% in 60s):",
        whale_sol: "Enter Min Whale SOL balance (e.g., 500 = alert when wallet has 500+ SOL):",
      };
      
      const prompt = promptMap[field];
      if (prompt) {
        const msg = await bot.sendMessage(chatId, prompt, { reply_markup: { force_reply: true } });
        bot.onReplyToMessage(chatId, msg.message_id, async (reply) => {
          const val = parseFloat(reply.text || "0");
          if (!isNaN(val)) {
            const fieldMap: Record<string, string> = {
              buy: "buyAmount",
              max_buy: "maxBuyPerToken",
              slippage: "slippage",
              tp: "takeProfit",
              sl: "stopLoss",
              autosell: "autoSellMinutes",
              min_holders: "minHolders",
              min_liquidity: "minLiquidity",
              min_mc: "minMarketCap",
              max_mc: "maxMarketCap",
              vol_threshold: "volumeSpikeThreshold",
              whale_sol: "whaleMinSolBalance",
            };
            await updateBotSettings(telegramId, { [fieldMap[field]]: val });
            const newText = await getSettingsText(telegramId);
            bot.sendMessage(chatId, "✅ Updated!\n\n" + newText, { parse_mode: "Markdown", ...mainMenu });
          }
        });
        bot.answerCallbackQuery(query.id);
        return;
      }
    }

    if (Object.keys(update).length > 0) {
      await updateBotSettings(telegramId, update);
      const newText = await getSettingsText(telegramId);
      bot.editMessageText(newText, {
        chat_id: chatId,
        message_id: query.message!.message_id,
        parse_mode: "Markdown",
        ...mainMenu,
      });
      bot.answerCallbackQuery(query.id, { text: answer });
    }
  } catch (e) {
    console.error("Bot action error:", e);
    bot.answerCallbackQuery(query.id, { text: "❌ Error updating settings" });
  }
});

console.log("Alertly Telegram Bot is active.");


bot.onText(/\/health/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const res = await fetch(`${apiBaseUrl}/api/health`);
    const data = await res.json().catch(() => ({}));
    await bot.sendMessage(chatId, `Health: ${res.status}\nreadyForLaunch: ${data?.readyForLaunch}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "health check failed";
    await bot.sendMessage(chatId, `❌ ${message}`);
  }
});
