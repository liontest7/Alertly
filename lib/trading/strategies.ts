import { TokenAlert } from "../blockchain/solana";

function parseMoneyValue(input?: string | null): number | null {
  if (!input) return null;
  const normalized = input.replace(/[$,\s]/g, "").toUpperCase();
  if (!normalized || normalized === "N/A") return null;
  const suffix = normalized.slice(-1);
  const num = parseFloat(normalized);
  if (isNaN(num)) return null;
  if (suffix === "B") return num * 1_000_000_000;
  if (suffix === "M") return num * 1_000_000;
  if (suffix === "K") return num * 1_000;
  return num;
}

export function shouldAutoTrade(
  alert: TokenAlert,
  settings: {
    autoTrade: boolean;
    minMarketCap: number;
    maxMarketCap: number;
    minLiquidity: number;
    minHolders: number;
    buyAmount: number;
    slippage: number;
  }
): boolean {
  if (!settings.autoTrade) return false;

  const mc = parseMoneyValue(alert.mc);
  const liquidity = parseMoneyValue(alert.liquidity);

  if (settings.minMarketCap > 0 && mc !== null && mc < settings.minMarketCap) return false;
  if (settings.maxMarketCap > 0 && mc !== null && mc > settings.maxMarketCap) return false;
  if (settings.minLiquidity > 0 && liquidity !== null && liquidity < settings.minLiquidity) return false;
  if (settings.minHolders > 0 && (alert.holders ?? 0) < settings.minHolders) return false;

  return true;
}
