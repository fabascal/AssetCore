#!/usr/bin/env bash
# Backup AssetCore PostgreSQL database.
# Usage: ./infra/scripts/backup-db.sh [output_dir]
set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
CONTAINER="${BACKUP_CONTAINER:-assetcore-postgres}"
DB_USER="${POSTGRES_USER:-assetcore}"
DB_NAME="${POSTGRES_DB:-assetcore}"
STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$OUTPUT_DIR/assetcore_${STAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

mkdir -p "$OUTPUT_DIR"

echo "[backup] Dumping $DB_NAME from container $CONTAINER..."
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
echo "[backup] Saved: $FILE"

echo "[backup] Removing backups older than ${RETENTION_DAYS} days..."
find "$OUTPUT_DIR" -name 'assetcore_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

echo "[backup] Done."
