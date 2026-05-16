CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$
BEGIN
  CREATE TYPE asset_status AS ENUM ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'SCRAP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;
DO $$
BEGIN
  CREATE TYPE ticket_status AS ENUM ('OPEN', 'IN_PROGRESS', 'PROVIDER', 'CLOSED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;
DO $$
BEGIN
  CREATE TYPE ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;
DO $$
BEGIN
  CREATE TYPE ticket_level AS ENUM ('1', '2', 'PROVEEDOR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;

BEGIN;

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(120) NOT NULL UNIQUE,
  label VARCHAR(120) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_topics (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_topic_levels (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES support_topics(id) ON DELETE CASCADE,
  level_order INTEGER NOT NULL,
  level_name VARCHAR(120) NOT NULL,
  escalation_target VARCHAR(20) NOT NULL,
  tech_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(topic_id, level_order)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS role_menus (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, menu_id)
);

CREATE TABLE IF NOT EXISTS menus (
  id SERIAL PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  icon VARCHAR(120),
  path VARCHAR(255) NOT NULL UNIQUE,
  parent_id INTEGER REFERENCES menus(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  required_permission VARCHAR(120) REFERENCES permissions(code),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  asset_code VARCHAR(32) NOT NULL UNIQUE,
  brand VARCHAR(120) NOT NULL,
  model VARCHAR(160) NOT NULL,
  serial_number VARCHAR(160) NOT NULL UNIQUE,
  status asset_status NOT NULL DEFAULT 'AVAILABLE',
  specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  status ticket_status NOT NULL DEFAULT 'OPEN',
  priority ticket_priority NOT NULL DEFAULT 'MEDIUM',
  level ticket_level NOT NULL DEFAULT '1',
  support_topic_id INTEGER REFERENCES support_topics(id) ON DELETE SET NULL,
  assigned_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_events (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incoming_messages (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(50) NOT NULL,
  sender VARCHAR(255),
  subject VARCHAR(255),
  body TEXT NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_intent VARCHAR(80),
  ai_action TEXT,
  detected_asset_code VARCHAR(50),
  detected_serial_number VARCHAR(180),
  created_ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de SLA (Service Level Agreement)
CREATE TABLE IF NOT EXISTS sla_policies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  priority ticket_priority NOT NULL,
  level ticket_level NOT NULL,
  escalation_hours_level_1_to_2 INTEGER NOT NULL DEFAULT 4,
  escalation_hours_level_2_to_provider INTEGER NOT NULL DEFAULT 8,
  auto_escalate BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla de tracking de escalaciones automáticas
CREATE TABLE IF NOT EXISTS ticket_escalation_tracking (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  current_level ticket_level NOT NULL,
  escalation_due_at TIMESTAMPTZ NOT NULL,
  is_escalated BOOLEAN NOT NULL DEFAULT FALSE,
  auto_escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ticket_id, current_level)
);

INSERT INTO roles (name, description)
VALUES
  ('admin', 'Administrador de plataforma'),
  ('tech', 'Tecnico de ITAM')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (code, label, description)
VALUES
  ('dashboard.read', 'Ver dashboard', 'Permite visualizar resumen general'),
  ('menus.read', 'Ver menus', 'Permite cargar arbol de navegacion'),
  ('assets.read', 'Ver activos', 'Permite listar activos'),
  ('assets.write', 'Gestionar activos', 'Permite crear/editar activos'),
  ('tickets.read', 'Ver tickets', 'Permite listar tickets'),
  ('tickets.write', 'Gestionar tickets', 'Permite crear/editar tickets'),
  ('ai.logs.read', 'Ver logs IA', 'Permite monitorear mensajes y acciones de IA'),
  ('users.read', 'Ver usuarios', 'Permite listar usuarios'),
  ('users.write', 'Gestionar usuarios', 'Permite crear/editar usuarios'),
  ('helpdesk.config.read', 'Ver configuracion mesa de ayuda', 'Permite ver temas y niveles de soporte'),
  ('helpdesk.config.write', 'Gestionar configuracion mesa de ayuda', 'Permite crear/editar temas y niveles de soporte'),
  ('auth.login', 'Iniciar sesion', 'Permite autenticarse en la plataforma')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('dashboard.read', 'menus.read', 'assets.read', 'assets.write', 'tickets.read', 'tickets.write', 'ai.logs.read', 'users.read', 'helpdesk.config.read', 'auth.login')
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('users.write', 'helpdesk.config.write')
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('dashboard.read', 'menus.read', 'assets.read', 'tickets.read', 'tickets.write', 'auth.login')
WHERE r.name = 'tech'
ON CONFLICT (role_id, permission_id) DO NOTHING;

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

INSERT INTO sla_policies (name, description, priority, level, escalation_hours_level_1_to_2, escalation_hours_level_2_to_provider, auto_escalate)
VALUES
  ('CRITICAL', 'Tickets critcos escalada cada 2 horas', 'CRITICAL', '1', 2, 4, TRUE),
  ('HIGH', 'Tickets altos escalada cada 4 horas', 'HIGH', '1', 4, 8, TRUE),
  ('MEDIUM', 'Tickets medios escalada cada 8 horas', 'MEDIUM', '1', 8, 16, FALSE),
  ('LOW', 'Tickets bajos sin escalada automática', 'LOW', '1', 24, 48, FALSE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO menus (label, icon, path, parent_id, display_order, required_permission)
VALUES
  ('Dashboard', 'layout-dashboard', '/dashboard', NULL, 10, 'dashboard.read'),
  ('Inventario', 'box', '/assets', NULL, 20, 'assets.read'),
  ('Mesa de Ayuda', 'life-buoy', '/tickets', NULL, 25, 'tickets.read'),
  ('Logs IA', 'bot', '/ai-logs', NULL, 27, 'ai.logs.read'),
  ('Configuraciones', 'settings', '/settings', NULL, 30, 'users.read')
ON CONFLICT (path) DO NOTHING;

UPDATE menus SET label = 'Inventario' WHERE path = '/assets';

INSERT INTO menus (label, icon, path, parent_id, display_order, required_permission)
VALUES
  ('Activos', 'hard-drive', '/assets/list', (SELECT id FROM menus WHERE path = '/assets'), 1, 'assets.read'),
  ('Nuevo Activo', 'plus-circle', '/assets/new', (SELECT id FROM menus WHERE path = '/assets'), 2, 'assets.write'),
  ('Tickets', 'ticket', '/tickets/list', (SELECT id FROM menus WHERE path = '/tickets'), 1, 'tickets.read'),
  ('Configuracion', 'wrench', '/tickets/configuration', (SELECT id FROM menus WHERE path = '/tickets'), 2, 'helpdesk.config.read'),
  ('Usuarios', 'users', '/users', (SELECT id FROM menus WHERE path = '/settings'), 1, 'users.read'),
  ('Roles', 'shield', '/users/roles', (SELECT id FROM menus WHERE path = '/settings'), 2, 'users.write')
ON CONFLICT (path) DO NOTHING;

DELETE FROM menus WHERE path = '/settings/toasts';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM menus WHERE path = '/tickets/list') THEN
    UPDATE menus
    SET label = 'Tickets',
        parent_id = (SELECT id FROM menus WHERE path = '/tickets'),
        display_order = 1,
        required_permission = 'tickets.read'
    WHERE path = '/tickets/list';
  END IF;

  IF EXISTS (SELECT 1 FROM menus WHERE path = '/tickets/configuration') THEN
    UPDATE menus
    SET label = 'Configuracion',
        parent_id = (SELECT id FROM menus WHERE path = '/tickets'),
        display_order = 2,
        required_permission = 'helpdesk.config.read'
    WHERE path = '/tickets/configuration';
  END IF;

  IF EXISTS (SELECT 1 FROM menus WHERE path = '/settings/helpdesk')
     AND NOT EXISTS (SELECT 1 FROM menus WHERE path = '/tickets/configuration') THEN
    UPDATE menus
    SET label = 'Configuracion',
        path = '/tickets/configuration',
        parent_id = (SELECT id FROM menus WHERE path = '/tickets'),
        display_order = 1
    WHERE path = '/settings/helpdesk';
  END IF;

  IF EXISTS (SELECT 1 FROM menus WHERE path = '/settings/helpdesk')
     AND EXISTS (SELECT 1 FROM menus WHERE path = '/tickets/configuration') THEN
    DELETE FROM menus WHERE path = '/settings/helpdesk';
  END IF;
END $$;

INSERT INTO support_topics (name, description, is_active)
VALUES
  ('Falla de internet', 'Incidentes de conectividad en red local, wifi o salida a internet.', TRUE),
  ('Falla de correo', 'Problemas de envio, recepcion o acceso a correo institucional.', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO support_topic_levels (topic_id, level_order, level_name, escalation_target, tech_user_id)
SELECT t.id, 1, 'Agente Tech', 'TECH', u.id
FROM support_topics t
LEFT JOIN users u ON u.email = 'tecnico.n1@assetcore.local'
WHERE t.name = 'Falla de internet'
  AND NOT EXISTS (
    SELECT 1
    FROM support_topic_levels l
    WHERE l.topic_id = t.id AND l.level_order = 1
  );

INSERT INTO support_topic_levels (topic_id, level_order, level_name, escalation_target, tech_user_id)
SELECT t.id, 2, 'Proveedor ISP', 'PROVIDER', NULL
FROM support_topics t
WHERE t.name = 'Falla de internet'
  AND NOT EXISTS (
    SELECT 1
    FROM support_topic_levels l
    WHERE l.topic_id = t.id AND l.level_order = 2
  );

INSERT INTO support_topic_levels (topic_id, level_order, level_name, escalation_target, tech_user_id)
SELECT t.id, 1, 'Mesa de Ayuda TI', 'TECH', u.id
FROM support_topics t
LEFT JOIN users u ON u.email = 'tecnico.n1@assetcore.local'
WHERE t.name = 'Falla de correo'
  AND NOT EXISTS (
    SELECT 1
    FROM support_topic_levels l
    WHERE l.topic_id = t.id AND l.level_order = 1
  );

INSERT INTO support_topic_levels (topic_id, level_order, level_name, escalation_target, tech_user_id)
SELECT t.id, 2, 'Proveedor de Correo', 'PROVIDER', NULL
FROM support_topics t
WHERE t.name = 'Falla de correo'
  AND NOT EXISTS (
    SELECT 1
    FROM support_topic_levels l
    WHERE l.topic_id = t.id AND l.level_order = 2
  );

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
