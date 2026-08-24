export async function findUserById(
  db: { query: (sql: string, params: unknown[]) => Promise<unknown> },
  userId: string
) {
  return db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
}
