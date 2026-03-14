import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { generateWallet, importWallet, getWalletBalance, decryptPrivateKey, pkBase58ToBase64 } from "./wallet.js";
import { buyToken, getQuote } from "./trade.js";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN");

const DATA_DIR = join(__dirname, "..", "data");
const SUBSCRIBERS_FILE = join(DATA_DIR, "subscribers.json");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(SUBSCRIBERS_FILE)) writeFileSync(SUBSCRIBERS_FILE, "{}", "utf-8");

type WalletData = { address: string; encryptedKey: string; createdAt: string };

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

const pendingBuys = new Map<string, { tokenAddress: string; solAmount: number; slippageBps: number }>();
const pendingImports = new Set<string>();

function loadStore(): SubscriberStore {
  try { return JSON.parse(readFileSync(SUBSCRIBERS_FILE, "utf-8")) as SubscriberStore; }
  catch { return {}; }
}

function saveStore(store: SubscriberStore): void {
  writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function getSubscriber(chatId: string): Subscriber | null {
  return loadStore()[chatId] ?? null;
}

function upsertSubscriber(chatId: string, firstName?: string): Subscriber {
  const store = loadStore();
  if (!store[chatId]) {
    store[chatId] = { chatId, firstName, subscribedAt: new Date().toISOString(), settings: { ...DEFAULT_SETTINGS } };
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
    store[chatId] = { chatId, subscribedAt: new Date().toISOString(), settings: { ...DEFAULT_SETTINGS } };
  }
  store[chatId].settings = { ...store[chatId].settings, ...patch };
  saveStore(store);
  return store[chatId].settings;
}

function saveWallet(chatId: string, walletData: WalletData): void {
  const store = loadStore();
  if (store[chatId]) { store[chatId].wallet = walletData; saveStore(store); }
}

function markOnboarded(chatId: string): void {
  const store = loadStore();
  if (store[chatId]) { store[chatId].onboarded = true; saveStore(store); }
}

function fmtMc(val: number): string {
  if (!val) return "No limit";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

function fmtBoostLevel(level: string): string {
  if (!level || level === "all") return "All Levels";
  return level;
}

async function buildSettingsText(chatId: string): Promise<string> {
  const sub = getSubscriber(chatId);
  const s = sub?.settings ?? DEFAULT_SETTINGS;
  const status = s.alertsEnabled ? "▶️ Active" : "⏸️ Paused";

  let walletLine = "❌ No wallet — tap 💼 My Wallet to set one up";
  if (sub?.wallet) {
    const bal = await getWalletBalance(sub.wallet.address).catch(() => 0);
    walletLine = `💼 ${sub.wallet.address.slice(0, 6)}...${sub.wallet.address.slice(-4)}  |  ${bal.toFixed(4)} SOL`;
  }

  return `⚙️ *Alertly Settings*

*Alerts:* ${status}

*Alert Monitors*
⚡ Dex Boost: ${s.dexBoostEnabled ? "✅" : "❌"}
   └ Level: ${fmtBoostLevel(s.selectedBoostLevel)}
🆕 Dex Listing: ${s.dexListingEnabled ? "✅" : "❌"}

*Filters*
📉 Min MC: ${fmtMc(s.minMarketCap)}
📈 Max MC: ${fmtMc(s.maxMarketCap)}
💧 Min Liquidity: ${s.minLiquidity > 0 ? `$${(s.minLiquidity / 1000).toFixed(0)}K` : "No limit"}
👥 Min Holders: ${s.minHolders > 0 ? String(s.minHolders) : "No filter"}

*Trading*
💰 Buy Amount: ${s.buyAmount} SOL
📊 Slippage: ${s.slippage}%
📈 Take Profit: +${s.takeProfit}%
🛑 Stop Loss: -${s.stopLoss}%

*Wallet*
${walletLine}

Stay sharp. Stay early. Stay Alertly. 🚀`;
}

function mainMenu(s?: SubscriberSettings) {
  const boostOn = s?.dexBoostEnabled !== false;
  const listOn = s?.dexListingEnabled !== false;
  const alertsOn = s?.alertsEnabled !== false;
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: alertsOn ? "⏸ Pause Alerts" : "▶️ Resume Alerts", callback_data: "toggle_alerts" }],
        [
          { text: `⚡ DEX Boost ${boostOn ? "✅" : "❌"}`, callback_data: "toggle_boost" },
          { text: `🆕 DEX Listing ${listOn ? "✅" : "❌"}`, callback_data: "toggle_list" },
        ],
        [{ text: "📦 Boost Level Filter", callback_data: "boost_levels" }],
        [{ text: "📉 Min MC", callback_data: "set_min_mc" }, { text: "📈 Max MC", callback_data: "set_max_mc" }],
        [{ text: "💧 Min Liquidity", callback_data: "set_min_liquidity" }, { text: "👥 Min Holders", callback_data: "set_min_holders" }],
        [{ text: "💰 Buy Amount", callback_data: "set_buy" }, { text: "📊 Slippage", callback_data: "set_slippage" }],
        [{ text: "📈 Take Profit", callback_data: "set_tp" }, { text: "🛑 Stop Loss", callback_data: "set_sl" }],
        [{ text: "💼 My Wallet", callback_data: "wallet_menu" }, { text: "📤 Export Key", callback_data: "export_key" }],
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

async function sendSettings(chatId: number, chatIdStr: string) {
  const text = await buildSettingsText(chatIdStr);
  const sub = getSubscriber(chatIdStr);
  return bot.sendMessage(chatId, text, { parse_mode: "Markdown", ...mainMenu(sub?.settings) });
}

async function editSettings(chatId: number, chatIdStr: string, messageId: number, headerMsg?: string) {
  const baseText = await buildSettingsText(chatIdStr);
  const text = headerMsg ? headerMsg + baseText : baseText;
  const sub = getSubscriber(chatIdStr);
  return bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", ...mainMenu(sub?.settings) });
}

async function renderOnboardStep1(chatId: number, msgId: number, s: SubscriberSettings) {
  return bot.editMessageText(
    "⚡ *What would you like to monitor?*\n\nTap a button to toggle it on or off. Both are enabled by default.\n\nYou can change these anytime in /settings.",
    {
      chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: `⚡ DEX Boost ${s.dexBoostEnabled ? "✅" : "❌"}`, callback_data: "ob1_boost" },
            { text: `🆕 DEX Listing ${s.dexListingEnabled ? "✅" : "❌"}`, callback_data: "ob1_list" },
          ],
          [{ text: "→ Next: Set Up Wallet", callback_data: "onboard_step2" }],
          [{ text: "✓ Done — Start Receiving Alerts", callback_data: "onboard_finish" }],
        ],
      },
    },
  );
}

