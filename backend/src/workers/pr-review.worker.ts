import { Worker, type Job } from "bullmq";
import { PR_REVIEW_QUEUE } from "../queues/index.js";
import { env } from "../config/env.js";
import type { PrReviewJobPayload } from "@codetrace/shared-types";
import { processPrReviewJob } from "../modules/pr-review/services/pr-review.service.js";

// Unlike standard generic workers, this orchestrator spans modules:
// it owns the Redis connection + BullMQ lifecycle specifically for
// the PR Review pipeline.
export const prReviewWorker = new Worker<PrReviewJobPayload>(
  PR_REVIEW_QUEUE,
  async (job: Job<PrReviewJobPayload>) => {
    console.log(`[PR Review Worker] Processing PR Review for ${job.data.repositoryId} PR #${job.data.pullRequestId}`);
    await processPrReviewJob(job.data);
  },
  {
    connection: { url: env.REDIS_URL },
    concurrency: 5,
  }
);

prReviewWorker.on("completed", (job) => {
  console.log(`[PR Review Worker] Job ${job.id} completed successfully`);
});

prReviewWorker.on("failed", (job, err) => {
  console.error(`[PR Review Worker] Job ${job?.id} failed:`, err);
});
