import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../../database/client.js";
import { getOwnedRepository } from "../../repositories/services/repository.service.js";
import { runRetrievalEval, runPrEval } from "../services/evaluation.service.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { AppError } from "../../../core/errors/app-error.js";

const retrievalRunSchema = z.object({
  repositoryId: z.string().uuid(),
  config: z.enum(["VECTOR_ONLY", "KEYWORD_ONLY", "HYBRID", "HYBRID_RERANKED"]),
});

export async function postRetrievalRun(req: Request, res: Response) {
  const parsed = retrievalRunSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest("INVALID_INPUT", parsed.error.message);
  }

  await getOwnedRepository(req.user!.id, parsed.data.repositoryId);

  const run = await runRetrievalEval(parsed.data.repositoryId, parsed.data.config);
  sendSuccess(res, run);
}

const prRunSchema = z.object({
  pullRequestId: z.string().uuid(),
  changedRanges: z.array(
    z.object({ filePath: z.string(), startLine: z.number(), endLine: z.number() })
  ),
  labeledIssues: z.array(
    z.object({
      category: z.enum(["BUG", "SECURITY", "PERFORMANCE", "LOGIC", "TESTING", "MAINTAINABILITY"]),
      file: z.string(),
    })
  ),
});

export async function postPrRun(req: Request, res: Response) {
  const parsed = prRunSchema.safeParse(req.body);
  if (!parsed.success) {
    throw AppError.badRequest("INVALID_INPUT", parsed.error.message);
  }

  const pullRequest = await prisma.pullRequest.findUniqueOrThrow({
    where: { id: parsed.data.pullRequestId },
  });
  await getOwnedRepository(req.user!.id, pullRequest.repositoryId);

  const result = await runPrEval(parsed.data.pullRequestId, parsed.data.changedRanges, parsed.data.labeledIssues);
  sendSuccess(res, result);
}
