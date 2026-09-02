#!/usr/bin/env bash
set -euo pipefail

# Two-pass deploy, same reasoning as .github/workflows/ci.yml and
# backend/scripts/apply-concurrent-migrations.ts: CREATE/DROP/REINDEX
# INDEX CONCURRENTLY (the fts_split_* migrations) cannot run inside a
# transaction — Postgres enforces this unconditionally. Whether
# `prisma migrate deploy` actually wraps a given migration in one has been
# observed to vary by platform (see apply-concurrent-migrations.ts's
# header comment for the full story) — the initial pass below may fail on
# the first CONCURRENTLY migration, or may succeed outright; either way
# apply-concurrent-migrations.ts is idempotent (a no-op if already
# applied), so this script handles both outcomes safely without needing
# to know in advance which one will happen on this particular host. Runs
# inside the already-running backend container via `docker compose exec`
# so it reuses the container's real DATABASE_URL (env_file) and installed
# prisma/tsx — no separate DB connection info needed on the host running
# this script.
#
# Usage: ./scripts/migrate.sh [compose-file]
# Run from the repo root, AFTER `docker compose -f <file> up -d backend`
# (or the full stack) — the backend container must already be running.

COMPOSE_FILE="${1:-infra/docker-compose.single-vm.yml}"

echo "==> Initial migration pass (may fail on a CONCURRENTLY migration, depending on platform — handled below either way)..."
docker compose -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy || true

echo "==> Applying CONCURRENTLY index migrations..."
docker compose -f "$COMPOSE_FILE" exec -T backend npx tsx scripts/apply-concurrent-migrations.ts

echo "==> Final migration pass (must succeed)..."
docker compose -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy

echo "==> Migrations applied."
