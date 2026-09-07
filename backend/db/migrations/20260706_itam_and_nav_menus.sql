-- ITAM / navegación faltante en prod (existía en dev, no en SQL init)

INSERT INTO menus (label, icon, path, parent_id, display_order, required_permission)
VALUES
  (
    'Configuracion ITAM',
    'settings-2',
    '/itam-config',
    (SELECT id FROM menus WHERE path = '/assets'),
    2,
    'assets.read'
  ),
  (
    'Ciclo de Vida',
    'refresh-cw',
    '/lifecycle-report',
    (SELECT id FROM menus WHERE path = '/assets'),
    3,
    'assets.read'
  ),
  (
    'Empresa',
    'building-2',
    '/settings/company',
    (SELECT id FROM menus WHERE path = '/settings'),
    3,
    'users.read'
  ),
  (
    'Proyectos',
    'gantt-chart',
    '/projects',
    NULL,
    22,
    'projects.read'
  )
ON CONFLICT (path) DO NOTHING;

-- Admin: asignar menús nuevos (y padres si faltan)
INSERT INTO role_menus (role_id, menu_id)
SELECT r.id, m.id
FROM roles r
CROSS JOIN menus m
WHERE r.name = 'admin'
  AND m.path IN (
    '/itam-config',
    '/lifecycle-report',
    '/settings/company',
    '/projects',
    '/assets',
    '/settings'
  )
ON CONFLICT (role_id, menu_id) DO NOTHING;
