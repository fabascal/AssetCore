INSERT INTO permissions (code, label, description)
VALUES
  ('itam.config.read', 'Ver configuracion ITAM', 'Permite consultar catalogos ITAM'),
  ('itam.config.write', 'Gestionar configuracion ITAM', 'Permite crear y editar catalogos ITAM')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.code IN ('itam.config.read', 'itam.config.write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

UPDATE menus
SET required_permission = 'itam.config.read'
WHERE path = '/itam-config';
