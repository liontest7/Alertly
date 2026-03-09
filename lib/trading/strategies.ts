import { TokenAlert, executeTrade } from "../blockchain/solana";

export interface AutoTradeConfig {
  userId: string;
  enabled: boolean;
  buyAmount: number;
  maxBuyPerToken: number;
  maxSlippage: number;
  takeProfit: number;
  stopLoss: number;
  trailingStop: boolean;
  minMarketCap?: number;
  maxMarketCap?: number;
  minLiquidity?: number;
  minHolders?: number;
  volumeSpikeEnabled?: boolean;
  whaleAlertEnabled?: boolean;
  dexBoostEnabled?: boolean;
  dexListingEnabled?: boolean;
}

function parseMoney(value: string): number | null {
  const normalized = value.replace(/[$,\s]/g, "").toUpperCase();
  const raw = parseFloat(normalized);
  if (!Number.isFinite(raw)) return null;

  if (normalized.endsWith("K")) return raw * 1_000;
  if (normalized.endsWith("M")) return raw * 1_000_000;
  if (normalized.endsWith("B")) return raw * 1_000_000_000;
  return raw;
}

function isTypeEnabled(alertType: TokenAlert["type"], config: AutoTradeConfig): boolean {
  if (alertType === "VOL_SPIKE" && config.volumeSpikeEnabled === false) return false;
  if (alertType === "DEX_BOOST" && config.dexBoostEnabled === false) return false;
  if (alertType === "NEW_LISTING" && config.dexListingEnabled === false) return false;
  if (alertType === "LIQ_ADD" && config.whaleAlertEnabled === false) return false;
  return true;
}

export async function shouldAutoTrade(alert: TokenAlert, config: AutoTradeConfig): Promise<boolean> {
  if (!config.enabled || !config.userId) return false;
  if (!isTypeEnabled(alert.type, config)) return false;

  const marketCap = parseMoney(alert.mc);
  const liquidity = parseMoney(alert.liquidity);

  if (typeof config.minMarketCap === "number" && marketCap !== null && marketCap < config.minMarketCap) {
    return false;
  }

  if (typeof config.maxMarketCap === "number" && marketCap !== null && marketCap > config.maxMarketCap) {
    return false;
  }

  if (typeof config.minLiquidity === "number" && liquidity !== null && liquidity < config.minLiquidity) {
    return false;
  }

  if (typeof config.minHolders === "number" && alert.holders > 0 && alert.holders < config.minHolders) {
    return false;
  }

  if (config.buyAmount <= 0 || config.buyAmount > config.maxBuyPerToken) {
    return false;
  }

  return alert.trend !== "down";
}

export async function processAutoTrade(alert: TokenAlert, config: AutoTradeConfig) {
  console.log(`Auto-trading trigger for ${alert.name} at ${alert.address}`);
  return await executeTrade({
    userId: config.userId,
    action: "buy",
    tokenAddress: alert.address,
    amount: config.buyAmount,
    slippage: config.maxSlippage,
  });
}
