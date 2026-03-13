import { TokenAlert } from "../blockchain/solana";

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

  const mc = parseFloat(alert.mc?.replace(/[$,KMB]/g, "") || "0");
  const liquidity = parseFloat(alert.liquidity?.replace(/[$,KMB]/g, "") || "0");

  if (settings.minMarketCap > 0 && mc < settings.minMarketCap) return false;
  if (settings.maxMarketCap > 0 && mc > settings.maxMarketCap) return false;
  if (settings.minLiquidity > 0 && liquidity < settings.minLiquidity) return false;
  if (settings.minHolders > 0 && (alert.holders ?? 0) < settings.minHolders) return false;

  return true;
}
