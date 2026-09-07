#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mark_applied() {
  npx prisma migrate resolve --applied "$1" 2>/dev/null || true
}

clear_failed() {
  npx prisma migrate resolve --rolled-back "$1" 2>/dev/null || true
}

bootstrap_sql_init() {
  echo "[migrate-deploy] Bootstrapping from SQL init schema..."

  clear_failed "202603250002_add_device_useful_life"

  echo "  -> 202603250001_add_asset_equipment_value"
  npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "equipment_value" DOUBLE PRECISION;
SQL
  mark_applied "202603250001_add_asset_equipment_value"

  echo "  -> 202603250002_add_device_useful_life (skipped — SQL init has no device_type)"
  mark_applied "202603250002_add_device_useful_life"

  echo "  -> 202603250003_add_asset_types"
  npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
CREATE TABLE IF NOT EXISTS "asset_types" (
  "id"                SERIAL PRIMARY KEY,
  "name"              VARCHAR(120) NOT NULL UNIQUE,
  "useful_life_years" INTEGER      NOT NULL DEFAULT 5,
  "is_active"         BOOLEAN      NOT NULL DEFAULT true,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "asset_types" ("name", "useful_life_years") VALUES
  ('Laptop',          5),
  ('PC Escritorio',   6),
  ('Servidor',        7),
  ('Impresora',       5),
  ('Monitor',         6),
  ('Otro',            5)
ON CONFLICT ("name") DO NOTHING;

ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "asset_type_id" INTEGER REFERENCES "asset_types"("id") ON DELETE SET NULL;

DROP TABLE IF EXISTS "device_useful_life";
SQL
  mark_applied "202603250003_add_asset_types"
}

echo "[migrate-deploy] Running Prisma migrations..."
set +e
MIGRATE_OUTPUT="$(npx prisma migrate deploy 2>&1)"
MIGRATE_EXIT=$?
set -e

if [[ $MIGRATE_EXIT -ne 0 ]]; then
  if echo "$MIGRATE_OUTPUT" | grep -qE 'P3005|P3009'; then
    bootstrap_sql_init
  else
    echo "$MIGRATE_OUTPUT"
    exit "$MIGRATE_EXIT"
  fi
fi

echo "[migrate-deploy] Applying supplemental SQL migrations..."
npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
CREATE TABLE IF NOT EXISTS _assetcore_sql_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

for file in "$ROOT/db/migrations"/*.sql; do
  base="$(basename "$file")"
  if [[ "$base" == ".gitkeep" ]]; then
    continue
  fi
  if psql "$DATABASE_URL" -tAqc "SELECT 1 FROM _assetcore_sql_migrations WHERE filename = '${base}' LIMIT 1" 2>/dev/null | grep -q 1; then
    echo "  -> $base (skip, already applied)"
    continue
  fi
  echo "  -> $base"
  npx prisma db execute --schema prisma/schema.prisma --file "$file"
  psql "$DATABASE_URL" -qc "INSERT INTO _assetcore_sql_migrations (filename) VALUES ('${base}') ON CONFLICT DO NOTHING"
done

echo "[migrate-deploy] Done."
