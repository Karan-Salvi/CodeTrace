export async function findUserByEmail(db: { query: (sql: string) => Promise<unknown> }, email: string) {
  return db.query(`SELECT * FROM users WHERE email = '${email}'`);
}