import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN for telegram bot");
}

const DATA_DIR = join(__dirname, "..", "data");
const SUBSCRIBERS_FILE = join(DATA_DIR, "subscribers.json");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}
if (!existsSync(SUBSCRIBERS_FILE)) {
  writeFileSync(SUBSCRIBERS_FILE, "{}", "utf-8");
}

type SubscriberSettings = {
  alertsEnabled: boolean;
  dexBoostEnabled: boolean;
  dexListingEnabled: boolean;
  selectedBoostLevel: string;
  buyAmount: number;
  slippage: number;
  takeProfit: number;
  stopLoss: number;
  minMarketCap: number;
  maxMarketCap: number;
  minLiquidity: number;
  minHolders: number;
};

type Subscriber = {
  chatId: string;
  firstName?: string;
  subscribedAt: string;
  settings: SubscriberSettings;
};

type SubscriberStore = Record<string, Subscriber>;

const DEFAULT_SETTINGS: SubscriberSettings = {
  alertsEnabled: true,
  dexBoostEnabled: true,
  dexListingEnabled: true,
  selectedBoostLevel: "all",
  buyAmount: 0.5,
  slippage: 10,
  takeProfit: 50,
  stopLoss: 25,
  minMarketCap: 0,
  maxMarketCap: 0,
  minLiquidity: 0,
  minHolders: 0,
};

function loadStore(): SubscriberStore {
  try {
    const raw = readFileSync(SUBSCRIBERS_FILE, "utf-8");
    return JSON.parse(raw) as SubscriberStore;
  } catch {
    return {};
  }
}

function saveStore(store: SubscriberStore): void {
  writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function getSubscriber(chatId: string): Subscriber | null {
  const store = loadStore();
  return store[chatId] ?? null;
}

function upsertSubscriber(chatId: string, firstName?: string): Subscriber {
  const store = loadStore();
  if (!store[chatId]) {
    store[chatId] = {
      chatId,
      firstName,
      subscribedAt: new Date().toISOString(),
      settings: { ...DEFAULT_SETTINGS },
    };
  } else if (firstName) {
    store[chatId].firstName = firstName;
  }
  saveStore(store);
  return store[chatId];
}

function removeSubscriber(chatId: string): void {
  const store = loadStore();
  delete store[chatId];
  saveStore(store);
}

function updateSettings(chatId: string, patch: Partial<SubscriberSettings>): SubscriberSettings {
  const store = loadStore();
  if (!store[chatId]) {
    store[chatId] = {
      chatId,
      subscribedAt: new Date().toISOString(),
      settings: { ...DEFAULT_SETTINGS },
    };
  }
  store[chatId].settings = { ...store[chatId].settings, ...patch };
  saveStore(store);
  return store[chatId].settings;
}

function formatMc(val: number): string {
  if (!val || val === 0) return "No limit";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

function formatBoostLevel(level: string): string {
  if (!level || level === "all") return "All Levels";
  return level;
}

function getSettingsText(chatId: string): string {
  const sub = getSubscriber(chatId);
  const s = sub?.settings ?? DEFAULT_SETTINGS;

  const alertsStatus = s.alertsEnabled ? "▶️ Active" : "⏸️ Paused";

  return `⚙️ *Alertly Settings*

*Alerts:* ${alertsStatus}

*Alert Monitors*
⚡ Dex Boost: ${s.dexBoostEnabled ? "✅" : "❌"}
   └ Level: ${formatBoostLevel(s.selectedBoostLevel)}
🆕 Dex Listing: ${s.dexListingEnabled ? "✅" : "❌"}

*Filters*
📉 Min MC: ${formatMc(s.minMarketCap)}
📈 Max MC: ${formatMc(s.maxMarketCap)}
💧 Min Liquidity: ${s.minLiquidity > 0 ? `$${(s.minLiquidity / 1000).toFixed(0)}K` : "No limit"}
👥 Min Holders: ${s.minHolders > 0 ? s.minHolders : "No filter"}

*Trading*
💰 Buy Amount: ${s.buyAmount} SOL
📊 Slippage: ${s.slippage}%
📈 Take Profit: +${s.takeProfit}%
🛑 Stop Loss: -${s.stopLoss}%

Stay sharp. Stay early. Stay Alertly. 🚀`;
}

const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "🔔 Pause / Resume Alerts", callback_data: "toggle_alerts" },
      ],
      [
        { text: "⚡ Dex Boost", callback_data: "toggle_boost" },
        { text: "🆕 Dex Listing", callback_data: "toggle_list" },
      ],
      [{ text: "📦 Boost Level Filter", callback_data: "boost_levels" }],
      [
        { text: "📉 Min MC", callback_data: "set_min_mc" },
        { text: "📈 Max MC", callback_data: "set_max_mc" },
      ],
      [
        { text: "💧 Min Liquidity", callback_data: "set_min_liquidity" },
        { text: "👥 Min Holders", callback_data: "set_min_holders" },
      ],
      [
        { text: "💰 Buy Amount", callback_data: "set_buy" },
        { text: "📊 Slippage", callback_data: "set_slippage" },
      ],
      [
        { text: "📈 Take Profit", callback_data: "set_tp" },
        { text: "🛑 Stop Loss", callback_data: "set_sl" },
      ],
    ],
  },
};

