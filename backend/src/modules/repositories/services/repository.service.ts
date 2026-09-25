import { prisma } from "../../../database/client.js";
import { AppError } from "../../../core/errors/app-error.js";
import { getActiveInstallation } from "./installation.service.js";
import { enqueueIndexJob } from "../../../queues/producers/index-job.producer.js";
import { mintInstallationToken, listInstallationRepositories, type GithubRepo } from "./github-app.service.js";
import type { ConnectRepositoryInput } from "../types/repository.types.js";

const MAX_REPOSITORIES_PER_USER = 2;

export async function connectRepository(userId: string, input: ConnectRepositoryInput) {
  const installation = await getActiveInstallation(input.installationId);
  if (!installation) {
    throw AppError.notFound("Installation not found or revoked");
  }
  if (installation.userId !== userId) {
    throw AppError.forbidden("You do not own this installation");
  }

  const count = await prisma.repository.count({ where: { userId } });
  if (count >= MAX_REPOSITORIES_PER_USER) {
    throw AppError.conflict(
      "REPOSITORY_LIMIT_REACHED",
      `You can connect at most ${MAX_REPOSITORIES_PER_USER} repositories`
    );
  }

  // Connecting a repo must kick off its first index — otherwise it sits
  // at the default PENDING status forever with no job ever enqueued, and
  // the frontend's Re-index button treats PENDING as "already indexing"
  // (non-terminal) so it's permanently disabled too. Both rows are created
  // in one transaction so a mid-write crash can't leave a repository with
  // no index job at all.
  const { repository, indexJob } = await prisma.$transaction(async (tx) => {
    const repository = await tx.repository.create({
      data: {
        userId,
        installationId: input.installationId,
        owner: input.owner,
        name: input.name,
        githubUrl: input.githubUrl,
        defaultBranch: input.defaultBranch,
      },
    });
    const indexJob = await tx.indexJob.create({
      data: { repositoryId: repository.id, type: "FULL", status: "PENDING" },
    });
    return { repository, indexJob };
  });

  // enqueueIndexJob is a Redis call, not part of the DB transaction above —
  // if it throws, both the job and the repository would otherwise be stuck
  // at PENDING forever with nothing ever consuming it, and PENDING is in
  // index-job.service.ts's NON_TERMINAL_STATUSES so re-index stays
  // permanently blocked too. Mark both FAILED (terminal, and re-index
  // already treats FAILED as retryable) instead of leaving that trap.
  try {
    await enqueueIndexJob({ jobId: indexJob.id, repositoryId: repository.id, type: "FULL" });
  } catch (error) {
    await prisma.$transaction([
      prisma.indexJob.update({ where: { id: indexJob.id }, data: { status: "FAILED" } }),
      prisma.repository.update({ where: { id: repository.id }, data: { status: "FAILED" } }),
    ]);
    throw error;
  }

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
