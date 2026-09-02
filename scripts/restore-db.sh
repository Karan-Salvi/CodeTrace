#!/usr/bin/env bash
set -euo pipefail

# Restores a backup produced by scripts/backup-db.sh. DESTRUCTIVE: drops
# and recreates the codetrace database, replacing everything currently in
# it with the dump's contents. Requires an explicit CONFIRM=yes to run, on
# top of the required backup-file argument -- an untested backup is not
# actually a backup, but this is also exactly the kind of command that
# should never fire from a typo or a copy-pasted example.
#
# Usage: CONFIRM=yes ./scripts/restore-db.sh backups/codetrace_20260101T000000Z.sql.gz [compose-file]

BACKUP_FILE="${1:?Usage: CONFIRM=yes ./scripts/restore-db.sh <backup-file.sql.gz> [compose-file]}"
COMPOSE_FILE="${2:-infra/docker-compose.single-vm.yml}"

if [ "${CONFIRM:-}" != "yes" ]; then
  echo "This will DROP and recreate the codetrace database, discarding everything currently in it." >&2
  echo "Re-run with CONFIRM=yes to proceed:" >&2
  echo "  CONFIRM=yes $0 $BACKUP_FILE $COMPOSE_FILE" >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "==> Dropping and recreating codetrace database..."
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U codetrace -d postgres -c "DROP DATABASE IF EXISTS codetrace;"
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U codetrace -d postgres -c "CREATE DATABASE codetrace;"

echo "==> Restoring $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U codetrace -d codetrace

echo "==> Restore complete. Re-run migrations to be safe: ./scripts/migrate.sh $COMPOSE_FILE"
