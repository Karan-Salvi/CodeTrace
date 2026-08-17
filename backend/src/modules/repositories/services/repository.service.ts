import { prisma } from "../../../database/client.js";
import { AppError } from "../../../core/errors/app-error.js";
import { getActiveInstallation } from "./installation.service.js";
import { enqueueIndexJob } from "../../../queues/producers/index-job.producer.js";
import { mintInstallationToken, listInstallationRepositories, type GithubRepo } from "./github-app.service.js";
import type { ConnectRepositoryInput } from "../types/repository.types.js";

export async function connectRepository(userId: string, input: ConnectRepositoryInput) {
  const installation = await getActiveInstallation(input.installationId);
  if (!installation) {
    throw AppError.notFound("Installation not found or revoked");
  }
  if (installation.userId !== userId) {
    throw AppError.forbidden("You do not own this installation");
  }

  const repository = await prisma.repository.create({
    data: {
      userId,
      installationId: input.installationId,
      owner: input.owner,
      name: input.name,
      githubUrl: input.githubUrl,
      defaultBranch: input.defaultBranch,
    },
  });

  // Connecting a repo must kick off its first index — otherwise it sits
  // at the default PENDING status forever with no job ever enqueued, and
  // the frontend's Re-index button treats PENDING as "already indexing"
  // (non-terminal) so it's permanently disabled too.
  const indexJob = await prisma.indexJob.create({
    data: { repositoryId: repository.id, type: "FULL", status: "PENDING" },
  });
  await enqueueIndexJob({ jobId: indexJob.id, repositoryId: repository.id, type: "FULL" });

  return repository;
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

export async function listAvailableRepos(
  userId: string,
  installationId: string
): Promise<(GithubRepo & { alreadyConnected: boolean })[]> {
  const installation = await getActiveInstallation(installationId);
  if (!installation) {
    throw AppError.notFound("Installation not found or revoked");
  }
  if (installation.userId !== userId) {
    throw AppError.forbidden("You do not own this installation");
  }

  const { token } = await mintInstallationToken(installation.githubInstallationId);
  const repos = await listInstallationRepositories(token);

  const connected = await prisma.repository.findMany({
    where: { userId },
    select: { githubUrl: true },
  });
  // Existing rows may or may not carry a trailing ".git" (the now-removed
  // manual-entry form let users paste either form; GitHub's html_url never
  // has one) — normalize both sides so a legacy .git-suffixed row still
  // matches, instead of silently letting it be re-imported as a duplicate.
  const normalize = (url: string) => url.replace(/\.git$/, "").replace(/\/$/, "");
  const connectedUrls = new Set(connected.map((r) => normalize(r.githubUrl)));

  return repos.map((repo) => ({
    ...repo,
    alreadyConnected: connectedUrls.has(normalize(repo.githubUrl)),
  }));
}
