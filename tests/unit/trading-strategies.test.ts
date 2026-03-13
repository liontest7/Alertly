import { describe, it, expect } from "vitest";

const baseConfig = {
  userId: "user_1",
  enabled: true,
  buyAmount: 0.5,
  maxBuyPerToken: 2,
  maxSlippage: 10,
  takeProfit: 50,
  stopLoss: -25,
  trailingStop: false,
};

const baseAlert = {
  id: "alert_1",
  address: "TokenAddress123",
  name: "Test Token",
  symbol: "TEST",
  type: "DEX BOOST" as const,
  mc: "$500K",
  liquidity: "$100K",
  vol: "$200K",
  price: "0.0001",
  change: "+50%",
  trend: "up" as const,
  holders: 200,
  riskLevel: "medium" as const,
  dex: "Raydium",
  chain: "solana",
  alertedAt: new Date().toISOString(),
  boostedAt: null,
  boostAmount: null,
  walletBalance: null,
};

function parseMoney(value: string): number | null {
  const normalized = value.replace(/[$,\s]/g, "").toUpperCase();
  const raw = parseFloat(normalized);
  if (!Number.isFinite(raw)) return null;
  if (normalized.endsWith("K")) return raw * 1_000;
  if (normalized.endsWith("M")) return raw * 1_000_000;
  if (normalized.endsWith("B")) return raw * 1_000_000_000;
  return raw;
}

function isTypeEnabled(alertType: string, config: typeof baseConfig & { dexBoostEnabled?: boolean; dexListingEnabled?: boolean }): boolean {
  if (alertType === "DEX BOOST" && config.dexBoostEnabled === false) return false;
  if (alertType === "DEX LISTING" && config.dexListingEnabled === false) return false;
  return true;
}

async function shouldAutoTrade(
  alert: typeof baseAlert,
  config: typeof baseConfig & {
    minMarketCap?: number;
    maxMarketCap?: number;
    minLiquidity?: number;
    minHolders?: number;
    dexBoostEnabled?: boolean;
    dexListingEnabled?: boolean;
  }
): Promise<boolean> {
  if (!config.enabled || !config.userId) return false;
  if (!isTypeEnabled(alert.type, config)) return false;

  const marketCap = parseMoney(alert.mc);
  const liquidity = parseMoney(alert.liquidity);

  if (typeof config.minMarketCap === "number" && marketCap !== null && marketCap < config.minMarketCap) return false;
  if (typeof config.maxMarketCap === "number" && marketCap !== null && marketCap > config.maxMarketCap) return false;
  if (typeof config.minLiquidity === "number" && liquidity !== null && liquidity < config.minLiquidity) return false;
  if (typeof config.minHolders === "number" && alert.holders > 0 && alert.holders < config.minHolders) return false;
  if (config.buyAmount <= 0 || config.buyAmount > config.maxBuyPerToken) return false;

  return alert.trend !== "down";
}

describe("parseMoney", () => {
  it("parses K suffix", () => expect(parseMoney("$500K")).toBe(500_000));
  it("parses M suffix", () => expect(parseMoney("$1.5M")).toBe(1_500_000));
  it("parses B suffix", () => expect(parseMoney("$2B")).toBe(2_000_000_000));
  it("parses plain number", () => expect(parseMoney("$1234")).toBe(1234));
  it("handles invalid input", () => expect(parseMoney("N/A")).toBeNull());
  it("handles empty string", () => expect(parseMoney("")).toBeNull());
  it("strips commas and spaces", () => expect(parseMoney("$1,234,567")).toBe(1_234_567));
});

describe("shouldAutoTrade", () => {
  it("returns true for a valid matching alert", async () => {
    expect(await shouldAutoTrade(baseAlert, baseConfig)).toBe(true);
  });

  it("returns false when autoTrade disabled", async () => {
    expect(await shouldAutoTrade(baseAlert, { ...baseConfig, enabled: false })).toBe(false);
  });

  it("returns false when trend is down", async () => {
    expect(await shouldAutoTrade({ ...baseAlert, trend: "down" }, baseConfig)).toBe(false);
  });

  it("returns false when marketCap below minimum", async () => {
    expect(await shouldAutoTrade(baseAlert, { ...baseConfig, minMarketCap: 1_000_000 })).toBe(false);
  });

  it("returns false when marketCap above maximum", async () => {
    expect(await shouldAutoTrade(baseAlert, { ...baseConfig, maxMarketCap: 100_000 })).toBe(false);
  });

  it("returns true when marketCap within range", async () => {
    expect(await shouldAutoTrade(baseAlert, { ...baseConfig, minMarketCap: 100_000, maxMarketCap: 1_000_000 })).toBe(true);
  });

  it("returns false when liquidity below minimum", async () => {
    expect(await shouldAutoTrade(baseAlert, { ...baseConfig, minLiquidity: 500_000 })).toBe(false);
  });

  it("returns false when holders below minimum", async () => {
    expect(await shouldAutoTrade({ ...baseAlert, holders: 50 }, { ...baseConfig, minHolders: 100 })).toBe(false);
  });

  it("returns false when buyAmount exceeds maxBuyPerToken", async () => {
    expect(await shouldAutoTrade(baseAlert, { ...baseConfig, buyAmount: 5, maxBuyPerToken: 2 })).toBe(false);
  });

  it("returns false when DEX BOOST type disabled", async () => {
    expect(await shouldAutoTrade(baseAlert, { ...baseConfig, dexBoostEnabled: false })).toBe(false);
  });

  it("returns false when DEX LISTING type disabled for listing alert", async () => {
    expect(await shouldAutoTrade({ ...baseAlert, type: "DEX LISTING" }, { ...baseConfig, dexListingEnabled: false })).toBe(false);
  });

  it("returns true for DEX LISTING when enabled", async () => {
    expect(await shouldAutoTrade({ ...baseAlert, type: "DEX LISTING" }, { ...baseConfig, dexListingEnabled: true })).toBe(true);
  });

  it("ignores holder check when holders is 0", async () => {
    expect(await shouldAutoTrade({ ...baseAlert, holders: 0 }, { ...baseConfig, minHolders: 500 })).toBe(true);
  });
});
