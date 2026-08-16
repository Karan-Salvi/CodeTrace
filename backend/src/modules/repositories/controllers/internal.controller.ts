import type { Request, Response } from "express";
import { prisma } from "../../../database/client.js";
import { getActiveInstallation } from "../services/installation.service.js";
import { mintInstallationToken } from "../services/github-app.service.js";
import { AppError } from "../../../core/errors/app-error.js";
import { sendSuccess } from "../../../core/utils/response.js";

export async function getInstallationToken(req: Request, res: Response) {
  const repository = await prisma.repository.findUnique({ where: { id: req.params.id as string } });
  if (!repository) {
    throw AppError.notFound("Repository not found");
  }

  const installation = await getActiveInstallation(repository.installationId);
  if (!installation) {
    throw AppError.notFound("Repository not found");
  }

  const { token, expiresAt } = await mintInstallationToken(installation.githubInstallationId);
  sendSuccess(res, { token, expiresAt: expiresAt.toISOString() });
}
