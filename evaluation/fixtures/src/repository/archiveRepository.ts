export async function archiveRepository(
  repositoryId: string,
  db: { update: (id: string, data: object) => Promise<void> }
) {
  await db.update(repositoryId, { status: "ARCHIVED" });
  return { archived: true };
}
