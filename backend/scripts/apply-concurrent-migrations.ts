// backend/scripts/apply-concurrent-migrations.ts
//
// CREATE/DROP/REINDEX INDEX CONCURRENTLY cannot run inside a transaction
// block — Postgres enforces this server-side, unconditionally
// (PreventInTransactionBlock). Confirmed with a real `docker run` against
// the real production image (backend/Dockerfile): `prisma migrate deploy`
// reliably fails with "cannot run inside a transaction block" on the
// first CONCURRENTLY migration, same as from a Windows host. (One earlier
// test against backend/Dockerfile.dev's dev container succeeded outright
// with no error — same Prisma/schema-engine version and the same openssl
// fallback warning as the production image, so whatever caused that
// isn't simply "Linux vs Windows" or an engine-binary difference; the
// cause wasn't tracked down further, and doesn't matter — what matters is
// the REAL deploy artifact reliably needs this.) This script applies
// migrations manually (one pg.Client.query() call per statement — each
// call is its own autocommit transaction, never batched into one
// multi-statement message) and records them as applied via
// `prisma migrate resolve --applied`, so a normal `migrate deploy`
// afterward sees them as already done and skips them.
//
// Run with: npx tsx backend/scripts/apply-concurrent-migrations.ts
// Safe to run any time — a no-op if the listed migrations are already applied.

import "dotenv/config";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

// process.cwd(), not __dirname: this script is compiled by tsc into
// dist/scripts/apply-concurrent-migrations.js for production (tsc
// preserves the scripts/ subdirectory under dist/), so __dirname-relative
// paths would resolve one level wrong there (dist/prisma/migrations
// instead of the real prisma/migrations, which lives at the backend
// package root, a sibling of dist/ — not nested inside it). cwd is stable
// across both dev (tsx runs the source in place, WORKDIR is the backend
// root) and production (WORKDIR is /app, also the backend root) — always
// run this from the backend package root, matching how migrate.sh and
// `npx prisma migrate deploy` are both invoked.
const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

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
      // No explicit cwd: inherits process.cwd(), same backend-root
      // assumption as MIGRATIONS_DIR above.
      execSync(`npx prisma migrate resolve --applied "${name}"`, {
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
