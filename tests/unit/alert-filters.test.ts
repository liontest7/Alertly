import { describe, it, expect } from "vitest";

type AlertType = "DEX BOOST" | "DEX LISTING" | "WHALE BUY" | "SIGNAL";
type RiskLevel = "low" | "medium" | "high" | "critical";

interface TokenAlert {
  address: string;
  type: AlertType;
  mc: string;
  liquidity: string;
  holders: number;
  riskLevel: RiskLevel;
}

interface FilterSettings {
  dexBoostEnabled?: boolean;
  dexListingEnabled?: boolean;
  minMarketCap?: number;
  maxMarketCap?: number;
  minLiquidity?: number;
  minHolders?: number;
}

function parseMoney(value: string): number {
  const s = value.replace(/[$,\s]/g, "").toUpperCase();
  const n = parseFloat(s);
  if (!isFinite(n)) return 0;
  if (s.endsWith("K")) return n * 1_000;
  if (s.endsWith("M")) return n * 1_000_000;
  if (s.endsWith("B")) return n * 1_000_000_000;
  return n;
}

function passesFilters(alert: TokenAlert, filters: FilterSettings): boolean {
  if (alert.type === "DEX BOOST" && filters.dexBoostEnabled === false) return false;
  if (alert.type === "DEX LISTING" && filters.dexListingEnabled === false) return false;

  const mc = parseMoney(alert.mc);
  const liq = parseMoney(alert.liquidity);

  if (filters.minMarketCap && mc > 0 && mc < filters.minMarketCap) return false;
  if (filters.maxMarketCap && mc > 0 && mc > filters.maxMarketCap) return false;
  if (filters.minLiquidity && liq > 0 && liq < filters.minLiquidity) return false;
  if (filters.minHolders && alert.holders > 0 && alert.holders < filters.minHolders) return false;

  return true;
}

const mkAlert = (overrides: Partial<TokenAlert> = {}): TokenAlert => ({
  address: "TokenAddr1",
  type: "DEX BOOST",
  mc: "$500K",
  liquidity: "$100K",
  holders: 300,
  riskLevel: "medium",
  ...overrides,
});

describe("passesFilters", () => {
  it("passes all filters when no restrictions set", () => {
    expect(passesFilters(mkAlert(), {})).toBe(true);
  });

  it("blocks DEX BOOST when disabled", () => {
    expect(passesFilters(mkAlert({ type: "DEX BOOST" }), { dexBoostEnabled: false })).toBe(false);
  });

  it("blocks DEX LISTING when disabled", () => {
    expect(passesFilters(mkAlert({ type: "DEX LISTING" }), { dexListingEnabled: false })).toBe(false);
  });

  it("allows DEX BOOST when listing disabled but not boost", () => {
    expect(passesFilters(mkAlert({ type: "DEX BOOST" }), { dexListingEnabled: false })).toBe(true);
  });

  it("blocks alert below minMarketCap", () => {
    expect(passesFilters(mkAlert({ mc: "$50K" }), { minMarketCap: 100_000 })).toBe(false);
  });

  it("passes alert above minMarketCap", () => {
    expect(passesFilters(mkAlert({ mc: "$500K" }), { minMarketCap: 100_000 })).toBe(true);
  });

  it("blocks alert above maxMarketCap", () => {
    expect(passesFilters(mkAlert({ mc: "$5M" }), { maxMarketCap: 1_000_000 })).toBe(false);
  });

  it("passes alert below maxMarketCap", () => {
    expect(passesFilters(mkAlert({ mc: "$500K" }), { maxMarketCap: 1_000_000 })).toBe(true);
  });

  it("blocks alert below minLiquidity", () => {
    expect(passesFilters(mkAlert({ liquidity: "$10K" }), { minLiquidity: 50_000 })).toBe(false);
  });

  it("blocks alert below minHolders", () => {
    expect(passesFilters(mkAlert({ holders: 50 }), { minHolders: 100 })).toBe(false);
  });

  it("passes with all filters set and matching alert", () => {
    expect(passesFilters(mkAlert(), {
      dexBoostEnabled: true,
      minMarketCap: 100_000,
      maxMarketCap: 1_000_000,
      minLiquidity: 50_000,
      minHolders: 100,
    })).toBe(true);
  });

  it("ignores holders filter when holders is 0", () => {
    expect(passesFilters(mkAlert({ holders: 0 }), { minHolders: 500 })).toBe(true);
  });

  it("ignores mc filter when mc is N/A", () => {
    expect(passesFilters(mkAlert({ mc: "N/A" }), { minMarketCap: 999_999 })).toBe(true);
  });
});
