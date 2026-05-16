-- Create asset_types catalog
CREATE TABLE "asset_types" (
  "id"                SERIAL PRIMARY KEY,
  "name"              VARCHAR(120) NOT NULL UNIQUE,
  "useful_life_years" INTEGER      NOT NULL DEFAULT 5,
  "is_active"         BOOLEAN      NOT NULL DEFAULT true,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed defaults (mapped from old DeviceType enum)
INSERT INTO "asset_types" ("name", "useful_life_years") VALUES
  ('Laptop',          5),
  ('PC Escritorio',   6),
  ('Servidor',        7),
  ('Impresora',       5),
  ('Monitor',         6),
  ('Otro',            5);

-- Add FK column to assets
ALTER TABLE "assets" ADD COLUMN "asset_type_id" INTEGER REFERENCES "asset_types"("id") ON DELETE SET NULL;

-- Migrate existing device_type values → asset_type_id
UPDATE "assets" SET "asset_type_id" = (
  SELECT "id" FROM "asset_types" WHERE "name" = CASE "device_type"
    WHEN 'LAPTOP'   THEN 'Laptop'
    WHEN 'DESKTOP'  THEN 'PC Escritorio'
    WHEN 'SERVER'   THEN 'Servidor'
    WHEN 'PRINTER'  THEN 'Impresora'
    WHEN 'MONITOR'  THEN 'Monitor'
    ELSE 'Otro'
  END
);

-- Drop old device_type column
ALTER TABLE "assets" DROP COLUMN "device_type";

-- Drop old device_useful_life table if it exists
DROP TABLE IF EXISTS "device_useful_life";
