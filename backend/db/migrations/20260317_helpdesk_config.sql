BEGIN;

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

ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS support_topic_id INTEGER REFERENCES support_topics(id) ON DELETE SET NULL;

INSERT INTO permissions (code, label, description)
VALUES
  ('helpdesk.config.read', 'Ver configuracion mesa de ayuda', 'Permite ver temas y niveles de soporte'),
  ('helpdesk.config.write', 'Gestionar configuracion mesa de ayuda', 'Permite crear/editar temas y niveles de soporte')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('helpdesk.config.read', 'helpdesk.config.write')
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO menus (label, icon, path, parent_id, display_order, required_permission)
VALUES
  ('Tickets', 'ticket', '/tickets/list', (SELECT id FROM menus WHERE path = '/tickets'), 1, 'tickets.read'),
  ('Configuracion', 'wrench', '/tickets/configuration', (SELECT id FROM menus WHERE path = '/tickets'), 2, 'helpdesk.config.read')
ON CONFLICT (path) DO NOTHING;

DELETE FROM menus WHERE path = '/settings/toasts';

UPDATE menus SET label = 'Inventario' WHERE path = '/assets';

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
        display_order = 1,
        required_permission = 'helpdesk.config.read'
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
    SELECT 1 FROM support_topic_levels l WHERE l.topic_id = t.id AND l.level_order = 1
  );

INSERT INTO support_topic_levels (topic_id, level_order, level_name, escalation_target, tech_user_id)
SELECT t.id, 2, 'Proveedor ISP', 'PROVIDER', NULL
FROM support_topics t
WHERE t.name = 'Falla de internet'
  AND NOT EXISTS (
    SELECT 1 FROM support_topic_levels l WHERE l.topic_id = t.id AND l.level_order = 2
  );

INSERT INTO support_topic_levels (topic_id, level_order, level_name, escalation_target, tech_user_id)
SELECT t.id, 1, 'Mesa de Ayuda TI', 'TECH', u.id
FROM support_topics t
LEFT JOIN users u ON u.email = 'tecnico.n1@assetcore.local'
WHERE t.name = 'Falla de correo'
  AND NOT EXISTS (
    SELECT 1 FROM support_topic_levels l WHERE l.topic_id = t.id AND l.level_order = 1
  );

INSERT INTO support_topic_levels (topic_id, level_order, level_name, escalation_target, tech_user_id)
SELECT t.id, 2, 'Proveedor de Correo', 'PROVIDER', NULL
FROM support_topics t
WHERE t.name = 'Falla de correo'
  AND NOT EXISTS (
    SELECT 1 FROM support_topic_levels l WHERE l.topic_id = t.id AND l.level_order = 2
  );

COMMIT;
