import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { generateWallet, importWallet, getWalletBalance, decryptPrivateKey, shortAddr } from "./wallet.js";
import { buyToken, getQuote } from "./trade.js";

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

type WalletData = {
  address: string;
  encryptedKey: string;
  createdAt: string;
};

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
  wallet?: WalletData;
  onboarded?: boolean;
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

const pendingBuys = new Map<string, { tokenAddress: string; tokenName: string; solAmount: number; slippageBps: number }>();
const pendingImports = new Set<string>();

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

function saveWallet(chatId: string, walletData: WalletData): void {
  const store = loadStore();
  if (store[chatId]) {
    store[chatId].wallet = walletData;
    saveStore(store);
  }
}

function markOnboarded(chatId: string): void {
  const store = loadStore();
  if (store[chatId]) {
    store[chatId].onboarded = true;
    saveStore(store);
  }
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

async function getSettingsText(chatId: string): Promise<string> {
  const sub = getSubscriber(chatId);
  const s = sub?.settings ?? DEFAULT_SETTINGS;

  const alertsStatus = s.alertsEnabled ? "▶️ Active" : "⏸️ Paused";

  let walletSection = "*Wallet*\n❌ No wallet connected — tap 💼 My Wallet to create one";
  if (sub?.wallet) {
    const balance = await getWalletBalance(sub.wallet.address).catch(() => 0);
    walletSection = `*Wallet*\n💼 Address: \`${sub.wallet.address}\`\n💰 Balance: ${balance.toFixed(4)} SOL`;
  }

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

${walletSection}

Stay sharp. Stay early. Stay Alertly. 🚀`;
}

function getMainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔔 Pause / Resume Alerts", callback_data: "toggle_alerts" }],
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
        [
          { text: "💼 My Wallet", callback_data: "wallet_menu" },
          { text: "📤 Export Key", callback_data: "export_key" },
        ],
      ],
    },
  };
}

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

  const existing = getSubscriber(chatIdStr);
  upsertSubscriber(chatIdStr, firstName);

  if (existing?.onboarded) {
    const settingsText = await getSettingsText(chatIdStr);
    await bot.sendMessage(
      chatId,
      `👋 *Welcome back${firstName ? ` ${firstName}` : ""}!*\n\nHere's your current setup:\n\n${settingsText}`,
      { parse_mode: "Markdown", ...getMainMenu() },
    );
    return;
  }

  await bot.sendMessage(
    chatId,
    `👋 *Welcome${firstName ? ` ${firstName}` : ""} to Alertly!*\n\n` +
    `Alertly monitors the Solana blockchain and sends you real\\-time alerts for:\n\n` +
    `⚡ *DEX Boost Alerts* — when tokens are boosted on DexScreener\n` +
    `🆕 *DEX Listing Alerts* — new Solana tokens getting listed\n\n` +
    `You'll get instant Telegram messages with price, market cap, liquidity, social links, and a *Quick Buy* button to trade directly from here\\.\n\n` +
    `Let's get you set up in 30 seconds 🚀`,
    {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Set Me Up", callback_data: "onboard_step1" }],
          [{ text: "⚙️ Skip to Settings", callback_data: "onboard_skip" }],
        ],
      },
    },
  );
});

bot.onText(/\/stop/, async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);
  removeSubscriber(chatIdStr);
  await bot.sendMessage(chatId, "✅ You have been unsubscribed from Alertly.\n\nSend /start to re-subscribe anytime.");
});

bot.onText(/\/settings/, async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);
  upsertSubscriber(chatIdStr, msg.from?.first_name);
  const text = await getSettingsText(chatIdStr);
  bot.sendMessage(chatId, text, { parse_mode: "Markdown", ...getMainMenu() });
});

bot.onText(/\/wallet/, async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);
  upsertSubscriber(chatIdStr, msg.from?.first_name);
  await showWalletMenu(chatId, chatIdStr);
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

