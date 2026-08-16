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

export async function triggerFullIndex(userId: string, repositoryId: string) {
  const repository = await getOwnedRepository(userId, repositoryId);

  if (NON_TERMINAL_STATUSES.includes(repository.status)) {
    throw AppError.conflict("ALREADY_INDEXING", "Repository is already actively indexing");
  }

  // Reading repository.status above and writing it below are two
  // separate round-trips — not atomic with each other. Two concurrent
  // requests can both read the same terminal status before either
  // commits, both pass the check above, and both create a job for the
  // same repository (confirmed via a concurrent-request test). Guard the
  // actual write with the status this request observed: updateMany's
  // WHERE clause only matches (and only returns count: 1) if the row is
  // still in that exact status at write time — the second concurrent
  // request's updateMany matches zero rows because the first request's
  // transaction already moved it to PENDING, so it fails this check
  // instead of silently also succeeding.
  const indexJob = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.repository.updateMany({
      where: { id: repositoryId, status: repository.status },
      data: { status: "PENDING" },
    });
    if (updateResult.count === 0) {
      throw AppError.conflict("ALREADY_INDEXING", "Repository is already actively indexing");
    }
    return tx.indexJob.create({
      data: {
        repositoryId,
        type: "FULL",
        status: "PENDING",
      },
    });
  });

  await enqueueIndexJob({
    jobId: indexJob.id,
    repositoryId,
    type: "FULL",
  });

  return indexJob;
}
