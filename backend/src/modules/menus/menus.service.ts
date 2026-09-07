import { prisma } from "../../shared/prisma";
import { MenuNode } from "./menus.types";

type MenuRow = {
  id: number;
  label: string;
  icon: string | null;
  path: string;
  parentId: number | null;
  displayOrder: number;
};

const toTree = (rows: MenuRow[]): MenuNode[] => {
  const nodeMap = new Map<number, MenuNode>();
  const roots: MenuNode[] = [];

  for (const row of rows) {
    nodeMap.set(row.id, {
      id: row.id,
      label: row.label,
      icon: row.icon,
      path: row.path,
      displayOrder: row.displayOrder,
      children: [],
    });
  }

  for (const row of rows) {
    const node = nodeMap.get(row.id);
    if (!node) continue;

    if (row.parentId && nodeMap.has(row.parentId)) {
      nodeMap.get(row.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (items: MenuNode[]) => {
    items.sort((a, b) => a.displayOrder - b.displayOrder);
    for (const item of items) {
      sortTree(item.children);
    }
  };

  sortTree(roots);
  return roots;
};

export const getMenusByRole = async (roleId: number): Promise<MenuNode[]> => {
  const explicitMenusCount = await prisma.roleMenu.count({ where: { roleId } });

  if (explicitMenusCount > 0) {
    const explicitRows = await prisma.menu.findMany({
      where: {
        isActive: true,
        roleMenus: {
          some: { roleId },
        },
        OR: [
          { requiredPermission: null },
          {
            permission: {
              rolePermissions: {
                some: { roleId },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        label: true,
        icon: true,
        path: true,
        parentId: true,
        displayOrder: true,
      },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });

    return toTree(explicitRows);
  }

  const rows = await prisma.menu.findMany({
    where: {
      isActive: true,
      OR: [
        { requiredPermission: null },
        {
          permission: {
            rolePermissions: {
              some: { roleId },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      label: true,
      icon: true,
      path: true,
      parentId: true,
      displayOrder: true,
    },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  });

  return toTree(rows);
};
