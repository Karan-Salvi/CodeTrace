import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../../database/client.js";
import {
  createInstallation,
  revokeInstallation,
  getActiveInstallation,
} from "./installation.service.js";

async function makeUser() {
  return prisma.user.create({
    data: {
      githubId: BigInt(Math.floor(Math.random() * 1_000_000_000)),
      username: "octocat",
      githubAccessToken: "enc",
    },
  });
}

describe("installation.service", () => {
  beforeEach(async () => {
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.repositoryInstallation.deleteMany();
    await prisma.user.deleteMany();
  });

  it("creates an installation", async () => {
    const user = await makeUser();
    const installation = await createInstallation(user.id, BigInt(555), { contents: "read" });
    expect(installation.githubInstallationId).toBe(BigInt(555));
    expect(installation.revokedAt).toBeNull();
  });

  it("getActiveInstallation returns null for a revoked installation", async () => {
    const user = await makeUser();
    const installation = await createInstallation(user.id, BigInt(556), {});
    await revokeInstallation(BigInt(556));

    const active = await getActiveInstallation(installation.id);
    expect(active).toBeNull();
  });

  it("getActiveInstallation returns the row when not revoked", async () => {
    const user = await makeUser();
    const installation = await createInstallation(user.id, BigInt(557), {});
    const active = await getActiveInstallation(installation.id);
    expect(active?.id).toBe(installation.id);
  });
});
