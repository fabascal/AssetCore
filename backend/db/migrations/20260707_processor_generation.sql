ALTER TABLE catalog_processors ADD COLUMN IF NOT EXISTS generation TEXT;

ALTER TABLE catalog_processors DROP CONSTRAINT IF EXISTS catalog_processors_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS catalog_processors_name_generation_key
  ON catalog_processors (name, COALESCE(generation, ''));
