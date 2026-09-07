-- Admin: assign all active menus.
-- After reports_menu.sql, admin had only /reports* in role_menus;
-- getMenusByRole() uses explicit role_menus when any exist.

INSERT INTO role_menus (role_id, menu_id)
SELECT r.id, m.id
FROM roles r
CROSS JOIN menus m
WHERE r.name = 'admin'
  AND m.is_active = TRUE
ON CONFLICT (role_id, menu_id) DO NOTHING;
