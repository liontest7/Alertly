/**
 * Risk-based Alert Filtering
 */

import { TokenAlert } from "@/lib/listeners/blockchain-listener";
import { calculateRiskScore, RiskScore, TokenMetrics } from "./scorer";

export interface FilteredAlert extends TokenAlert {
  riskScore: RiskScore;
  passed: boolean;
  filteredBy?: string;
}

/**
 * Filter alerts based on risk score and user settings
 */
export async function filterAlertsByRisk(
  alerts: TokenAlert[],
  userMetrics: {
    maxRiskLevel?: number; // 0-10
    blockDangerous?: boolean;
    blockMedium?: boolean;
  }
): Promise<FilteredAlert[]> {
  const filtered: FilteredAlert[] = [];
  const maxRisk = userMetrics.maxRiskLevel ?? 8;

  for (const alert of alerts) {
    // Calculate risk for this token
    const metrics: TokenMetrics = {
      address: alert.tokenAddress,
      holders: alert.holders,
    };

    const riskScore = calculateRiskScore(metrics);

    let passed = riskScore.score <= maxRisk;
    let filteredBy: string | undefined;

    if (!passed) {
      filteredBy = `Risk too high: ${riskScore.score}/10`;
    }

    if (userMetrics.blockDangerous && riskScore.level === "DANGEROUS") {
      passed = false;
      filteredBy = "Dangerous token blocked";
    }

    if (userMetrics.blockMedium && riskScore.level === "MEDIUM") {
      passed = false;
      filteredBy = "Medium risk token blocked";
    }

    filtered.push({
      ...alert,
      riskScore,
      passed,
      filteredBy,
    });
  }

  return filtered;
}

/**
 * Get safe alerts only
 */
export function getSafeAlerts(filtered: FilteredAlert[]): TokenAlert[] {
  return filtered.filter((a) => a.passed).map(({ riskScore, passed, filteredBy, ...alert }) => alert);
}
