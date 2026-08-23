import { Prisma } from "@prisma/client";
import { prisma } from "../../../database/client.js";
import { mapChangedLinesToChunks } from "./diff-analyzer.service.js";
import { getOneHopDependencies } from "./dependency-retrieval.service.js";
import { calculateRiskScore } from "./risk-score.service.js";
import { retrieveContext } from "../../retrieval/services/retrieval.service.js";
import { embedQuery, generateChatCompletion } from "../../chat/services/llm.service.js";
import { computeCostUsd } from "../../chat/services/pricing.service.js";
import { env } from "../../../config/env.js";
import crypto from "crypto";
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

// Same atomic-claim shape processPrReviewJob uses for the real queue path —
// needed here too because runPrReview is also called directly (the eval
// harness, evaluation.service.ts:121) without a pre-created row. Without
// this, a second call for the same pullRequestId+commitSha (re-running an
// eval scenario) throws an unhandled P2002 instead of either reusing the
// completed result or safely retrying.
async function claimOrCreateReview(
  pullRequestId: string,
  commitSha: string
): Promise<{ review: Awaited<ReturnType<typeof prisma.prReview.create>>; alreadyComplete: boolean }> {
  try {
    const review = await prisma.prReview.create({
      data: { pullRequestId, commitSha, status: "RUNNING" },
    });
    return { review, alreadyComplete: false };
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
      throw err;
    }
    const existing = await prisma.prReview.findUniqueOrThrow({
      where: { pullRequestId_commitSha: { pullRequestId, commitSha } },
    });
    if (existing.status === "COMPLETE") {
      return { review: existing, alreadyComplete: true };
    }
    const claimed = await prisma.prReview.update({
      where: { id: existing.id },
      data: { status: "RUNNING", failureReason: null, writebackFailedAt: null },
    });
    return { review: claimed, alreadyComplete: false };
  }
}

export async function runPrReview(
  pullRequestId: string,
  changedRanges: ChangedLineRange[],
  commitSha?: string,
  existingReviewId?: string,
  jobId?: string
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
  const { review, alreadyComplete } = existingReviewId
    ? { review: await prisma.prReview.findUniqueOrThrow({ where: { id: existingReviewId } }), alreadyComplete: false }
    : await claimOrCreateReview(pullRequestId, commitSha ?? pullRequest.headSha);

  if (alreadyComplete) {
    return review;
  }

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

  const { text: rawResponse, usage } = await generateChatCompletion(systemPrompt, userPrompt);
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

  const llmCostUsd = computeCostUsd(env.GEMINI_CHAT_MODEL, usage);

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
      llmCostUsd,
    },
  });

  await prisma.usageLog.create({
    data: {
      repositoryId: pullRequest.repositoryId,
      requestId: crypto.randomUUID(),
      jobId,
      kind: "PR_REVIEW",
      tokensUsed: usage.totalTokens,
      costUsd: llmCostUsd,
      chunksRetrieved: retrieved.length,
      chunksCited: findings.filter((f) => f.citation).length,
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
    if (existing?.status === "COMPLETE" || existing === null) {
      return;
    }
    // A RUNNING or FAILED row: BullMQ locks a jobId while it's processing
    // — no two executions of the SAME jobId ever run concurrently — so
    // the common case landing here is a legitimate retry of this exact
    // job after a prior attempt threw (a real Gemini 503, a network
    // blip). That retry must be allowed to actually redo the work, not
    // silently no-op: returning here without throwing used to make
    // BullMQ mark the job "completed" (the handler resolved normally)
    // while this row stayed RUNNING forever with zero further retries
    // and zero visibility — confirmed live, not hypothetical. Take the
    // row over and retry for real. The narrow remaining risk (a second,
    // genuinely different jobId for the same commit — e.g. a duplicate
    // webhook delivery — arriving while this row is truly still
    // in-flight) can race to a duplicate GitHub post; accepted as the
    // lesser risk against every retry being silently dead.
    review = await prisma.prReview.update({
      where: { id: existing.id },
      data: { status: "RUNNING", failureReason: null, writebackFailedAt: null },
    });
  }

  try {
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
      review.id,
      payload.jobId
    );

    await postWritebackAndRecordFailure(completedReview, pullRequest, token, diffResult);
  } catch (err) {
    // The pipeline itself failed (diff fetch, retrieval, the LLM call —
    // anything before write-back). Record it so the row doesn't sit at
    // RUNNING forever with no explanation, then rethrow so BullMQ's own
    // attempts/backoff still applies — a real retry now correctly takes
    // this row over via the branch above instead of a silent no-op.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`PR review pipeline failed for review ${review.id}:`, err);
    await prisma.prReview.update({
      where: { id: review.id },
      data: { status: "FAILED", failureReason: message },
    });
    throw err;
  }
}

async function postWritebackAndRecordFailure(
  completedReview: Awaited<ReturnType<typeof runPrReview>>,
  pullRequest: { githubPrNumber: number; repository: { owner: string; name: string } },
  token: string,
  diffResult: Awaited<ReturnType<typeof getPrDiff>>
): Promise<void> {

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
    console.error(`PR Review Writeback failed for PR #${pullRequest.githubPrNumber}:`, writebackResult.error);
    await prisma.prReview.update({
      where: { id: completedReview.id },
      data: { writebackFailedAt: new Date() },
    });
  }
}