const bot = new TelegramBot(token, { polling: { autoStart: false, params: { timeout: 10 } }, cancellation: true } as any);

bot.on("polling_error", (err: any) => {
  if (err?.code === "ETELEGRAM" && err?.message?.includes("409")) return;
  console.error("[Bot] polling error:", err?.message || err);
});

(bot as any).startPolling({ restart: false });

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);
  const firstName = msg.from?.first_name;

  upsertSubscriber(chatIdStr, firstName);

  await bot.sendMessage(
    chatId,
    `👋 *Welcome${firstName ? ` ${firstName}` : ""} to Alertly!*\n\n` +
    `You are now subscribed to real-time Solana DEX alerts.\n\n` +
    `*What you'll receive:*\n` +
    `⚡ DEX Boost alerts — every new or increased token boost\n` +
    `🆕 DEX Listing alerts — new Solana tokens on DexScreener\n\n` +
    `Use /settings to customize your filters.\n` +
    `Use /stop to unsubscribe at any time.`,
    { parse_mode: "Markdown" },
  );
});

bot.onText(/\/stop/, async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);
  removeSubscriber(chatIdStr);
  await bot.sendMessage(chatId, "✅ You have been unsubscribed from Alertly alerts.\n\nSend /start to re-subscribe anytime.");
});

bot.onText(/\/settings/, async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);
  upsertSubscriber(chatIdStr, msg.from?.first_name);
  bot.sendMessage(chatId, getSettingsText(chatIdStr), { parse_mode: "Markdown", ...mainMenu });
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);
  const store = loadStore();
  const count = Object.keys(store).length;
  const sub = store[chatIdStr];
  await bot.sendMessage(
    chatId,
    `📊 *Alertly Status*\n\n` +
    `Total subscribers: ${count}\n` +
    `Your status: ${sub ? "✅ Subscribed" : "❌ Not subscribed"}\n` +
    (sub ? `Subscribed since: ${new Date(sub.subscribedAt).toLocaleDateString()}` : ""),
    { parse_mode: "Markdown" },
  );
});

bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id;
  if (!chatId) return;
  const chatIdStr = String(chatId);
  const data = query.data;

  if (data === "none") { bot.answerCallbackQuery(query.id); return; }

  upsertSubscriber(chatIdStr, query.from?.first_name);

  try {
    const s = getSubscriber(chatIdStr)!.settings;
    let patch: Partial<SubscriberSettings> = {};
    let answer = "";

    if (data === "toggle_alerts") {
      patch = { alertsEnabled: !s.alertsEnabled };
      answer = !s.alertsEnabled ? "▶️ Alerts resumed" : "⏸️ Alerts paused";
    } else if (data === "toggle_boost") {
      patch = { dexBoostEnabled: !s.dexBoostEnabled };
      answer = `Dex Boost ${!s.dexBoostEnabled ? "ON" : "OFF"}`;
    } else if (data === "toggle_list") {
      patch = { dexListingEnabled: !s.dexListingEnabled };
      answer = `Dex Listing ${!s.dexListingEnabled ? "ON" : "OFF"}`;
    } else if (data === "boost_levels") {
      const boostMenu = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ All Levels", callback_data: "boost_level_all" }],
            [{ text: "Level 1", callback_data: "boost_level_1" }, { text: "Level 2", callback_data: "boost_level_2" }],
            [{ text: "Level 3", callback_data: "boost_level_3" }, { text: "Level 4", callback_data: "boost_level_4" }],
            [{ text: "Top Boost", callback_data: "boost_level_top" }],
            [{ text: "← Back", callback_data: "back_menu" }],
          ],
        },
      };
      bot.editMessageText("Select boost level to track:", {
        chat_id: chatId,
        message_id: query.message!.message_id,
        ...boostMenu,
      });
      bot.answerCallbackQuery(query.id);
      return;
    } else if (data?.startsWith("boost_level_")) {
      const levelMap: Record<string, string> = {
        boost_level_all: "all",
        boost_level_1: "Level 1",
        boost_level_2: "Level 2",
        boost_level_3: "Level 3",
        boost_level_4: "Level 4",
        boost_level_top: "Top Boost",
      };
      const level = levelMap[data];
      if (level) {
        updateSettings(chatIdStr, { selectedBoostLevel: level });
        bot.editMessageText(getSettingsText(chatIdStr), {
          chat_id: chatId,
          message_id: query.message!.message_id,
          parse_mode: "Markdown",
          ...mainMenu,
        });
        bot.answerCallbackQuery(query.id, { text: `Level: ${formatBoostLevel(level)}` });
      }
      return;
    } else if (data === "back_menu") {
      bot.editMessageText(getSettingsText(chatIdStr), {
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
        slippage: "Enter Slippage % (e.g., 10):",
        tp: "Enter Take Profit % (e.g., 50):",
        sl: "Enter Stop Loss % (e.g., 25):",
        min_holders: "Enter Min Holders (0 = no filter):",
        min_liquidity: "Enter Min Liquidity in USD (0 = no filter, e.g., 5000):",
        min_mc: "Enter Min Market Cap in USD (0 = no filter, e.g., 10000):",
        max_mc: "Enter Max Market Cap in USD (0 = no filter, e.g., 1000000):",
      };

      const prompt = promptMap[field];
      if (prompt) {
        const sentMsg = await bot.sendMessage(chatId, prompt, { reply_markup: { force_reply: true } });
        bot.onReplyToMessage(chatId, sentMsg.message_id, async (reply) => {
          const val = parseFloat(reply.text || "0");
          if (!isNaN(val)) {
            const fieldMap: Record<string, keyof SubscriberSettings> = {
              buy: "buyAmount",
              slippage: "slippage",
              tp: "takeProfit",
              sl: "stopLoss",
              min_holders: "minHolders",
              min_liquidity: "minLiquidity",
              min_mc: "minMarketCap",
              max_mc: "maxMarketCap",
            };
            const key = fieldMap[field];
            if (key) {
              updateSettings(chatIdStr, { [key]: val } as Partial<SubscriberSettings>);
              bot.sendMessage(chatId, "✅ Updated!\n\n" + getSettingsText(chatIdStr), { parse_mode: "Markdown", ...mainMenu });
            }
          }
        });
        bot.answerCallbackQuery(query.id);
        return;
      }
    }

    if (Object.keys(patch).length > 0) {
      updateSettings(chatIdStr, patch);
      bot.editMessageText(getSettingsText(chatIdStr), {
        chat_id: chatId,
        message_id: query.message!.message_id,
        parse_mode: "Markdown",
        ...mainMenu,
      });
      bot.answerCallbackQuery(query.id, { text: answer });
    }
  } catch (e) {
    console.error("[Bot] callback error:", e);
    bot.answerCallbackQuery(query.id, { text: "❌ Error" });
  }
});

console.log("✅ Alertly Telegram Bot is running (standalone mode — no DB required).");
