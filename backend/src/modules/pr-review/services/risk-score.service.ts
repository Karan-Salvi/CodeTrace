import { hasTestCoverage } from "./dependency-retrieval.service.js";
import type { RiskFactor } from "../types/pr-review.types.js";

export interface RiskScoreInput {
  repositoryId: string;
  changedFilePaths: string[];
  changedSymbols: string[];
  linesChanged: number;
  dependencyFilesChanged: boolean;
  criticalDirectories: string[];
}

const AUTH_PATH_PATTERN = /auth|login|session|token/i;
const PAYMENT_PATH_PATTERN = /payment|charge|billing|invoice/i;
const MIGRATION_PATH_PATTERN = /migrations?\//i;

function levelFor(score: number): "LOW" | "MEDIUM" | "HIGH" {
  // pr-review.md: 0-30 LOW, 31-60 MEDIUM (inclusive), 61-100 HIGH.
  if (score <= 30) return "LOW";
  if (score <= 60) return "MEDIUM";
  return "HIGH";
}

// pr-review.md: transparent additive point model — every factor that
// triggers is returned alongside the score, never a bare number.
export async function calculateRiskScore(
  input: RiskScoreInput
): Promise<{ score: number; level: "LOW" | "MEDIUM" | "HIGH"; factors: RiskFactor[] }> {
  const factors: RiskFactor[] = [];

  if (input.changedFilePaths.some((p) => AUTH_PATH_PATTERN.test(p))) {
    factors.push({ code: "AUTH_PATH", points: 20, reason: "touches an authentication/authorization code path" });
  }

  if (input.changedFilePaths.some((p) => PAYMENT_PATH_PATTERN.test(p))) {
    factors.push({ code: "PAYMENT_PATH", points: 20, reason: "touches a payment code path" });
  }

  if (input.changedFilePaths.some((p) => MIGRATION_PATH_PATTERN.test(p))) {
    factors.push({ code: "MIGRATION", points: 15, reason: "includes a database migration" });
  }

  if (input.linesChanged > 500) {
    factors.push({ code: "LARGE_CHANGE", points: 10, reason: ">500 lines changed" });
  }

  if (input.dependencyFilesChanged) {
    factors.push({ code: "DEPENDENCY_CHANGE", points: 10, reason: "adds/changes a dependency" });
  }

  let anyMissingCoverage = false;
  for (const symbol of input.changedSymbols) {
    if (!(await hasTestCoverage(input.repositoryId, symbol))) {
      anyMissingCoverage = true;
      break;
    }
  }
  if (anyMissingCoverage) {
    factors.push({
      code: "NO_TEST_COVERAGE",
      points: 10,
      reason: "no test file touched alongside changed source",
    });
  }

  if (input.criticalDirectories.some((dir) => input.changedFilePaths.some((p) => p.startsWith(dir)))) {
    factors.push({
      code: "CRITICAL_DIRECTORY",
      points: 5,
      reason: "touches a directory flagged as critical",
    });
  }

  const score = Math.min(
    100,
    factors.reduce((sum, f) => sum + f.points, 0)
  );

  return { score, level: levelFor(score), factors };
}
