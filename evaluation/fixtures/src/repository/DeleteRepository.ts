export async function deleteRepository(db: { delete: (id: string) => Promise<void> }, repositoryId: string) {
  await db.delete(repositoryId);
  return { deleted: repositoryId };
}