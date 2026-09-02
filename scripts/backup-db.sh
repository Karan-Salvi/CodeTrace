#!/usr/bin/env bash
set -euo pipefail

# Real risk with zero mitigation before this: the single VM has no backup
# strategy anywhere -- a disk failure loses every repo, chunk, embedding,
# and PR review permanently. This dumps Postgres via `docker compose exec`
# (reuses the container's own pg_dump, no separate client install needed
# on the host) into a local, gzip-compressed, timestamped file and deletes
# anything older than RETENTION_DAYS. Off-VM storage (S3, rsync to another
# host, etc.) is a natural next step once a storage target is picked --
# not built here since guessing a provider would be pure speculation right
# now. Wire this into a host cron job, e.g.:
#   0 2 * * * cd /path/to/CodeTrace && ./scripts/backup-db.sh >> /var/log/codetrace-backup.log 2>&1
#
# Usage: ./scripts/backup-db.sh [compose-file]
# Run from the repo root, with the postgres service already running.

COMPOSE_FILE="${1:-infra/docker-compose.single-vm.yml}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$BACKUP_DIR/codetrace_${TIMESTAMP}.sql.gz"

echo "==> Dumping database to $OUT_FILE..."
docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U codetrace codetrace | gzip > "$OUT_FILE"

DUMP_SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo "==> Wrote $OUT_FILE ($DUMP_SIZE)"

echo "==> Removing backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name 'codetrace_*.sql.gz' -mtime +"$RETENTION_DAYS" -print -delete

echo "==> Backup complete."
