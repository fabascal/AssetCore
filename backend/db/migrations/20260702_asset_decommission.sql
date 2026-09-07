-- Registro de baja de activos: motivo, notas, usuario y fecha

CREATE TYPE asset_decommission_reason AS ENUM (
  'END_OF_LIFE',
  'DAMAGE',
  'THEFT',
  'OTHER'
);

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS decommission_reason asset_decommission_reason,
  ADD COLUMN IF NOT EXISTS decommission_notes TEXT,
  ADD COLUMN IF NOT EXISTS decommissioned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decommissioned_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
