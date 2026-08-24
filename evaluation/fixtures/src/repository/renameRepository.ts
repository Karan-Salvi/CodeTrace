export async function renameRepository(
  repositoryId: string,
  newName: string,
  db: { update: (id: string, data: object) => Promise<void> }
) {
  if (!newName.trim()) {
    throw new Error("Repository name cannot be empty");
  }
  await db.update(repositoryId, { name: newName });
  return { renamed: true };
}
