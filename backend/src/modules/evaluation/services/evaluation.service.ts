import { prisma } from "../../../database/client.js";
import { RETRIEVAL_FINAL_K } from "../../../config/constants.js";
import { vectorSearch } from "../../retrieval/services/vector-search.service.js";
import { keywordSearch } from "../../retrieval/services/keyword-search.service.js";
import { mergeRankings } from "../../retrieval/services/rrf-merge.service.js";
import { embedQuery } from "../../chat/services/llm.service.js";
import { rerank } from "../../retrieval/services/reranker.service.js";
import type { EvalConfig, ExpectedChunkIdentity } from "../types/evaluation.types.js";
import type { Prisma } from "@prisma/client";

async function runConfigSearch(repositoryId: string, questionText: string, config: EvalConfig) {
  if (config === "VECTOR_ONLY") {
    const queryVector = await embedQuery(questionText);
    return vectorSearch(repositoryId, queryVector, RETRIEVAL_FINAL_K);
  }
  if (config === "KEYWORD_ONLY") {
    return keywordSearch(repositoryId, questionText, RETRIEVAL_FINAL_K);
  }

  const queryVector = await embedQuery(questionText);
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(repositoryId, queryVector, RETRIEVAL_FINAL_K),
    keywordSearch(repositoryId, questionText, RETRIEVAL_FINAL_K),
  ]);
  const merged = mergeRankings(vectorResults, keywordResults, { queryType: "semantic" }).slice(0, RETRIEVAL_FINAL_K);

  if (config === "HYBRID") {
    return merged;
  }

  // HYBRID_RERANKED: rerank() takes RetrievedChunk[] (needs filePath/content),
  // but merged results here are bare {chunkId, score} rows — fetch the real
  // chunk rows first, same shape retrieval.service.ts builds before reranking.
  const chunkIds = merged.map((r) => r.chunkId);
  const chunkRows = await prisma.chunk.findMany({
    where: { id: { in: chunkIds } },
    include: { file: { select: { path: true } } },
  });
  const chunkById = new Map(chunkRows.map((c) => [c.id, c]));
  const candidates = merged
    .map((r) => chunkById.get(r.chunkId))
    .filter((c): c is NonNullable<typeof c> => c !== undefined)
    .map((c) => ({
      id: c.id,
      repositoryId: c.repositoryId,
      fileId: c.fileId,
      symbol: c.symbol,
      symbolType: c.symbolType,
      parentSymbol: c.parentSymbol,
      language: c.language,
      startLine: c.startLine,
      endLine: c.endLine,
      content: c.content,
      filePath: c.file.path,
    }));

  const reranked = await rerank(questionText, candidates);
  return reranked.map((c) => ({ chunkId: c.id }));
}

export async function runRetrievalEval(repositoryId: string, config: EvalConfig) {
  const questions = await prisma.evalQuestion.findMany({ where: { repositoryId } });

  // evaluation.md: "Only measured numbers go in docs/README — never
  // estimates." Dividing by a fake 1 when there are zero questions used
  // to silently write recallAt5/precisionAt5/mrr as 0.0 — indistinguishable
  // from a real "the retrieval system found nothing" result, even though
  // no evaluation actually ran. Refuse instead of fabricating a number.
  if (questions.length === 0) {
    throw new Error(`Cannot run retrieval eval: repository ${repositoryId} has no eval questions`);
  }

  const run = await prisma.evalRun.create({
    data: { repositoryId, config, recallAt5: 0, precisionAt5: 0, mrr: 0 },
  });

  let hits = 0;
  let precisionSum = 0;
  let reciprocalRankSum = 0;

  for (const question of questions) {
    const expected = question.expectedChunks as unknown as ExpectedChunkIdentity[];
    const results = await runConfigSearch(repositoryId, question.question, config);

    const chunks = await prisma.chunk.findMany({
      where: { id: { in: results.map((r) => r.chunkId) } },
      include: { file: { select: { path: true } } },
    });
    const chunkById = new Map(chunks.map((c) => [c.id, c]));

    const retrievedIdentities = results.map((r) => {
      const c = chunkById.get(r.chunkId);
      return c ? `${c.file.path}#${c.symbol}` : null;
    });

    const expectedKeys = new Set(expected.map((e) => `${e.path}#${e.symbol}`));
    const firstHitIndex = retrievedIdentities.findIndex((id) => id && expectedKeys.has(id));
    const correct = firstHitIndex !== -1;

    if (correct) {
      hits += 1;
      reciprocalRankSum += 1 / (firstHitIndex + 1);
    }

    const relevantInTopK = retrievedIdentities.filter((id) => id && expectedKeys.has(id)).length;
    precisionSum += retrievedIdentities.length > 0 ? relevantInTopK / retrievedIdentities.length : 0;

    await prisma.evalResult.create({
      data: {
        evalRunId: run.id,
        evalQuestionId: question.id,
        retrievedChunks: retrievedIdentities.filter(Boolean) as unknown as Prisma.InputJsonValue,
        correct,
      },
    });
  }

  const totalQuestions = questions.length;
  const recallAt5 = hits / totalQuestions;
  const precisionAt5 = precisionSum / totalQuestions;
  const mrr = reciprocalRankSum / totalQuestions;

  return prisma.evalRun.update({
    where: { id: run.id },
    data: { recallAt5, precisionAt5, mrr },
  });
}

import { runPrReview } from "../../pr-review/services/pr-review.service.js";
import type { ChangedLineRange, PrFinding } from "../../pr-review/types/pr-review.types.js";

export interface LabeledIssue {
  category: PrFinding["category"];
  file: string;
}

export interface PrEvalResult {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
}

// evaluation.md: true/false positive/negative rate � a finding "matches" a
// labeled issue when category and file agree (line-level matching is not
// required by the labeled dataset shape).
export async function runPrEval(
  pullRequestId: string,
  changedRanges: ChangedLineRange[],
  labeledIssues: LabeledIssue[]
): Promise<PrEvalResult> {
  const review = await runPrReview(pullRequestId, changedRanges);
  const findings = review.findings as unknown as PrFinding[];

  const matchedLabels = new Set<number>();
  let truePositives = 0;
  let falsePositives = 0;

  for (const finding of findings) {
    const matchIndex = labeledIssues.findIndex(
      (label, idx) => !matchedLabels.has(idx) && label.category === finding.category && label.file === finding.file
    );
    if (matchIndex !== -1) {
      matchedLabels.add(matchIndex);
      truePositives += 1;
    } else {
      falsePositives += 1;
    }
  }

  const falseNegatives = labeledIssues.length - matchedLabels.size;
  const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
  const recall = labeledIssues.length > 0 ? truePositives / labeledIssues.length : 0;

  return { truePositives, falsePositives, falseNegatives, precision, recall };
}
