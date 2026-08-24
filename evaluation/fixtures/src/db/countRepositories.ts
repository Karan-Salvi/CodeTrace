export async function countRepositories(
  db: { query: (sql: string, params: unknown[]) => Promise<{ count: number }> },
  ownerId: string
) {
  const result = await db.query(`SELECT COUNT(*) as count FROM repositories WHERE owner_id = $1`, [ownerId]);
  return result.count;
}
