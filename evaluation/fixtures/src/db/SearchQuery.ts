export async function searchRepositories(db: { query: (sql: string) => Promise<unknown> }, term: string) {
  const sql = "SELECT * FROM repositories WHERE name LIKE '%" + term + "%'";
  return db.query(sql);
}