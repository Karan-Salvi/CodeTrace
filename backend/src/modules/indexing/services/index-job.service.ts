import { prisma } from "../../../database/client.js";
import { AppError } from "../../../core/errors/app-error.js";
import { getOwnedRepository } from "../../repositories/services/repository.service.js";
import { enqueueIndexJob } from "../../../queues/producers/index-job.producer.js";
import type { RepositoryStatus } from "@prisma/client";

const NON_TERMINAL_STATUSES: RepositoryStatus[] = [
  "PENDING",
  "CLONING",
  "PARSING",
  "CHUNKING",
  "EMBEDDING",
  "STORING",
];

export async function createAndEnqueueIndexJob(
  repositoryId: string,
  type: "FULL" | "INCREMENTAL",
  currentStatus: RepositoryStatus
) {
  if (NON_TERMINAL_STATUSES.includes(currentStatus)) {
    throw AppError.conflict("ALREADY_INDEXING", "Repository is already actively indexing");
  }

  const indexJob = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.repository.updateMany({
      where: { id: repositoryId, status: currentStatus },
      data: { status: "PENDING" },
    });
    if (updateResult.count === 0) {
      throw AppError.conflict("ALREADY_INDEXING", "Repository is already actively indexing");
    }
    return tx.indexJob.create({
      data: {
        repositoryId,
        type,
        status: "PENDING",
      },
    });
  });

  await enqueueIndexJob({
    jobId: indexJob.id,
    repositoryId,
    type,
  });

  return indexJob;
}

export async function triggerFullIndex(userId: string, repositoryId: string) {
  const repository = await getOwnedRepository(userId, repositoryId);

  return createAndEnqueueIndexJob(repositoryId, "FULL", repository.status);
}
