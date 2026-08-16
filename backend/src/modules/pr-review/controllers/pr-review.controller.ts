import type { Request, Response } from "express";
import { prisma } from "../../../database/client.js";
import { getOwnedRepository } from "../../repositories/services/repository.service.js";
import { sendSuccess } from "../../../core/utils/response.js";
import { AppError } from "../../../core/errors/app-error.js";

export async function getPrReviews(req: Request, res: Response) {
  await getOwnedRepository(req.user!.id, req.params.id as string);

  const pullRequest = await prisma.pullRequest.findUnique({ where: { id: req.params.prId as string } });
  if (!pullRequest || pullRequest.repositoryId !== (req.params.id as string)) {
    throw AppError.notFound("Pull request not found");
  }

  const reviews = await prisma.prReview.findMany({
    where: { pullRequestId: pullRequest.id },
    orderBy: { createdAt: "desc" },
  });
  sendSuccess(res, reviews);
}