async function showWalletPanel(chatId: number, chatIdStr: string, messageId?: number) {
  const sub = getSubscriber(chatIdStr);

  let text: string;
  let keyboard: any;

  if (!sub?.wallet) {
    text =
      "💼 *Wallet*\n\n" +
      "You don't have a wallet connected yet.\n\n" +
      "A wallet lets you buy tokens directly from alert messages using the *Quick Buy* button.\n\n" +
      "⚠️ Your private key is stored encrypted. Use a dedicated trading wallet with small amounts only.";
    keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✨ Create New Wallet", callback_data: "create_wallet" }],
          [{ text: "📥 Import Existing Wallet", callback_data: "import_wallet" }],
          [{ text: "← Back to Settings", callback_data: "back_menu" }],
        ],
      },
    };
  } else {
    const bal = await getWalletBalance(sub.wallet.address).catch(() => 0);
    const created = new Date(sub.wallet.createdAt).toLocaleDateString();
    text =
      "💼 *Your Wallet*\n\n" +
      `📍 *Address:*\n\`${sub.wallet.address}\`\n\n` +
      `💰 *Balance:* ${bal.toFixed(4)} SOL\n` +
      `📅 *Created:* ${created}\n\n` +
      "_Send SOL to the address above to fund your wallet._";
    keyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Refresh Balance", callback_data: "wallet_menu" }],
          [{ text: "📤 Export Private Key", callback_data: "export_key" }],
          [{ text: "🗑 Remove Wallet", callback_data: "remove_wallet" }],
          [{ text: "← Back to Settings", callback_data: "back_menu" }],
        ],
      },
    };
  }

  if (messageId) {
    return bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", ...keyboard });
  } else {
    return bot.sendMessage(chatId, text, { parse_mode: "Markdown", ...keyboard });
  }
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);
  const firstName = msg.from?.first_name;
  const existing = getSubscriber(chatIdStr);
  upsertSubscriber(chatIdStr, firstName);

  if (existing?.onboarded) {
    await sendSettings(chatId, chatIdStr);
    return;
  }

  await bot.sendMessage(
    chatId,
    `👋 *Welcome${firstName ? ` ${firstName}` : ""} to Alertly!*\n\n` +
    `Alertly monitors the Solana blockchain in real-time and sends you instant alerts:\n\n` +
    `⚡ *DEX Boost Alerts* — tokens being promoted on DexScreener\n` +
    `🆕 *DEX Listing Alerts* — brand new tokens getting listed\n\n` +
    `Each alert includes price, market cap, liquidity, social links, and a *Quick Buy* button to trade instantly.\n\n` +
    `Let's get you set up!`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Set Me Up", callback_data: "onboard_step1" }],
          [{ text: "⚙️ Go to Settings", callback_data: "onboard_skip" }],
        ],
      },
    },
  );
});

