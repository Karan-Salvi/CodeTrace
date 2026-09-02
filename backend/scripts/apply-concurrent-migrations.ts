// backend/scripts/apply-concurrent-migrations.ts
//
// CREATE/DROP/REINDEX INDEX CONCURRENTLY cannot run inside a transaction
// block — Postgres enforces this server-side, unconditionally
// (PreventInTransactionBlock). Whether `prisma migrate deploy` actually
// wraps a given migration file in a transaction has been observed to
// depend on the platform: reliably fails with "cannot run inside a
// transaction block" when run from a Windows host against this project's
// two CONCURRENTLY migrations, but succeeded outright (no error) when run
// via `docker compose exec` against the Linux backend image — same
// Prisma/schema-engine version and hash on both, so this looks like a
// genuine platform difference in the compiled engine, not a version
// difference. Real CI/prod both run Linux, so a plain `migrate deploy`
// may already just work there — but that's only confirmed for this
// project's dev Docker image, not the exact CI runner or production
// image, so this script (and the two-pass sequence around it in ci.yml /
// migrate.sh) stays as a safety net either way: it applies migrations
// manually (one pg.Client.query() call per statement — each call is its
// own autocommit transaction, never batched into one multi-statement
// message) and records them as applied via `prisma migrate resolve
// --applied`, so a normal `migrate deploy` afterward sees them as already
// done and skips them — whether or not that migrate deploy would have
// succeeded on its own.
//
// Run with: npx tsx backend/scripts/apply-concurrent-migrations.ts
// Safe to run any time — a no-op if the listed migrations are already applied.

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
