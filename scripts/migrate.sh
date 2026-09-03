#!/usr/bin/env bash
set -euo pipefail

# Two-pass deploy, same reasoning as .github/workflows/ci.yml and
# backend/scripts/apply-concurrent-migrations.ts: CREATE/DROP/REINDEX
# INDEX CONCURRENTLY (the fts_split_* migrations) cannot run inside a
# transaction — Postgres enforces this unconditionally, and this reliably
# fails against the real production image (confirmed with a real
# `docker run` — see apply-concurrent-migrations.ts's header comment for
# the full story). apply-concurrent-migrations.ts is idempotent (a no-op
# if already applied), so running it unconditionally here is always safe
# even if some future environment doesn't hit the failure. Runs inside the
# already-running backend container via `docker compose exec` so it
# reuses the container's real DATABASE_URL (env_file) and installed
# prisma/tsx — no separate DB connection info needed on the host running
# this script.
#
# Usage: ./scripts/migrate.sh [compose-file]
# Run from the repo root, AFTER `docker compose -f <file> up -d backend`
# (or the full stack) — the backend container must already be running.

COMPOSE_FILE="${1:-infra/docker-compose.single-vm.yml}"
# Only needed for compose to substitute ${POSTGRES_PASSWORD} etc. when
# parsing the file — `exec` targets an already-running container so it has
# no functional effect here, but omitting it prints "variable not set,
# defaulting to blank string" warnings on every invocation.
ENV_FILE="infra/env/.env.docker"

echo "==> Initial migration pass (fails on a CONCURRENTLY migration against the real production image — handled below)..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy || true

echo "==> Applying CONCURRENTLY index migrations..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend npx tsx scripts/apply-concurrent-migrations.ts

echo "==> Final migration pass (must succeed)..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy

echo "==> Migrations applied."
