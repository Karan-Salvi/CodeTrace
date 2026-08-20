import { describe, it, expect, afterAll } from "vitest";
import { Queue } from "bullmq";
import { enqueuePrReviewJob } from "./pr-review.producer.js";
import { PR_REVIEW_QUEUE } from "../index.js";
import { env } from "../../config/env.js";

describe("pr-review.producer", () => {
  const inspectQueue = new Queue(PR_REVIEW_QUEUE, { connection: { url: env.REDIS_URL } });

  afterAll(async () => {
    await inspectQueue.obliterate({ force: true });
    await inspectQueue.close();
  });

  it("enqueues a job with retry attempts and exponential backoff", async () => {
    await enqueuePrReviewJob({
      jobId: "pr-job-1",
      pullRequestId: "pr-1",
      repositoryId: "repo-1",
      commitSha: "sha1",
    });

    const jobs = await inspectQueue.getJobs(["waiting"]);
    const job = jobs.find((j) => j.data.jobId === "pr-job-1");
    expect(job).toBeDefined();
    expect(job?.opts.attempts).toBe(3);
    expect(job?.opts.backoff).toEqual({ type: "exponential", delay: 2000 });
  });
});
