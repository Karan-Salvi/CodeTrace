import { prisma } from "../../../database/client.js";
import { mapChangedLinesToChunks } from "./diff-analyzer.service.js";
import { getOneHopDependencies } from "./dependency-retrieval.service.js";
import { calculateRiskScore } from "./risk-score.service.js";
import { retrieveContext } from "../../retrieval/services/retrieval.service.js";
import { embedQuery, generateChatCompletion } from "../../chat/services/llm.service.js";
import { validateCitation } from "../../chat/services/citation-validator.service.js";
import type { ChangedLineRange, PrFinding } from "../types/pr-review.types.js";

interface RawLlmFinding {
  category: PrFinding["category"];
  file: string;
  line: number;
  explanation: string;
  relatedSymbol: string | null;
  citationFile: string;
  citationStartLine: number;
  citationEndLine: number;
}

export async function runPrReview(pullRequestId: string, changedRanges: ChangedLineRange[]) {
  const pullRequest = await prisma.pullRequest.findUniqueOrThrow({ where: { id: pullRequestId } });

  const review = await prisma.prReview.create({
    data: { pullRequestId, commitSha: pullRequest.headSha, status: "RUNNING" },
  });

  // pr-review.md pipeline: changed symbols -> one-hop dependency retrieval
  // -> hybrid retrieval -> AI review -> citation validation -> risk score.
  const changedChunks = await mapChangedLinesToChunks(pullRequest.repositoryId, changedRanges);
  const dependencies = await getOneHopDependencies(
    pullRequest.repositoryId,
    changedChunks.map((c) => c.chunkId)
  );

  const combinedQuery = changedChunks.map((c) => c.symbol).join(" ");
  const retrieved = combinedQuery
    ? await retrieveContext(pullRequest.repositoryId, combinedQuery, embedQuery)
    : [];

  const contextBlock = [...changedChunks, ...dependencies]
    .map((c) => `${c.filePath}: ${c.symbol}`)
    .concat(retrieved.map((c) => `[${c.filePath}:${c.startLine}-${c.endLine}]\n${c.content}`))
    .join("\n\n");

  const systemPrompt =
    "You are a PR reviewer. Return ONLY a JSON array of findings. " +
    "Each finding: category (BUG|SECURITY|PERFORMANCE|LOGIC|TESTING|MAINTAINABILITY), " +
    "file, line, explanation, relatedSymbol, citationFile, citationStartLine, citationEndLine. " +
    "Only report findings tied to a concrete correctness/security/performance/test-coverage concern.";
  const userPrompt = `Changed symbols and context:\n${contextBlock}`;

  const rawResponse = await generateChatCompletion(systemPrompt, userPrompt);
  const rawFindings: RawLlmFinding[] = JSON.parse(rawResponse);

  const chunkByFileAndLines = new Map(
    retrieved.map((c) => [`${c.filePath}:${c.startLine}-${c.endLine}`, c.id])
  );

  const findings: PrFinding[] = rawFindings.map((f) => {
    const key = `${f.citationFile}:${f.citationStartLine}-${f.citationEndLine}`;
    const chunkId = chunkByFileAndLines.get(key);
    const citation = chunkId
      ? { file: f.citationFile, startLine: f.citationStartLine, endLine: f.citationEndLine, chunkId }
      : null;
    const validated = citation && validateCitation(citation, retrieved);

    return {
      category: f.category,
      file: f.file,
      line: f.line,
      explanation: f.explanation,
      relatedSymbol: f.relatedSymbol,
      citation: validated ? citation : null,
    };
  });

  const riskResult = await calculateRiskScore({
    repositoryId: pullRequest.repositoryId,
    changedFilePaths: changedRanges.map((r) => r.filePath),
    changedSymbols: changedChunks.map((c) => c.symbol),
    linesChanged: changedRanges.reduce((sum, r) => sum + (r.endLine - r.startLine + 1), 0),
    dependencyFilesChanged: changedRanges.some((r) => /package\.json|requirements\.txt|pyproject\.toml/.test(r.filePath)),
    criticalDirectories: [],
  });

  return prisma.prReview.update({
    where: { id: review.id },
    data: {
      status: "COMPLETE",
      riskScore: riskResult.score,
      riskLevel: riskResult.level,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      riskFactors: riskResult.factors as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findings: findings as any,
    },
  });
}
