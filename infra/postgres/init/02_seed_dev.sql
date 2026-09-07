-- Development-only seed: demo users, assets, and tickets.
-- Not mounted in production docker-compose.

BEGIN;

INSERT INTO users (full_name, email, password_hash, role_id)
SELECT 'Admin AssetCore', 'admin@assetcore.local', '$2a$10$0YKwc7MNfJOuRdtbaWEQvu14exlnitWInLgLUbq5abYDHNecZgm/e', r.id
FROM roles r
WHERE r.name = 'admin'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (full_name, email, password_hash, role_id)
SELECT 'Tecnico Nivel 1', 'tecnico.n1@assetcore.local', '$2a$10$0YKwc7MNfJOuRdtbaWEQvuIbwjthdD7JyddKsoSpgJBF/yMHkNScG', r.id
FROM roles r
WHERE r.name = 'tech'
ON CONFLICT (email) DO NOTHING;

INSERT INTO assets (asset_code, brand, model, serial_number, status, specifications)
VALUES
  ('AST-DEMO001', 'Dell', 'Latitude 7420', 'SN-DELL-7420-001', 'ASSIGNED', '{"CPU":"Intel i7","RAM":"16GB","Almacenamiento":"512GB SSD"}'),
  ('AST-DEMO002', 'HP', 'EliteBook 840', 'SN-HP-840-002', 'AVAILABLE', '{"CPU":"Intel i5","RAM":"8GB","Almacenamiento":"256GB SSD"}'),
  ('AST-DEMO003', 'Cisco', 'Catalyst 9200', 'SN-CISCO-9200-003', 'MAINTENANCE', '{"Puertos":"48","Firmware":"17.9","Rol":"Core Switch"}'),
  ('AST-DEMO004', 'Dell', 'PowerEdge R740', 'SN-DELL-R740-004', 'ASSIGNED', '{"CPU":"2x Xeon Silver","RAM":"64GB","Storage":"4x 1TB SSD RAID10"}'),
  ('AST-DEMO005', 'HP', 'ProLiant DL380', 'SN-HP-DL380-005', 'AVAILABLE', '{"CPU":"Xeon Gold","RAM":"128GB","Storage":"2x 2TB NVMe"}')
ON CONFLICT (asset_code) DO NOTHING;

INSERT INTO tickets (title, description, status, priority, level, assigned_to_id, asset_id)
SELECT
  'Pantalla con parpadeo intermitente',
  'El usuario reporta flickering en monitor externo al conectar via docking.',
  'OPEN',
  'HIGH',
  '1',
  u.id,
  a.id
FROM users u
JOIN assets a ON a.asset_code = 'AST-DEMO001'
WHERE u.email = 'tecnico.n1@assetcore.local'
ON CONFLICT DO NOTHING;

UPDATE tickets
SET support_topic_id = (
  SELECT id FROM support_topics WHERE name = 'Falla de internet' LIMIT 1
)
WHERE support_topic_id IS NULL
  AND title = 'Pantalla con parpadeo intermitente';

INSERT INTO ticket_events (ticket_id, actor_user_id, action, details)
SELECT
  t.id,
  u.id,
  'CREATED',
  jsonb_build_object('status', t.status, 'level', t.level, 'note', 'Ticket inicial de seed')
FROM tickets t
JOIN users u ON u.email = 'tecnico.n1@assetcore.local'
WHERE t.title = 'Pantalla con parpadeo intermitente'
ON CONFLICT DO NOTHING;

COMMIT;
