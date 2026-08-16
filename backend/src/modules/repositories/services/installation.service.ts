import { prisma } from "../../../database/client.js";
import type { Prisma } from "@prisma/client";

export async function createInstallation(
  userId: string,
  githubInstallationId: bigint,
  permissions: Prisma.JsonValue
) {
  return prisma.repositoryInstallation.create({
    data: { userId, githubInstallationId, permissions: permissions ?? {} },
  });
}

export async function revokeInstallation(githubInstallationId: bigint) {
  return prisma.repositoryInstallation.updateMany({
    where: { githubInstallationId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getActiveInstallation(id: string) {
  const installation = await prisma.repositoryInstallation.findUnique({ where: { id } });
  if (!installation || installation.revokedAt) return null;
  return installation;
}
