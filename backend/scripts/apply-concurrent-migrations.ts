// backend/scripts/apply-concurrent-migrations.ts
//
// CREATE/DROP/REINDEX INDEX CONCURRENTLY cannot run inside a transaction
// block, but `prisma migrate deploy` unconditionally wraps every
// migration file in one — so any migration using CONCURRENTLY can never
// be applied via plain `prisma migrate deploy`. This script applies such
// migrations manually (one pg.Client.query() call per statement — each
// call is its own autocommit transaction, never batched into one
// multi-statement message) and then records them as applied via
// `prisma migrate resolve --applied`, so the normal `migrate deploy` step
// that runs afterward sees them as already done and skips them.
//
// Run with: npx tsx backend/scripts/apply-concurrent-migrations.ts
// Must run BEFORE `prisma migrate deploy` in any environment.

import "dotenv/config";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "prisma", "migrations");

// Every migration that uses CONCURRENTLY DDL — add new names here as they're written.
const CONCURRENT_MIGRATIONS = ["20260824180000_fts_split_identifier_words", "20260824180500_fts_split_acronym_boundary"];

// Splits a migration.sql file into top-level statements. Statements are
// separated by a blank line in every migration this script handles —
// controlled by us at authoring time, not a general SQL parser. Each
// statement must not contain an internal blank line (true today: single
// DDL lines and single-line $$ function bodies).
function splitStatements(sql: string): string[] {
  return sql
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0 && !block.startsWith("--"));
}

async function isAlreadyApplied(client: Client, name: string): Promise<boolean> {
  const result = await client.query(`SELECT 1 FROM _prisma_migrations WHERE migration_name = $1 AND finished_at IS NOT NULL`, [
    name,
  ]);
  return (result.rowCount ?? 0) > 0;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    for (const name of CONCURRENT_MIGRATIONS) {
      if (await isAlreadyApplied(client, name)) {
        console.log(`${name}: already applied, skipping`);
        continue;
      }

      console.log(`${name}: applying manually (outside a transaction)...`);
      const sql = readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf-8");
      const statements = splitStatements(sql);

      for (const statement of statements) {
        console.log(`  -> ${statement.split("\n")[0].slice(0, 80)}...`);
        await client.query(statement);
      }

      console.log(`${name}: applied. Marking as resolved in Prisma's migration history...`);
      execSync(`npx prisma migrate resolve --applied "${name}"`, {
        cwd: join(__dirname, ".."),
        stdio: "inherit",
        env: process.env,
      });
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
