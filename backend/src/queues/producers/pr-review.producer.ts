import { Queue } from "bullmq";
import { env } from "../../config/env.js";
import { PR_REVIEW_QUEUE } from "../index.js";
import type { PrReviewJobPayload } from "@codetrace/shared-types";

const prReviewQueue = new Queue<PrReviewJobPayload>(PR_REVIEW_QUEUE, {
  connection: { url: env.REDIS_URL },
});

export async function enqueuePrReviewJob(payload: PrReviewJobPayload): Promise<void> {
  // Matches index-job.producer.ts's retry shape — a transient GitHub API
  // or LLM failure inside the pr-review consumer must not permanently
  // fail the job on the first attempt.
  await prReviewQueue.add(PR_REVIEW_QUEUE, payload, {
    jobId: payload.jobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
}
