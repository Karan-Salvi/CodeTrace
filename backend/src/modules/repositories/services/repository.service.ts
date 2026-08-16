import { prisma } from "../../../database/client.js";
import { AppError } from "../../../core/errors/app-error.js";
import { getActiveInstallation } from "./installation.service.js";
import type { ConnectRepositoryInput } from "../types/repository.types.js";

export async function connectRepository(userId: string, input: ConnectRepositoryInput) {
  const installation = await getActiveInstallation(input.installationId);
  if (!installation) {
    throw AppError.notFound("Installation not found or revoked");
  }
  if (installation.userId !== userId) {
    throw AppError.forbidden("You do not own this installation");
  }

  return prisma.repository.create({
    data: {
      userId,
      installationId: input.installationId,
      owner: input.owner,
      name: input.name,
      githubUrl: input.githubUrl,
      defaultBranch: input.defaultBranch,
    },
  });
}

export async function listRepositories(userId: string) {
  return prisma.repository.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function getOwnedRepository(userId: string, repositoryId: string) {
  const repository = await prisma.repository.findUnique({ where: { id: repositoryId } });
  if (!repository || repository.userId !== userId) {
    throw AppError.notFound("Repository not found");
  }
  return repository;
}

export async function deleteRepository(userId: string, repositoryId: string) {
  await getOwnedRepository(userId, repositoryId);
  await prisma.repository.delete({ where: { id: repositoryId } });
}
