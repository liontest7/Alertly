/**
 * Token Risk Scoring Engine
 * Calculates risk score 0-10 based on token metrics
 */


export interface TokenMetrics {
  address: string;
  holders?: number;
  devWalletPct?: number;
  topHoldersPct?: number;
  lpLockedPct?: number;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  supply?: number;
  decimals?: number;
}

export interface RiskScore {
  score: number; // 0-10
  level: "SAFE" | "MEDIUM" | "DANGEROUS";
  factors: RiskFactor[];
  timestamp: Date;
}

export interface RiskFactor {
  name: string;
  value: number | string;
  weight: number; // 0-1
  risk: "low" | "medium" | "high";
}

/**
 * Calculate risk score for a token (0-10)
 * 0-3: Safe
 * 4-6: Medium
 * 7-10: Dangerous
 */
export function calculateRiskScore(metrics: TokenMetrics): RiskScore {
  const factors: RiskFactor[] = [];
  let totalWeight = 0;
  let totalRisk = 0;

  // Factor 1: Mint Authority (Can create more tokens)
  if (metrics.mintAuthority) {
    const mintRisk =
      metrics.mintAuthority === metrics.address ? "low" : "high";
    factors.push({
      name: "Mint Authority Active",
      value: "Yes",
      weight: 0.2,
      risk: mintRisk as "low" | "high",
    });
    totalWeight += 0.2;
    totalRisk += (mintRisk === "high" ? 2 : 0.5) * 0.2;
  }

  // Factor 2: Freeze Authority (Can freeze wallets)
  if (metrics.freezeAuthority) {
    const freezeRisk =
      metrics.freezeAuthority === metrics.address ? "low" : "high";
    factors.push({
      name: "Freeze Authority Active",
      value: "Yes",
      weight: 0.2,
      risk: freezeRisk as "low" | "high",
    });
    totalWeight += 0.2;
    totalRisk += (freezeRisk === "high" ? 2 : 0.5) * 0.2;
  }

  // Factor 3: Dev Wallet Concentration
  if (metrics.devWalletPct !== undefined) {
    let devRisk: "low" | "medium" | "high" = "low";
    let devScore = 0;

    if (metrics.devWalletPct > 30) {
      devRisk = "high";
      devScore = 2.5;
    } else if (metrics.devWalletPct > 10) {
      devRisk = "medium";
      devScore = 1.5;
    } else {
      devScore = 0.5;
    }

    factors.push({
      name: "Dev Wallet %",
      value: `${metrics.devWalletPct.toFixed(2)}%`,
      weight: 0.15,
      risk: devRisk,
    });
    totalWeight += 0.15;
    totalRisk += devScore * 0.15;
  }

  // Factor 4: Top Holders Concentration
  if (metrics.topHoldersPct !== undefined) {
    let holdersRisk: "low" | "medium" | "high" = "low";
    let holdersScore = 0;

    if (metrics.topHoldersPct > 50) {
      holdersRisk = "high";
      holdersScore = 2.5;
    } else if (metrics.topHoldersPct > 30) {
      holdersRisk = "medium";
      holdersScore = 1.5;
    } else {
      holdersScore = 0.5;
    }

    factors.push({
      name: "Top 10 Holders %",
      value: `${metrics.topHoldersPct.toFixed(2)}%`,
      weight: 0.15,
      risk: holdersRisk,
    });
    totalWeight += 0.15;
    totalRisk += holdersScore * 0.15;
  }

  // Factor 5: LP Lock Status
  if (metrics.lpLockedPct !== undefined) {
    let lpRisk: "low" | "medium" | "high" = metrics.lpLockedPct > 50 ? "low" : "high";
    factors.push({
      name: "LP Locked %",
      value: `${metrics.lpLockedPct.toFixed(2)}%`,
      weight: 0.1,
      risk: lpRisk,
    });
    totalWeight += 0.1;
    totalRisk += (metrics.lpLockedPct > 50 ? 0.5 : 2) * 0.1;
  }

  // Factor 6: Holder Count (Too few = rug risk)
  if (metrics.holders !== undefined) {
    let holdersCountRisk: "low" | "medium" | "high" = "low";
    let holdersCountScore = 0;

    if (metrics.holders < 100) {
      holdersCountRisk = "high";
      holdersCountScore = 2.5;
    } else if (metrics.holders < 500) {
      holdersCountRisk = "medium";
      holdersCountScore = 1;
    } else {
      holdersCountScore = 0;
    }

    factors.push({
      name: "Total Holders",
      value: metrics.holders.toString(),
      weight: 0.1,
      risk: holdersCountRisk,
    });
    totalWeight += 0.1;
    totalRisk += holdersCountScore * 0.1;
  }

  // Normalize score
  const avgRisk = totalWeight > 0 ? totalRisk / totalWeight : 0;
  const normalizedScore = Math.min(10, Math.max(0, avgRisk));

  // Determine level
  let level: "SAFE" | "MEDIUM" | "DANGEROUS";
  if (normalizedScore <= 3) {
    level = "SAFE";
  } else if (normalizedScore <= 6) {
    level = "MEDIUM";
  } else {
    level = "DANGEROUS";
  }

  return {
    score: parseFloat(normalizedScore.toFixed(1)),
    level,
    factors,
    timestamp: new Date(),
  };
}

/**
 * Check if token should be filtered based on risk
 */
export function shouldFilterToken(
  riskScore: RiskScore,
  maxRisk: number = 8
): boolean {
  return riskScore.score >= maxRisk;
}

/**
 * Get risk badge color for UI
 */
export function getRiskColor(score: number): string {
  if (score <= 3) return "green"; // Safe
  if (score <= 6) return "yellow"; // Medium
  return "red"; // Dangerous
}

