import { describe, it, expect, vi } from "vitest";
import { calculateRiskScore } from "./risk-score.service.js";
import * as depRetrieval from "./dependency-retrieval.service.js";

describe("calculateRiskScore", () => {
  it("scores a low-risk PR (small, no sensitive paths, has test coverage)", async () => {
    vi.spyOn(depRetrieval, "hasTestCoverage").mockResolvedValue(true);

    const result = await calculateRiskScore({
      repositoryId: "repo-1",
      changedFilePaths: ["src/utils/format.ts"],
      changedSymbols: ["formatDate"],
      linesChanged: 20,
      dependencyFilesChanged: false,
      criticalDirectories: [],
    });

    expect(result.level).toBe("LOW");
    expect(result.score).toBeLessThanOrEqual(30);
  });

  it("adds +20 for touching an auth path", async () => {
    vi.spyOn(depRetrieval, "hasTestCoverage").mockResolvedValue(true);

    const result = await calculateRiskScore({
      repositoryId: "repo-1",
      changedFilePaths: ["src/modules/auth/services/auth.service.ts"],
      changedSymbols: ["login"],
      linesChanged: 20,
      dependencyFilesChanged: false,
      criticalDirectories: [],
    });

    expect(result.factors.some((f) => f.code === "AUTH_PATH" && f.points === 20)).toBe(true);
  });

  it("adds +15 for a database migration and +10 for a dependency change", async () => {
    vi.spyOn(depRetrieval, "hasTestCoverage").mockResolvedValue(true);

    const result = await calculateRiskScore({
      repositoryId: "repo-1",
      changedFilePaths: ["backend/prisma/migrations/20260101_add_col/migration.sql"],
      changedSymbols: [],
      linesChanged: 10,
      dependencyFilesChanged: true,
      criticalDirectories: [],
    });

    expect(result.factors.some((f) => f.code === "MIGRATION" && f.points === 15)).toBe(true);
    expect(result.factors.some((f) => f.code === "DEPENDENCY_CHANGE" && f.points === 10)).toBe(true);
  });

  it("adds +10 for missing test coverage and reaches HIGH when combined with auth+payment", async () => {
    vi.spyOn(depRetrieval, "hasTestCoverage").mockResolvedValue(false);

    const result = await calculateRiskScore({
      repositoryId: "repo-1",
      changedFilePaths: ["src/modules/auth/services/payment.service.ts"],
      changedSymbols: ["chargeCard"],
      linesChanged: 600,
      dependencyFilesChanged: true,
      criticalDirectories: [],
    });

    expect(result.factors.some((f) => f.code === "NO_TEST_COVERAGE")).toBe(true);
    expect(result.factors.some((f) => f.code === "LARGE_CHANGE")).toBe(true);
    expect(result.level).toBe("HIGH");
  });

  it("classifies a score of exactly 60 as MEDIUM, not HIGH", async () => {
    // Regression: levelFor used `score < 60` for the MEDIUM upper bound,
    // so a score of exactly 60 fell through to HIGH — pr-review.md
    // documents 31-60 as MEDIUM (inclusive) and 61-100 as HIGH.
    vi.spyOn(depRetrieval, "hasTestCoverage").mockResolvedValue(false);

    const result = await calculateRiskScore({
      repositoryId: "repo-1",
      // AUTH_PATH(20) + MIGRATION(15) + LARGE_CHANGE(10) + CRITICAL_DIRECTORY(5)
      // + NO_TEST_COVERAGE(10) = 60 exactly.
      changedFilePaths: ["src/modules/auth/migrations/20260101_add_col/migration.sql"],
      changedSymbols: ["login"],
      linesChanged: 600,
      dependencyFilesChanged: false,
      criticalDirectories: ["src/modules/auth/"],
    });

    expect(result.score).toBe(60);
    expect(result.level).toBe("MEDIUM");
  });

  it("adds +5 for a configured critical directory", async () => {
    vi.spyOn(depRetrieval, "hasTestCoverage").mockResolvedValue(true);

    const result = await calculateRiskScore({
      repositoryId: "repo-1",
      changedFilePaths: ["infra/terraform/main.tf"],
      changedSymbols: [],
      linesChanged: 5,
      dependencyFilesChanged: false,
      criticalDirectories: ["infra/"],
    });

    expect(result.factors.some((f) => f.code === "CRITICAL_DIRECTORY" && f.points === 5)).toBe(true);
  });

  it("always returns factors alongside the score, never a bare number", async () => {
    vi.spyOn(depRetrieval, "hasTestCoverage").mockResolvedValue(true);

    const result = await calculateRiskScore({
      repositoryId: "repo-1",
      changedFilePaths: ["src/x.ts"],
      changedSymbols: [],
      linesChanged: 1,
      dependencyFilesChanged: false,
      criticalDirectories: [],
    });

    expect(Array.isArray(result.factors)).toBe(true);
    expect(typeof result.score).toBe("number");
  });
});
