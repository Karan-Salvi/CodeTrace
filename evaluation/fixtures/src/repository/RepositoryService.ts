import { getActiveInstallation } from "./InstallationService";

export async function connectRepository(userId: string, installationId: string, owner: string, name: string) {
  const installation = await getActiveInstallation(installationId);
  return { userId, installationId: installation.id, owner, name };
}