-- Depreciación LISR (línea recta) — AssetCore
-- MOI en activo, tasa anual en tipo de activo

ALTER TABLE asset_types
  ADD COLUMN IF NOT EXISTS depreciation_rate DOUBLE PRECISION NOT NULL DEFAULT 0.30;

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS purchase_price DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS salvage_value DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Migrar valor existente como MOI (sin IVA)
UPDATE assets
SET purchase_price = equipment_value
WHERE purchase_price IS NULL AND equipment_value IS NOT NULL;

-- Tasas LISR orientativas para tipos comunes de TI (ajustar según contabilidad)
UPDATE asset_types SET depreciation_rate = 0.30 WHERE LOWER(name) LIKE '%laptop%' OR LOWER(name) LIKE '%comput%';
UPDATE asset_types SET depreciation_rate = 0.30 WHERE LOWER(name) LIKE '%servidor%' OR LOWER(name) LIKE '%server%';
UPDATE asset_types SET depreciation_rate = 0.30 WHERE LOWER(name) LIKE '%switch%' OR LOWER(name) LIKE '%router%';
UPDATE asset_types SET depreciation_rate = 0.10 WHERE LOWER(name) LIKE '%impresora%' OR LOWER(name) LIKE '%mobiliario%';