async function showWalletMenu(chatId: number, chatIdStr: string) {
  const sub = getSubscriber(chatIdStr);

  if (!sub?.wallet) {
    await bot.sendMessage(
      chatId,
      `💼 *Wallet*\n\nYou don't have a wallet connected yet\\.\n\nA wallet lets you trade directly from alert messages using the *Quick Buy* button\\.\n\n⚠️ *Note:* Your private key is stored encrypted on our server\\. Only use a dedicated trading wallet with small amounts\\!`,
      {
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✨ Create New Wallet", callback_data: "create_wallet" }],
            [{ text: "📥 Import Existing Wallet", callback_data: "import_wallet" }],
            [{ text: "← Back to Settings", callback_data: "back_menu" }],
          ],
        },
      },
    );
    return;
  }

  const balance = await getWalletBalance(sub.wallet.address).catch(() => 0);
  const createdDate = new Date(sub.wallet.createdAt).toLocaleDateString();

  await bot.sendMessage(
    chatId,
    `💼 *Your Wallet*\n\n` +
    `📍 *Address:*\n\`${sub.wallet.address}\`\n\n` +
    `💰 *Balance:* ${balance.toFixed(4)} SOL\n` +
    `📅 *Created:* ${createdDate}\n\n` +
    `_To fund your wallet, send SOL to the address above\\._`,
    {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Refresh Balance", callback_data: "wallet_menu" }],
          [{ text: "📤 Export Private Key", callback_data: "export_key" }],
          [{ text: "🗑 Remove Wallet", callback_data: "remove_wallet" }],
          [{ text: "← Back to Settings", callback_data: "back_menu" }],
        ],
      },
    },
  );
}

bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id;
  if (!chatId) return;
  const chatIdStr = String(chatId);
  const data = query.data;

  if (data === "none") { bot.answerCallbackQuery(query.id); return; }

  upsertSubscriber(chatIdStr, query.from?.first_name);

  try {
    if (data === "onboard_step1") {
      bot.answerCallbackQuery(query.id);
      await bot.editMessageText(
        `⚡ *What would you like to monitor?*\n\nChoose which alert types to enable\\. You can change these anytime in /settings\\.`,
        {
          chat_id: chatId,
          message_id: query.message!.message_id,
          parse_mode: "MarkdownV2",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "⚡ DEX Boosts ✅", callback_data: "ob_toggle_boost" },
                { text: "🆕 DEX Listings ✅", callback_data: "ob_toggle_listing" },
              ],
              [{ text: "→ Continue: Set Up Wallet", callback_data: "onboard_step2" }],
              [{ text: "✓ Done — Start Receiving Alerts", callback_data: "onboard_finish" }],
            ],
          },
        },
      );
      return;
    }

    if (data === "onboard_step2" || data === "onboard_wallet") {
      bot.answerCallbackQuery(query.id);
      await bot.editMessageText(
        `💼 *Set Up Your Trading Wallet*\n\nWith a wallet you can buy tokens instantly from alert messages using the *Quick Buy* button\\.\n\nWant to create a free Solana wallet now?`,
        {
          chat_id: chatId,
          message_id: query.message!.message_id,
          parse_mode: "MarkdownV2",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✨ Yes, Create My Wallet", callback_data: "create_wallet_onboard" }],
              [{ text: "⏭ Skip for Now", callback_data: "onboard_finish" }],
            ],
          },
        },
      );
      return;
    }

    if (data === "onboard_skip") {
      markOnboarded(chatIdStr);
      bot.answerCallbackQuery(query.id);
      const text = await getSettingsText(chatIdStr);
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: query.message!.message_id,
        parse_mode: "Markdown",
        ...getMainMenu(),
      });
      return;
    }

    if (data === "onboard_finish") {
      markOnboarded(chatIdStr);
      bot.answerCallbackQuery(query.id, { text: "✅ You're all set!" });
      await bot.editMessageText(
        `✅ *You're all set!*\n\n` +
        `Alerts are now active\\. You'll receive messages as new tokens are boosted or listed on Solana\\.\\.\n\n` +
        `💡 *Tip:* Use /settings anytime to customize filters, trading amounts, and manage your wallet\\.`,
        {
          chat_id: chatId,
          message_id: query.message!.message_id,
          parse_mode: "MarkdownV2",
          reply_markup: {
            inline_keyboard: [[{ text: "⚙️ Open Settings", callback_data: "back_menu" }]],
          },
        },
      );
      return;
    }

    if (data === "create_wallet" || data === "create_wallet_onboard") {
      const { address, encryptedKey, privateKeyB58 } = generateWallet(chatIdStr);
      saveWallet(chatIdStr, { address, encryptedKey, createdAt: new Date().toISOString() });

      if (data === "create_wallet_onboard") markOnboarded(chatIdStr);

      bot.answerCallbackQuery(query.id, { text: "✅ Wallet created!" });
      await bot.editMessageText(
        `✅ *Wallet Created!*\n\n` +
        `📍 *Address:*\n\`${address}\`\n\n` +
        `⚠️ *Your private key \\(save this safely\\!\\)*\n\`${privateKeyB58}\`\n\n` +
        `🚨 *IMPORTANT:* This is the only time your private key is shown\\. Copy and store it securely\\. Fund your wallet by sending SOL to the address above\\.`,
        {
          chat_id: chatId,
          message_id: query.message!.message_id,
          parse_mode: "MarkdownV2",
          reply_markup: {
            inline_keyboard: [
              data === "create_wallet_onboard"
                ? [{ text: "✓ Done — Start Receiving Alerts", callback_data: "onboard_finish_done" }]
                : [{ text: "← Back to Settings", callback_data: "back_menu" }],
            ],
          },
        },
      );
      return;
    }

    if (data === "onboard_finish_done") {
      bot.answerCallbackQuery(query.id, { text: "✅ You're all set!" });
      await bot.editMessageText(
        `🚀 *You're fully set up!*\n\nYou'll now receive real\\-time alerts\\. When you see one you like, tap *💰 Quick Buy* to trade instantly\\.\n\nUse /settings to adjust anything at any time\\.`,
        {
          chat_id: chatId,
          message_id: query.message!.message_id,
          parse_mode: "MarkdownV2",
        },
      );
      return;
    }

    if (data === "import_wallet") {
      pendingImports.add(chatIdStr);
      bot.answerCallbackQuery(query.id);
      await bot.sendMessage(
        chatId,
        "📥 *Import Wallet*\n\nSend me your private key (base58 format).\n\n⚠️ Make sure you're in a private chat. Your key will be stored encrypted.",
        { parse_mode: "Markdown", reply_markup: { force_reply: true } },
      );
      return;
    }

    if (data === "export_key") {
      const sub = getSubscriber(chatIdStr);
      if (!sub?.wallet) {
        bot.answerCallbackQuery(query.id, { text: "No wallet found" });
        return;
      }
      try {
        const privateKey = decryptPrivateKey(sub.wallet.encryptedKey, chatIdStr);
        bot.answerCallbackQuery(query.id);
        await bot.sendMessage(
          chatId,
          `🔑 *Private Key*\n\n\`${privateKey}\`\n\n⚠️ *Delete this message after copying\\!* Anyone with this key controls your wallet\\.`,
          { parse_mode: "MarkdownV2" },
        );
      } catch {
        bot.answerCallbackQuery(query.id, { text: "❌ Failed to decrypt key" });
      }
      return;
    }

    if (data === "remove_wallet") {
      const store = loadStore();
      if (store[chatIdStr]) {
        delete store[chatIdStr].wallet;
        saveStore(store);
      }
      bot.answerCallbackQuery(query.id, { text: "✅ Wallet removed" });
      await bot.editMessageText(
        "✅ *Wallet removed.*\n\nYour wallet has been disconnected. You can always create or import a new one via /wallet.",
        {
          chat_id: chatId,
          message_id: query.message!.message_id,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "← Back to Settings", callback_data: "back_menu" }]],
          },
        },
      );
      return;
    }

    if (data === "wallet_menu") {
      bot.answerCallbackQuery(query.id);
      await bot.editMessageText(
        "Loading wallet info...",
        { chat_id: chatId, message_id: query.message!.message_id },
      );
      await showWalletMenu(chatId, chatIdStr);
      return;
    }

    if (data?.startsWith("buy_")) {
      const tokenAddress = data.slice(4);
      const sub = getSubscriber(chatIdStr);
      if (!sub?.wallet) {
        bot.answerCallbackQuery(query.id, { text: "⚠️ No wallet — set one up first!", show_alert: true });
        await bot.sendMessage(
          chatId,
          `💼 *No wallet connected*\n\nYou need a wallet to use Quick Buy\\. Create one in /wallet or /settings\\.`,
          {
            parse_mode: "MarkdownV2",
            reply_markup: {
              inline_keyboard: [[{ text: "💼 Set Up Wallet", callback_data: "wallet_menu" }]],
            },
          },
        );
        return;
      }

      const solAmount = sub.settings.buyAmount || 0.5;
      const slippageBps = Math.round((sub.settings.slippage || 10) * 100);
      const balance = await getWalletBalance(sub.wallet.address).catch(() => 0);

      if (balance < solAmount) {
        bot.answerCallbackQuery(query.id, { text: `Insufficient balance: ${balance.toFixed(4)} SOL`, show_alert: true });
        return;
      }

      const quote = await getQuote(tokenAddress, solAmount, slippageBps);
      const priceImpact = quote ? `~${Number(quote.priceImpactPct).toFixed(2)}% price impact` : "";

      pendingBuys.set(chatIdStr, { tokenAddress, tokenName: tokenAddress.slice(0, 8) + "...", solAmount, slippageBps });

      bot.answerCallbackQuery(query.id);
      await bot.sendMessage(
        chatId,
        `💰 *Confirm Trade*\n\n` +
        `Buying *${solAmount} SOL* worth of\n\`${tokenAddress}\`\n\n` +
        `📊 Slippage: ${sub.settings.slippage}%\n` +
        (priceImpact ? `⚠️ ${priceImpact}\n` : "") +
        `\nYour balance: ${balance.toFixed(4)} SOL`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Confirm Buy", callback_data: `cbuy_${tokenAddress}` },
                { text: "❌ Cancel", callback_data: "cancel_buy" },
              ],
            ],
          },
        },
      );
      return;
    }

    if (data?.startsWith("cbuy_")) {
      const tokenAddress = data.slice(5);
      const pending = pendingBuys.get(chatIdStr);
      if (!pending || pending.tokenAddress !== tokenAddress) {
        bot.answerCallbackQuery(query.id, { text: "Trade expired. Please try again from the alert." });
        return;
      }
      pendingBuys.delete(chatIdStr);

      const sub = getSubscriber(chatIdStr);
      if (!sub?.wallet) {
        bot.answerCallbackQuery(query.id, { text: "No wallet found" });
        return;
      }

      bot.answerCallbackQuery(query.id, { text: "⏳ Executing trade..." });
      await bot.editMessageText(
        `⏳ *Buying ${pending.solAmount} SOL of \`${tokenAddress.slice(0, 8)}...\`*\n\nPlease wait...`,
        { chat_id: chatId, message_id: query.message!.message_id, parse_mode: "Markdown" },
      );

      let privateKey: string;
      try {
        privateKey = decryptPrivateKey(sub.wallet.encryptedKey, chatIdStr);
      } catch {
        await bot.editMessageText("❌ Failed to decrypt wallet key. Please re-import your wallet.", {
          chat_id: chatId, message_id: query.message!.message_id,
        });
        return;
      }

      const result = await buyToken(privateKey, tokenAddress, pending.solAmount, pending.slippageBps);

      if (result.success) {
        await bot.editMessageText(
          `✅ *Trade Successful!*\n\n` +
          `Bought *${pending.solAmount} SOL* worth of\n\`${tokenAddress}\`\n\n` +
          `[🔍 View Transaction](${result.explorerUrl})`,
          {
            chat_id: chatId,
            message_id: query.message!.message_id,
            parse_mode: "Markdown",
            disable_web_page_preview: true,
          },
        );
      } else {
        await bot.editMessageText(
          `❌ *Trade Failed*\n\n${result.error}`,
          { chat_id: chatId, message_id: query.message!.message_id, parse_mode: "Markdown" },
        );
      }
      return;
    }

    if (data === "cancel_buy") {
      pendingBuys.delete(chatIdStr);
      bot.answerCallbackQuery(query.id, { text: "Cancelled" });
      await bot.editMessageText("❌ Trade cancelled.", { chat_id: chatId, message_id: query.message!.message_id });
      return;
    }

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
            [{ text: "Level 1 (≤10)", callback_data: "boost_level_1" }, { text: "Level 2 (≤50)", callback_data: "boost_level_2" }],
            [{ text: "Level 3 (≤200)", callback_data: "boost_level_3" }, { text: "Level 4 (≤500)", callback_data: "boost_level_4" }],
            [{ text: "Level 5 (500+)", callback_data: "boost_level_top" }],
            [{ text: "← Back", callback_data: "back_menu" }],
          ],
        },
      };
      bot.editMessageText("Select minimum boost level to track:", {
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
        boost_level_top: "Level 5",
      };
      const level = levelMap[data];
      if (level) {
        updateSettings(chatIdStr, { selectedBoostLevel: level });
        const text = await getSettingsText(chatIdStr);
        bot.editMessageText(text, {
          chat_id: chatId,
          message_id: query.message!.message_id,
          parse_mode: "Markdown",
          ...getMainMenu(),
        });
        bot.answerCallbackQuery(query.id, { text: `Level: ${formatBoostLevel(level)}` });
      }
      return;
    } else if (data === "back_menu") {
      const text = await getSettingsText(chatIdStr);
      bot.editMessageText(text, {
        chat_id: chatId,
        message_id: query.message!.message_id,
        parse_mode: "Markdown",
        ...getMainMenu(),
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
              const text = await getSettingsText(chatIdStr);
              bot.sendMessage(chatId, "✅ Updated!\n\n" + text, { parse_mode: "Markdown", ...getMainMenu() });
            }
          }
        });
        bot.answerCallbackQuery(query.id);
        return;
      }
    }

    if (Object.keys(patch).length > 0) {
      updateSettings(chatIdStr, patch);
      const text = await getSettingsText(chatIdStr);
      bot.editMessageText(text, {
        chat_id: chatId,
        message_id: query.message!.message_id,
        parse_mode: "Markdown",
        ...getMainMenu(),
      });
      bot.answerCallbackQuery(query.id, { text: answer });
    }
  } catch (e) {
    console.error("[Bot] callback error:", e);
    bot.answerCallbackQuery(query.id, { text: "❌ Error" });
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);

  if (!msg.text || msg.text.startsWith("/")) return;
  if (!pendingImports.has(chatIdStr)) return;

  pendingImports.delete(chatIdStr);
  const privateKeyInput = msg.text.trim();

  const result = importWallet(privateKeyInput, chatIdStr);
  if (!result) {
    await bot.sendMessage(chatId, "❌ Invalid private key. Please check the format and try again.\n\nUse /wallet to try again.");
    return;
  }

  saveWallet(chatIdStr, { address: result.address, encryptedKey: result.encryptedKey, createdAt: new Date().toISOString() });
  await bot.sendMessage(
    chatId,
    `✅ *Wallet imported successfully!*\n\n📍 Address:\n\`${result.address}\`\n\n_Fund your wallet by sending SOL to this address\\._`,
    { parse_mode: "MarkdownV2" },
  );
});

console.log("✅ Alertly Telegram Bot is running with wallet & trading support.");
