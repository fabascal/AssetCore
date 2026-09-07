-- Parque Vehicular: tablas, permisos, menus

CREATE TYPE vehicle_type AS ENUM ('SEDAN', 'SUV', 'PICKUP', 'VAN', 'TRUCK', 'MOTORCYCLE', 'OTHER');
CREATE TYPE vehicle_document_type AS ENUM ('CARTA_COMPROMISO', 'TARJETA_CIRCULACION', 'POLIZA_SEGURO', 'FACTURA_MANTENIMIENTO', 'FACTURA_COMPRA', 'VERIFICACION', 'OTRO');

CREATE TABLE IF NOT EXISTS vehicles (
  id                SERIAL PRIMARY KEY,
  vehicle_code      TEXT NOT NULL UNIQUE,
  brand             TEXT NOT NULL,
  model             TEXT NOT NULL,
  year              INTEGER,
  color             TEXT,
  plate_number      TEXT NOT NULL UNIQUE,
  serial_number     TEXT UNIQUE,
  engine_number     TEXT,
  vehicle_type      vehicle_type NOT NULL DEFAULT 'OTHER',
  mileage           INTEGER,
  status            asset_status NOT NULL DEFAULT 'AVAILABLE',
  purchase_date     TIMESTAMPTZ,
  purchase_price    DOUBLE PRECISION,
  salvage_value     DOUBLE PRECISION NOT NULL DEFAULT 0,
  warranty_end      TIMESTAMPTZ,
  useful_life_years INTEGER,
  end_of_life_date  TIMESTAMPTZ,
  location_id       INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  assigned_to_name  TEXT,
  assigned_to_date  TIMESTAMPTZ,
  decommission_reason asset_decommission_reason,
  decommission_notes  TEXT,
  decommissioned_at   TIMESTAMPTZ,
  decommissioned_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  specifications    JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id             SERIAL PRIMARY KEY,
  vehicle_id     INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  document_type  vehicle_document_type NOT NULL,
  description    TEXT,
  expires_at     TIMESTAMPTZ,
  filename       TEXT NOT NULL,
  original_name  TEXT NOT NULL,
  mime_type      TEXT NOT NULL,
  size_bytes     INTEGER NOT NULL,
  uploaded_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permisos
INSERT INTO permissions (code, label, description)
VALUES
  ('vehicles.read', 'Ver parque vehicular', 'Permite consultar vehiculos'),
  ('vehicles.write', 'Gestionar parque vehicular', 'Permite crear y editar vehiculos')
ON CONFLICT (code) DO NOTHING;

-- Asignar permisos a rol admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.code IN ('vehicles.read', 'vehicles.write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Menu padre
INSERT INTO menus (label, icon, path, display_order, required_permission, is_active)
VALUES ('Parque Vehicular', 'truck', '/vehicles', 21, 'vehicles.read', true)
ON CONFLICT (path) DO NOTHING;

-- Submenu
INSERT INTO menus (label, icon, path, parent_id, display_order, required_permission, is_active)
SELECT 'Vehiculos', 'car', '/vehicles/list', m.id, 1, 'vehicles.read', true
FROM menus m WHERE m.path = '/vehicles'
ON CONFLICT (path) DO NOTHING;

-- Asignar menus a rol admin
INSERT INTO role_menus (role_id, menu_id)
SELECT r.id, m.id
FROM roles r
CROSS JOIN menus m
WHERE r.name = 'admin'
  AND m.path IN ('/vehicles', '/vehicles/list')
ON CONFLICT (role_id, menu_id) DO NOTHING;