bot.onText(/\/stop/, async (msg) => {
  removeSubscriber(String(msg.chat.id));
  await bot.sendMessage(msg.chat.id, "✅ Unsubscribed from Alertly.\n\nSend /start to re-subscribe anytime.");
});

bot.onText(/\/settings/, async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);
  upsertSubscriber(chatIdStr, msg.from?.first_name);
  await sendSettings(chatId, chatIdStr);
});

bot.onText(/\/wallet/, async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);
  upsertSubscriber(chatIdStr, msg.from?.first_name);
  await showWalletPanel(chatId, chatIdStr);
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const store = loadStore();
  const count = Object.keys(store).length;
  const sub = store[String(chatId)];
  await bot.sendMessage(
    chatId,
    `📊 *Alertly Status*\n\nTotal subscribers: ${count}\nYour status: ${sub ? "✅ Subscribed" : "❌ Not subscribed"}` +
    (sub ? `\nSince: ${new Date(sub.subscribedAt).toLocaleDateString()}` : ""),
    { parse_mode: "Markdown" },
  );
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    `📖 *Alertly Bot — Commands*\n\n` +
    `*/start* — Welcome screen & quick setup\n` +
    `*/settings* — View & manage all your settings\n` +
    `*/wallet* — Manage your trading wallet\n` +
    `*/status* — Check your subscription status\n` +
    `*/stop* — Unsubscribe from alerts\n` +
    `*/help* — Show this message\n\n` +
    `*What Alertly monitors:*\n` +
    `⚡ *DEX Boost Alerts* — tokens being promoted on DexScreener\n` +
    `🆕 *DEX Listing Alerts* — new tokens getting their first DEX listing\n\n` +
    `Each alert includes price, market cap, liquidity, social links, and a *Quick Buy* button.\n\n` +
    `_Use /settings to configure filters, trading parameters, and your wallet._`,
    { parse_mode: "Markdown" },
  );
});

bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id;
  if (!chatId) return;
  const chatIdStr = String(chatId);
  const msgId = query.message!.message_id;
  const data = query.data;

  if (data === "none") { bot.answerCallbackQuery(query.id); return; }

  upsertSubscriber(chatIdStr, query.from?.first_name);

  try {
    if (data === "onboard_step1") {
      bot.answerCallbackQuery(query.id);
      const sub = getSubscriber(chatIdStr)!;
      await renderOnboardStep1(chatId, msgId, sub.settings);
      return;
    }

    if (data === "ob1_boost") {
      const s = getSubscriber(chatIdStr)!.settings;
      const newVal = !s.dexBoostEnabled;
      updateSettings(chatIdStr, { dexBoostEnabled: newVal });
      bot.answerCallbackQuery(query.id, { text: `DEX Boost ${newVal ? "ON ✅" : "OFF ❌"}` });
      await renderOnboardStep1(chatId, msgId, getSubscriber(chatIdStr)!.settings);
      return;
    }

    if (data === "ob1_list") {
      const s = getSubscriber(chatIdStr)!.settings;
      const newVal = !s.dexListingEnabled;
      updateSettings(chatIdStr, { dexListingEnabled: newVal });
      bot.answerCallbackQuery(query.id, { text: `DEX Listing ${newVal ? "ON ✅" : "OFF ❌"}` });
      await renderOnboardStep1(chatId, msgId, getSubscriber(chatIdStr)!.settings);
      return;
    }

    if (data === "onboard_step2") {
      bot.answerCallbackQuery(query.id);
      await bot.editMessageText(
        "💼 *Set Up Your Trading Wallet*\n\n" +
        "With a wallet you can buy tokens instantly from any alert using the *Quick Buy* button.\n\n" +
        "Want to create a free Solana wallet now?",
        {
          chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "✨ Yes, Create My Wallet", callback_data: "create_wallet_onboard" }],
              [{ text: "📥 Import Existing Wallet", callback_data: "import_wallet_onboard" }],
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
      await editSettings(chatId, chatIdStr, msgId);
      return;
    }

    if (data === "onboard_finish") {
      markOnboarded(chatIdStr);
      bot.answerCallbackQuery(query.id, { text: "✅ You're all set!" });
      await editSettings(chatId, chatIdStr, msgId, "🎉 *Setup complete!* Alerts are now active.\n\n");
      return;
    }

    if (data === "create_wallet" || data === "create_wallet_onboard") {
      const { address, encryptedKey, privateKeyB58 } = generateWallet(chatIdStr);
      const privateKeyB64 = pkBase58ToBase64(privateKeyB58);
      saveWallet(chatIdStr, { address, encryptedKey, createdAt: new Date().toISOString() });
      if (data === "create_wallet_onboard") markOnboarded(chatIdStr);
      bot.answerCallbackQuery(query.id, { text: "Wallet created!" });
      await bot.editMessageText(
        "✅ *Wallet Created!*\n\n" +
        `📍 *Address:*\n\`${address}\`\n\n` +
        `🔑 *Private Key — save this now, shown only once!*\n\n` +
        `*Base58* _(Phantom / Solflare)_\n\`${privateKeyB58}\`\n\n` +
        `*Base64* _(Alertly website import)_\n\`${privateKeyB64}\`\n\n` +
        "⚠️ *Store this securely — anyone with this key controls your wallet.*\n\n" +
        "Fund your wallet by sending SOL to the address above.",
        {
          chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              data === "create_wallet_onboard"
                ? { text: "✓ Done", callback_data: "onboard_finish" }
                : { text: "← Back to Settings", callback_data: "back_menu" },
            ]],
          },
        },
      );
      return;
    }

    if (data === "import_wallet" || data === "import_wallet_onboard") {
      pendingImports.add(chatIdStr);
      if (data === "import_wallet_onboard") pendingImports.add(chatIdStr + "_onboard");
      bot.answerCallbackQuery(query.id);
      await bot.sendMessage(
        chatId,
        "📥 *Import Wallet*\n\nSend your private key in any of these formats:\n\n" +
        "• *Base58* — Phantom, Solflare export\n" +
        "• *Base64* — Alertly website export\n" +
        "• *JSON array* — \\[1,2,...,64\\]\n\n" +
        "⚠️ Make sure you're in a private chat. Your key will be stored encrypted on this device only.",
        { parse_mode: "Markdown", reply_markup: { force_reply: true } },
      );
      return;
    }

    if (data === "export_key") {
      const sub = getSubscriber(chatIdStr);
      if (!sub?.wallet) { bot.answerCallbackQuery(query.id, { text: "No wallet found" }); return; }
      try {
        const pkB58 = decryptPrivateKey(sub.wallet.encryptedKey, chatIdStr);
        const pkB64 = pkBase58ToBase64(pkB58);
        bot.answerCallbackQuery(query.id);
        await bot.sendMessage(
          chatId,
          `🔑 *Private Key — ${sub.wallet.address.slice(0, 6)}...${sub.wallet.address.slice(-4)}*\n\n` +
          `*Base58* _(Phantom / Solflare / Telegram)_\n\`${pkB58}\`\n\n` +
          `*Base64* _(Alertly website import)_\n\`${pkB64}\`\n\n` +
          `⚠️ *Delete this message immediately after copying!*\nAnyone with this key has full access to your wallet.`,
          { parse_mode: "Markdown" },
        );
      } catch {
        bot.answerCallbackQuery(query.id, { text: "Failed to decrypt key" });
      }
      return;
    }

    if (data === "remove_wallet") {
      const store = loadStore();
      if (store[chatIdStr]) { delete store[chatIdStr].wallet; saveStore(store); }
      bot.answerCallbackQuery(query.id, { text: "Wallet removed" });
      await bot.editMessageText(
        "✅ *Wallet removed.*\n\nYou can create or import a new one anytime via /wallet.",
        {
          chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "← Back to Settings", callback_data: "back_menu" }]] },
        },
      );
      return;
    }

    if (data === "wallet_menu") {
      bot.answerCallbackQuery(query.id);
      await showWalletPanel(chatId, chatIdStr, msgId);
      return;
    }

    if (data === "back_menu") {
      bot.answerCallbackQuery(query.id);
      await editSettings(chatId, chatIdStr, msgId);
      return;
    }

    if (data?.startsWith("buy_")) {
      const tokenAddress = data.slice(4);
      const sub = getSubscriber(chatIdStr);
      if (!sub?.wallet) {
        bot.answerCallbackQuery(query.id, { text: "No wallet — set one up first!", show_alert: true });
        await bot.sendMessage(chatId, "💼 *No wallet connected*\n\nUse /wallet to create or import one.", {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "💼 Set Up Wallet", callback_data: "wallet_menu" }]] },
        });
        return;
      }
      const solAmount = sub.settings.buyAmount || 0.5;
      const slippageBps = Math.round((sub.settings.slippage || 10) * 100);
      const bal = await getWalletBalance(sub.wallet.address).catch(() => 0);
      if (bal < solAmount) {
        bot.answerCallbackQuery(query.id, { text: `Insufficient balance: ${bal.toFixed(4)} SOL`, show_alert: true });
        return;
      }
      const quote = await getQuote(tokenAddress, solAmount, slippageBps);
      const impact = quote ? ` (~${Number(quote.priceImpactPct).toFixed(2)}% price impact)` : "";
      pendingBuys.set(chatIdStr, { tokenAddress, solAmount, slippageBps });
      bot.answerCallbackQuery(query.id);
      await bot.sendMessage(chatId,
        `💰 *Confirm Buy*\n\n` +
        `Amount: *${solAmount} SOL*${impact}\n` +
        `Token: \`${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-4)}\`\n` +
        `Slippage: ${sub.settings.slippage}%\n` +
        `Balance: ${bal.toFixed(4)} SOL`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Confirm", callback_data: `cbuy_${tokenAddress}` },
              { text: "❌ Cancel", callback_data: "cancel_buy" },
            ]],
          },
        },
      );
      return;
    }

    if (data?.startsWith("cbuy_")) {
      const tokenAddress = data.slice(5);
      const pending = pendingBuys.get(chatIdStr);
      if (!pending || pending.tokenAddress !== tokenAddress) {
        bot.answerCallbackQuery(query.id, { text: "Trade expired — try again from the alert." });
        return;
      }
      pendingBuys.delete(chatIdStr);
      const sub = getSubscriber(chatIdStr);
      if (!sub?.wallet) { bot.answerCallbackQuery(query.id, { text: "No wallet" }); return; }
      bot.answerCallbackQuery(query.id, { text: "Executing trade..." });
      await bot.editMessageText(`⏳ *Buying ${pending.solAmount} SOL...*\n\nPlease wait.`, {
        chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
      });
      let pk: string;
      try { pk = decryptPrivateKey(sub.wallet.encryptedKey, chatIdStr); }
      catch {
        await bot.editMessageText("❌ Failed to decrypt wallet key.", { chat_id: chatId, message_id: msgId });
        return;
      }
      const result = await buyToken(pk, tokenAddress, pending.solAmount, pending.slippageBps);
      if (result.success) {
        await bot.editMessageText(
          `✅ *Trade Successful!*\n\nBought *${pending.solAmount} SOL* worth of\n\`${tokenAddress}\`\n\n[View Transaction](${result.explorerUrl})`,
          { chat_id: chatId, message_id: msgId, parse_mode: "Markdown", disable_web_page_preview: true },
        );
      } else {
        const failReason = "error" in result ? (result as { success: false; error: string }).error : "Trade failed";
        await bot.editMessageText(`❌ *Trade Failed*\n\n${failReason}`, { chat_id: chatId, message_id: msgId, parse_mode: "Markdown" });
      }
      return;
    }

    if (data === "cancel_buy") {
      pendingBuys.delete(chatIdStr);
      bot.answerCallbackQuery(query.id, { text: "Cancelled" });
      await bot.editMessageText("❌ Trade cancelled.", { chat_id: chatId, message_id: msgId });
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
      bot.answerCallbackQuery(query.id);
      const s = getSubscriber(chatIdStr)?.settings ?? DEFAULT_SETTINGS;
      const cur = s.selectedBoostLevel || "all";
      const sel = (level: string) => cur === level ? "✅ " : "";
      await bot.editMessageText(
        `📦 *Boost Level Filter*\n\nOnly receive alerts for boosts at or above a minimum level.\nCurrently set to: *${fmtBoostLevel(cur)}*`,
        {
          chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: `${sel("all")}All Levels`, callback_data: "boost_level_all" }],
              [
                { text: `${sel("Level 1")}⚡ Level 1 (1–10)`, callback_data: "boost_level_1" },
                { text: `${sel("Level 2")}⚡⚡ Level 2 (11–50)`, callback_data: "boost_level_2" },
              ],
              [
                { text: `${sel("Level 3")}⚡⚡⚡ Level 3 (51–200)`, callback_data: "boost_level_3" },
                { text: `${sel("Level 4")}⚡⚡⚡⚡ Level 4 (201–500)`, callback_data: "boost_level_4" },
              ],
              [{ text: `${sel("Level 5")}⚡⚡⚡⚡⚡ Level 5 (500+)`, callback_data: "boost_level_top" }],
              [{ text: "← Back to Settings", callback_data: "back_menu" }],
            ],
          },
        },
      );
      return;
    } else if (data?.startsWith("boost_level_")) {
      const map: Record<string, string> = {
        boost_level_all: "all", boost_level_1: "Level 1", boost_level_2: "Level 2",
        boost_level_3: "Level 3", boost_level_4: "Level 4", boost_level_top: "Level 5",
      };
      const level = map[data];
      if (level) {
        updateSettings(chatIdStr, { selectedBoostLevel: level });
        await editSettings(chatId, chatIdStr, msgId);
        bot.answerCallbackQuery(query.id, { text: `Level: ${fmtBoostLevel(level)}` });
      }
      return;
    } else if (data?.startsWith("set_")) {
      const field = data.replace("set_", "");
      const s = getSubscriber(chatIdStr)?.settings ?? DEFAULT_SETTINGS;
      const prompts: Record<string, { label: string; example: string; unit: string; key: keyof SubscriberSettings }> = {
        buy:          { label: "Buy Amount",      example: "e.g. 0.5",          unit: "SOL",     key: "buyAmount" },
        slippage:     { label: "Slippage",        example: "e.g. 10",           unit: "%",       key: "slippage" },
        tp:           { label: "Take Profit",     example: "e.g. 50",           unit: "%",       key: "takeProfit" },
        sl:           { label: "Stop Loss",       example: "e.g. 25",           unit: "%",       key: "stopLoss" },
        min_holders:  { label: "Min Holders",     example: "0 = no filter",     unit: "holders", key: "minHolders" },
        min_liquidity:{ label: "Min Liquidity",   example: "0 = no filter",     unit: "USD",     key: "minLiquidity" },
        min_mc:       { label: "Min Market Cap",  example: "0 = no filter",     unit: "USD",     key: "minMarketCap" },
        max_mc:       { label: "Max Market Cap",  example: "0 = no limit",      unit: "USD",     key: "maxMarketCap" },
      };
      const pDef = prompts[field];
      if (pDef) {
        const currentVal = s[pDef.key] ?? 0;
        const promptText =
          `✏️ *Set ${pDef.label}*\n\n` +
          `Current value: *${currentVal} ${pDef.unit}*\n\n` +
          `Reply with a number (${pDef.example}):\n` +
          `_Send 0 to remove the filter_`;
        const sentMsg = await bot.sendMessage(chatId, promptText, {
          parse_mode: "Markdown",
          reply_markup: { force_reply: true },
        });
        bot.onReplyToMessage(chatId, sentMsg.message_id, async (reply) => {
          const val = parseFloat(reply.text || "0");
          if (!isNaN(val)) {
            updateSettings(chatIdStr, { [pDef.key]: val } as Partial<SubscriberSettings>);
            await sendSettings(chatId, chatIdStr);
          }
        });
        bot.answerCallbackQuery(query.id);
        return;
      }
    }

    if (Object.keys(patch).length > 0) {
      updateSettings(chatIdStr, patch);
      await editSettings(chatId, chatIdStr, msgId);
      bot.answerCallbackQuery(query.id, { text: answer });
    }

  } catch (e: any) {
    console.error("[Bot] callback error:", e?.message || e);
    bot.answerCallbackQuery(query.id, { text: "Error — please try again" }).catch(() => null);
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const chatIdStr = String(chatId);
  if (!msg.text || msg.text.startsWith("/")) return;
  if (!pendingImports.has(chatIdStr)) return;

  const isOnboard = pendingImports.has(chatIdStr + "_onboard");
  pendingImports.delete(chatIdStr);
  pendingImports.delete(chatIdStr + "_onboard");

  const result = importWallet(msg.text.trim(), chatIdStr);
  if (!result) {
    await bot.sendMessage(
      chatId,
      "❌ *Invalid private key.*\n\nSupported formats:\n• Base58 (Phantom/Solflare)\n• Base64\n• JSON array\n\nUse /wallet to try again.",
      { parse_mode: "Markdown" },
    );
    return;
  }

  saveWallet(chatIdStr, { address: result.address, encryptedKey: result.encryptedKey, createdAt: new Date().toISOString() });
  if (isOnboard) markOnboarded(chatIdStr);

  await bot.sendMessage(
    chatId,
    `✅ *Wallet Imported!*\n\n📍 *Address:*\n\`${result.address}\`\n\nFund your wallet by sending SOL to this address.`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "⚙️ Open Settings", callback_data: "back_menu" }]] } },
  );
});

console.log("✅ Alertly Telegram Bot is running with wallet & trading support.");
