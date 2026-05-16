-- =============================================
-- Migración: Menú y permisos de Reportes
-- Fecha: 2026-03-23
-- =============================================

-- Permiso de reportes
INSERT INTO permissions (code, label, description)
VALUES
  ('reports.read', 'Ver Reportes', 'Permite consultar reportes de activos y tickets')
ON CONFLICT (code) DO NOTHING;

-- Asignar permiso a admin (id=1)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE code = 'reports.read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Asignar permiso a tech (id=2)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE code = 'reports.read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Menú padre: Reportes
INSERT INTO menus (label, icon, path, parent_id, display_order, required_permission)
VALUES
  ('Reportes', 'bar-chart-3', '/reports', NULL, 23, 'reports.read')
ON CONFLICT (path) DO NOTHING;

-- Sub-menús de reportes
INSERT INTO menus (label, icon, path, parent_id, display_order, required_permission)
VALUES
  ('Inventario General', 'hard-drive', '/reports/assets-inventory', (SELECT id FROM menus WHERE path = '/reports'), 1, 'assets.read'),
  ('Depreciación', 'dollar-sign', '/reports/depreciation', (SELECT id FROM menus WHERE path = '/reports'), 2, 'assets.read'),
  ('Activos en Baja', 'trash-2', '/reports/scrap', (SELECT id FROM menus WHERE path = '/reports'), 3, 'assets.read'),
  ('Tickets por Zona', 'map-pin', '/reports/tickets-zone', (SELECT id FROM menus WHERE path = '/reports'), 4, 'tickets.read'),
  ('Tickets por Técnico', 'user-check', '/reports/tickets-tech', (SELECT id FROM menus WHERE path = '/reports'), 5, 'tickets.read'),
  ('Historial de Fallas', 'alert-triangle', '/reports/failure-history', (SELECT id FROM menus WHERE path = '/reports'), 6, 'tickets.read')
ON CONFLICT (path) DO NOTHING;

-- Asignar menú padre a admin
INSERT INTO role_menus (role_id, menu_id)
SELECT 1, id FROM menus WHERE path = '/reports'
ON CONFLICT (role_id, menu_id) DO NOTHING;

-- Asignar todos los sub-menús a admin
INSERT INTO role_menus (role_id, menu_id)
SELECT 1, id FROM menus WHERE path IN (
  '/reports/assets-inventory',
  '/reports/depreciation',
  '/reports/scrap',
  '/reports/tickets-zone',
  '/reports/tickets-tech',
  '/reports/failure-history'
)
ON CONFLICT (role_id, menu_id) DO NOTHING;

-- Asignar menú padre a tech
INSERT INTO role_menus (role_id, menu_id)
SELECT 2, id FROM menus WHERE path = '/reports'
ON CONFLICT (role_id, menu_id) DO NOTHING;

-- Tech: solo reportes de activos (lectura) y tickets
INSERT INTO role_menus (role_id, menu_id)
SELECT 2, id FROM menus WHERE path IN (
  '/reports/assets-inventory',
  '/reports/tickets-zone',
  '/reports/tickets-tech',
  '/reports/failure-history'
)
ON CONFLICT (role_id, menu_id) DO NOTHING;
