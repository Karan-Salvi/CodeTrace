export async function transferOwnership(
  db: { updateOwner: (repoId: string, userId: string) => Promise<void>; revokeAccess: (repoId: string, userId: string) => Promise<void> },
  repositoryId: string,
  fromUserId: string,
  toUserId: string
) {
  await db.updateOwner(repositoryId, toUserId);
  await db.revokeAccess(repositoryId, fromUserId);
  return { transferred: repositoryId };
}