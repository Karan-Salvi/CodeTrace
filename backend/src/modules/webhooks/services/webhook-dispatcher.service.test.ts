import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "../../../database/client.js";
import { handlePushEvent, handlePullRequestEvent } from "./webhook-dispatcher.service.js";
import * as indexJobProducer from "../../../queues/producers/index-job.producer.js";
import * as prReviewProducer from "../../../queues/producers/pr-review.producer.js";

async function makeRepo(revoked: boolean) {
  const user = await prisma.user.create({
    data: { githubId: BigInt(Math.floor(Math.random() * 1_000_000_000)), username: "octocat", githubAccessToken: "enc" },
  });
  const installation = await prisma.repositoryInstallation.create({
    data: {
      userId: user.id,
      githubInstallationId: BigInt(Math.floor(Math.random() * 1_000_000_000)),
      permissions: {},
      revokedAt: revoked ? new Date() : null,
    },
  });
  const repository = await prisma.repository.create({
    data: {
      userId: user.id,
      installationId: installation.id,
      owner: "octocat",
      name: "hello-world",
      githubUrl: "https://github.com/octocat/hello-world",
      defaultBranch: "main",
    },
  });
  return repository;
}

describe("webhook-dispatcher.service", () => {
  beforeEach(async () => {
    await prisma.pullRequest.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.pullRequest.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("handlePushEvent does not enqueue an index job for a repo whose installation is revoked", async () => {
    // security.md: "revoking access must stop all future indexing/webhook
    // processing for that installation immediately."
    const enqueueSpy = vi.spyOn(indexJobProducer, "enqueueIndexJob").mockResolvedValue(undefined);
    enqueueSpy.mockClear();
    const repo = await makeRepo(true);

    await handlePushEvent({
      after: "sha1",
      repository: { full_name: `${repo.owner}/${repo.name}`, id: 1 },
      installation: { id: 1 },
    });

    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it("handlePushEvent enqueues an index job and creates an IndexJob row for a repo with an active installation", async () => {
    const enqueueSpy = vi.spyOn(indexJobProducer, "enqueueIndexJob").mockResolvedValue(undefined);
    enqueueSpy.mockClear();
    const repo = await makeRepo(false);
    
    // Set to a terminal status so it allows trigger
    await prisma.repository.update({ where: { id: repo.id }, data: { status: "INDEXED" } });

    await handlePushEvent({
      after: "sha1",
      repository: { full_name: `${repo.owner}/${repo.name}`, id: 1 },
      installation: { id: 1 },
    });

    expect(enqueueSpy).toHaveBeenCalledTimes(1);
    
    const indexJobs = await prisma.indexJob.findMany({ where: { repositoryId: repo.id } });
    expect(indexJobs).toHaveLength(1);
    expect(indexJobs[0].type).toBe("INCREMENTAL");
    expect(indexJobs[0].status).toBe("PENDING");
    
    expect(enqueueSpy).toHaveBeenCalledWith(expect.objectContaining({ jobId: indexJobs[0].id, repositoryId: repo.id, type: "INCREMENTAL" }));
  });

  it("handlePushEvent ignores pushes to already-indexing repos without throwing", async () => {
    const enqueueSpy = vi.spyOn(indexJobProducer, "enqueueIndexJob").mockResolvedValue(undefined);
    enqueueSpy.mockClear();
    const repo = await makeRepo(false);
    
    // Non-terminal status
    await prisma.repository.update({ where: { id: repo.id }, data: { status: "CLONING" } });

    // Ensure it doesn't throw
    await expect(handlePushEvent({
      after: "sha1",
      repository: { full_name: `${repo.owner}/${repo.name}`, id: 1 },
      installation: { id: 1 },
    })).resolves.toBeUndefined();

    // Ensure it didn't create a job
    expect(enqueueSpy).not.toHaveBeenCalled();
    const indexJobs = await prisma.indexJob.count({ where: { repositoryId: repo.id } });
    expect(indexJobs).toBe(0);
  });

  it("handlePushEvent rejects concurrent double-pushes properly", async () => {
    const enqueueSpy = vi.spyOn(indexJobProducer, "enqueueIndexJob").mockResolvedValue(undefined);
    enqueueSpy.mockClear();
    const repo = await makeRepo(false);
    
    await prisma.repository.update({ where: { id: repo.id }, data: { status: "INDEXED" } });

    const p1 = handlePushEvent({
      after: "sha1",
      repository: { full_name: `${repo.owner}/${repo.name}`, id: 1 },
      installation: { id: 1 },
    });
    const p2 = handlePushEvent({
      after: "sha2",
      repository: { full_name: `${repo.owner}/${repo.name}`, id: 1 },
      installation: { id: 1 },
    });

    await Promise.all([p1, p2]);

    expect(enqueueSpy).toHaveBeenCalledTimes(1);
    const indexJobs = await prisma.indexJob.findMany({ where: { repositoryId: repo.id } });
    expect(indexJobs).toHaveLength(1);
  });

  it("handlePullRequestEvent does not enqueue a review job for a repo whose installation is revoked", async () => {
    const enqueueSpy = vi.spyOn(prReviewProducer, "enqueuePrReviewJob").mockResolvedValue(undefined);
    enqueueSpy.mockClear();
    const repo = await makeRepo(true);

    await handlePullRequestEvent({
      action: "opened",
      number: 1,
      repository: { full_name: `${repo.owner}/${repo.name}`, id: 1 },
      pull_request: {
        title: "test",
        user: { login: "octocat" },
        base: { sha: "base1" },
        head: { sha: "head1" },
      },
    });

    expect(enqueueSpy).not.toHaveBeenCalled();
  });
});
