import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../../database/client.js";
import { createInstallation } from "./installation.service.js";
import { connectRepository } from "./repository.service.js";

async function makeUser() {
  return prisma.user.create({
    data: {
      githubId: BigInt(Math.floor(Math.random() * 1_000_000_000)),
      username: "octocat",
      githubAccessToken: "enc",
    },
  });
}

function repoInput(installationId: string, n: number) {
  return {
    installationId,
    owner: "octocat",
    name: `repo-${n}`,
    githubUrl: `https://github.com/octocat/repo-${n}`,
    defaultBranch: "main",
  };
}

describe("repository.service connectRepository limit", () => {
  beforeEach(async () => {
    await prisma.indexJob.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.indexJob.deleteMany();
    await prisma.repository.deleteMany();
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("rejects a 3rd repository once 2 are already connected", async () => {
    const user = await makeUser();
    const installation = await createInstallation(user.id, BigInt(600), {});

    await connectRepository(user.id, repoInput(installation.id, 1));
    await connectRepository(user.id, repoInput(installation.id, 2));

    await expect(connectRepository(user.id, repoInput(installation.id, 3))).rejects.toMatchObject({
      statusCode: 409,
      code: "REPOSITORY_LIMIT_REACHED",
    });
  });
});
