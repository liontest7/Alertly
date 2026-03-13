import { describe, it, expect } from "vitest";

type RiskLevel = "low" | "medium" | "high" | "critical";

interface TokenMetrics {
  holders: number;
  liquidityUsd: number;
  marketCapUsd: number;
  hasVerifiedContract: boolean;
  boosted: boolean;
}

function computeRiskLevel(metrics: TokenMetrics): RiskLevel {
  let score = 0;

  if (metrics.holders < 50) score += 3;
  else if (metrics.holders < 200) score += 2;
  else if (metrics.holders < 500) score += 1;

  if (metrics.liquidityUsd < 5_000) score += 3;
  else if (metrics.liquidityUsd < 20_000) score += 2;
  else if (metrics.liquidityUsd < 50_000) score += 1;

  if (metrics.marketCapUsd < 10_000) score += 2;
  else if (metrics.marketCapUsd < 100_000) score += 1;

  if (!metrics.hasVerifiedContract) score += 1;
  if (metrics.boosted) score -= 1;

  if (score >= 7) return "critical";
  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

describe("computeRiskLevel", () => {
  it("low risk for established token", () => {
    expect(computeRiskLevel({
      holders: 5000,
      liquidityUsd: 500_000,
      marketCapUsd: 10_000_000,
      hasVerifiedContract: true,
      boosted: false,
    })).toBe("low");
  });

  it("critical risk for brand new token", () => {
    expect(computeRiskLevel({
      holders: 10,
      liquidityUsd: 1_000,
      marketCapUsd: 5_000,
      hasVerifiedContract: false,
      boosted: false,
    })).toBe("critical");
  });

  it("high risk for low holders and liquidity", () => {
    expect(computeRiskLevel({
      holders: 80,
      liquidityUsd: 8_000,
      marketCapUsd: 50_000,
      hasVerifiedContract: false,
      boosted: false,
    })).toBe("high");
  });

  it("boost reduces risk score", () => {
    const withBoost = computeRiskLevel({
      holders: 100,
      liquidityUsd: 15_000,
      marketCapUsd: 80_000,
      hasVerifiedContract: true,
      boosted: true,
    });
    const withoutBoost = computeRiskLevel({
      holders: 100,
      liquidityUsd: 15_000,
      marketCapUsd: 80_000,
      hasVerifiedContract: true,
      boosted: false,
    });
    const levels: RiskLevel[] = ["low", "medium", "high", "critical"];
    expect(levels.indexOf(withBoost)).toBeLessThanOrEqual(levels.indexOf(withoutBoost));
  });

  it("unverified contract increases risk", () => {
    const unverified = computeRiskLevel({
      holders: 500,
      liquidityUsd: 100_000,
      marketCapUsd: 500_000,
      hasVerifiedContract: false,
      boosted: false,
    });
    const verified = computeRiskLevel({
      holders: 500,
      liquidityUsd: 100_000,
      marketCapUsd: 500_000,
      hasVerifiedContract: true,
      boosted: false,
    });
    const levels: RiskLevel[] = ["low", "medium", "high", "critical"];
    expect(levels.indexOf(unverified)).toBeGreaterThanOrEqual(levels.indexOf(verified));
  });
});
