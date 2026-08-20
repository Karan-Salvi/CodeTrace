import { Prisma } from "@prisma/client";
import { prisma } from "../../../database/client.js";
import { mapChangedLinesToChunks } from "./diff-analyzer.service.js";
import { getOneHopDependencies } from "./dependency-retrieval.service.js";
import { calculateRiskScore } from "./risk-score.service.js";
import { retrieveContext } from "../../retrieval/services/retrieval.service.js";
import { embedQuery, generateChatCompletion } from "../../chat/services/llm.service.js";
import { validateCitation } from "../../chat/services/citation-validator.service.js";
import { getPrDiff } from "./github-diff.service.js";
import { postReviewToGitHub } from "./github-writeback.service.js";
import { mintInstallationToken } from "../../repositories/services/github-app.service.js";
import type { PrReviewJobPayload } from "@codetrace/shared-types";
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

// Gemini's system prompt asks for "ONLY a JSON array" but sometimes wraps
// the reply in a markdown code fence anyway, or occasionally returns
// non-JSON prose. A parse failure here must not lose the whole review
// (risk score doesn't depend on the LLM at all) — log server-side and
// treat it as zero findings instead of throwing.
function parseRawFindings(rawResponse: string): RawLlmFinding[] {
  // Not anchored to the whole string — a reply like "Here's the review:\n```json\n[...]\n```"
  // (leading prose before the fence) is a plausible real Gemini shape and
  // must still match, not just a reply that's purely the fenced block.
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(rawResponse);
  const jsonText = fenceMatch ? fenceMatch[1] : rawResponse;

  try {
    const parsed: unknown = JSON.parse(jsonText);
    return Array.isArray(parsed) ? (parsed as RawLlmFinding[]) : [];
  } catch (err) {
    console.error("Failed to parse LLM PR-review response as JSON:", rawResponse, err);
    return [];
  }
}

export async function runPrReview(
  pullRequestId: string,
  changedRanges: ChangedLineRange[],
  commitSha?: string,
  existingReviewId?: string
) {
  const pullRequest = await prisma.pullRequest.findUniqueOrThrow({ where: { id: pullRequestId } });

  // processPrReviewJob pre-creates the RUNNING row itself (atomically, via
  // the pullRequestId+commitSha unique constraint) and passes its id here
  // so this function updates that same row instead of creating a second
  // one. Callers without a pre-created row (the eval harness, tests) fall
  // through to creating one here as before.
  //
  // processPrReviewJob also passes the exact commit its diff was fetched
  // for (payload.commitSha) explicitly, rather than trusting
  // pullRequest.headSha re-read here — headSha can already have moved on
  // to a later push by the time this runs (two quick pushes enqueue two
  // jobs; if job 1 for commit A runs after webhook 2 has updated headSha
  // to commit B, this would otherwise stamp the saved review with the
  // wrong commit). Falls back to headSha for callers that don't have a
  // specific commit in hand.
  const review = existingReviewId
    ? await prisma.prReview.findUniqueOrThrow({ where: { id: existingReviewId } })
    : await prisma.prReview.create({
        data: { pullRequestId, commitSha: commitSha ?? pullRequest.headSha, status: "RUNNING" },
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
  const rawFindings: RawLlmFinding[] = parseRawFindings(rawResponse);

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

  const savedReview = await prisma.prReview.update({
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

  return savedReview;
}

export async function processPrReviewJob(payload: PrReviewJobPayload): Promise<void> {
  // Idempotency via the pullRequestId+commitSha DB unique constraint
  // (schema.prisma), the same mechanism webhook_events(event_id) uses —
  // atomic, unlike a find-then-act check. Matters because two different
  // BullMQ jobs (distinct jobIds — webhook-dispatcher.service.ts mints a
  // fresh randomUUID() per accepted webhook, so BullMQ's own jobId-based
  // dedup never applies across two separate deliveries for the same
  // commit) can genuinely run concurrently: the worker's concurrency is
  // 5, not 1. A find-then-delete-then-create sequence here would let both
  // jobs read "no existing review" before either writes, both run the
  // paid LLM call, and both post a GitHub review for the same commit.
  let review;
  try {
    review = await prisma.prReview.create({
      data: { pullRequestId: payload.pullRequestId, commitSha: payload.commitSha, status: "RUNNING" },
    });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
      throw err;
    }
    // Lost the race (or this is a legitimate retry of the same job) —
    // another attempt already owns this commit's review row.
    const existing = await prisma.prReview.findUnique({
      where: {
        pullRequestId_commitSha: { pullRequestId: payload.pullRequestId, commitSha: payload.commitSha },
      },
    });
    if (existing?.status === "COMPLETE") {
      return;
    }
    // A RUNNING row: either a concurrent attempt is genuinely still
    // in-flight, or it's a leftover from a prior attempt that crashed
    // before reaching COMPLETE. Can't safely distinguish the two without
    // more machinery (a heartbeat/staleness timestamp) — skip rather
    // than risk a duplicate paid LLM call or a duplicate GitHub post.
    // Known gap: a genuinely crashed RUNNING row (its own BullMQ retries
    // all exhausted) stays RUNNING forever with no automatic recovery.
    return;
  }

  const pullRequest = await prisma.pullRequest.findUniqueOrThrow({
    where: { id: payload.pullRequestId },
    include: { repository: { include: { installation: true } } },
  });

  const { token } = await mintInstallationToken(
    pullRequest.repository.installation.githubInstallationId
  );

  const diffResult = await getPrDiff(
    token,
    pullRequest.repository.owner,
    pullRequest.repository.name,
    pullRequest.baseSha,
    payload.commitSha
  );

  const completedReview = await runPrReview(
    pullRequest.id,
    diffResult.changedRanges,
    payload.commitSha,
    review.id
  );

  // Wrapped explicitly: if postReviewToGitHub's fetch itself throws
  // (network error, not just a non-2xx response), that must not escape
  // as an unhandled rejection — it would fail the whole BullMQ job and
  // trigger a retry for what is purely a write-back problem, even though
  // the review itself already succeeded and was saved above.
  let writebackResult: { posted: boolean; error?: string };
  try {
    writebackResult = await postReviewToGitHub(
      token,
      pullRequest.repository.owner,
      pullRequest.repository.name,
      pullRequest.githubPrNumber,
      {
        riskScore: completedReview.riskScore,
        riskLevel: completedReview.riskLevel,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        riskFactors: (completedReview.riskFactors as any[]) ?? [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findings: (completedReview.findings as any[]) ?? [],
      },
      diffResult.positionByFileAndLine
    );
  } catch (err) {
    writebackResult = { posted: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (!writebackResult.posted) {
    console.error(`PR Review Writeback failed for PR ${pullRequest.id}:`, writebackResult.error);
    await prisma.prReview.update({
      where: { id: review.id },
      data: { writebackFailedAt: new Date() },
    });
  }
}
