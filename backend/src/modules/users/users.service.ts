import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../shared/prisma";

const listUsersSchema = z
  .object({
    q: z.string().trim().optional(),
    roleId: z.coerce.number().int().positive().optional(),
    isActive: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .default({});

const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(72),
  roleId: z.coerce.number().int().positive(),
  isActive: z.boolean().default(true),
});

const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(150).optional(),
  email: z.string().trim().email().max(160).optional(),
  password: z.string().min(8).max(72).optional(),
  roleId: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

const createRoleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().nullable(),
});

const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(240).optional().nullable(),
  })
  .refine((payload) => typeof payload.name === "string" || payload.description !== undefined, {
    message: "Debes enviar al menos un campo para actualizar",
  });

export const listUsers = async (query: unknown) => {
  const parsed = listUsersSchema.parse(query);
  const search = parsed.q?.toLowerCase();

  const users = await prisma.user.findMany({
    where: {
      ...(typeof parsed.roleId === "number" ? { roleId: parsed.roleId } : {}),
      ...(typeof parsed.isActive === "boolean" ? { isActive: parsed.isActive } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
      createdAt: true,
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return users;
};

export const getUserById = async (id: number) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
};

const ensureEmailAvailable = async (email: string, currentUserId?: number) => {
  const existing = await prisma.user.findFirst({
    where: {
      email,
      ...(typeof currentUserId === "number" ? { NOT: { id: currentUserId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error("El correo ya está en uso por otro usuario");
  }
};

const ensureRoleExists = async (roleId: number) => {
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
  if (!role) {
    throw new Error("El rol seleccionado no existe");
  }
};

export const createUser = async (payload: unknown) => {
  const parsed = createUserSchema.parse(payload);
  const normalizedEmail = parsed.email.toLowerCase();

  await ensureEmailAvailable(normalizedEmail);
  await ensureRoleExists(parsed.roleId);

  const passwordHash = await bcrypt.hash(parsed.password, 10);

  return prisma.user.create({
    data: {
      fullName: parsed.fullName,
      email: normalizedEmail,
      passwordHash,
      roleId: parsed.roleId,
      isActive: parsed.isActive,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
      createdAt: true,
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
};

export const updateUser = async (id: number, payload: unknown) => {
  const parsed = updateUserSchema.parse(payload);

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new Error("Usuario no encontrado");
  }

  const data: {
    fullName?: string;
    email?: string;
    roleId?: number;
    isActive?: boolean;
    passwordHash?: string;
  } = {};

  if (typeof parsed.fullName === "string") {
    data.fullName = parsed.fullName;
  }

  if (typeof parsed.email === "string") {
    const normalizedEmail = parsed.email.toLowerCase();
    await ensureEmailAvailable(normalizedEmail, id);
    data.email = normalizedEmail;
  }

  if (typeof parsed.roleId === "number") {
    await ensureRoleExists(parsed.roleId);
    data.roleId = parsed.roleId;
  }

  if (typeof parsed.isActive === "boolean") {
    data.isActive = parsed.isActive;
  }

  if (typeof parsed.password === "string") {
    data.passwordHash = await bcrypt.hash(parsed.password, 10);
  }

  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
};

export const listRoles = async () => {
  return prisma.role.findMany({
    select: {
      id: true,
      name: true,
      description: true,
    },
    orderBy: { name: "asc" },
  });
};

const roleMenuPayloadSchema = z.object({
  menuIds: z.array(z.coerce.number().int().positive()).default([]),
});

const rolePermissionPayloadSchema = z.object({
  permissionIds: z.array(z.coerce.number().int().positive()).default([]),
});

export const getRoleMenuAssignments = async (roleId: number) => {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true, description: true },
  });

  if (!role) {
    throw new Error("Rol no encontrado");
  }

  const menus = await prisma.menu.findMany({
    where: { isActive: true },
    select: {
      id: true,
      label: true,
      path: true,
      parentId: true,
      displayOrder: true,
    },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  });

  const assigned = await prisma.roleMenu.findMany({
    where: { roleId },
    select: { menuId: true },
  });

  return {
    role,
    menus,
    assignedMenuIds: assigned.map((item) => item.menuId),
  };
};

export const updateRoleMenuAssignments = async (roleId: number, payload: unknown) => {
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
  if (!role) {
    throw new Error("Rol no encontrado");
  }

  const parsed = roleMenuPayloadSchema.parse(payload);

  const availableMenus = await prisma.menu.findMany({
    where: { isActive: true },
    select: { id: true, parentId: true },
  });

  const menuMap = new Map<number, { id: number; parentId: number | null }>();
  for (const menu of availableMenus) {
    menuMap.set(menu.id, menu);
  }

  const requested = new Set(parsed.menuIds);
  for (const menuId of requested) {
    if (!menuMap.has(menuId)) {
      throw new Error(`Menu invalido: ${menuId}`);
    }
  }

  // Asegura consistencia jerarquica: si se asigna submenu, tambien asigna ancestros.
  const normalized = new Set<number>();
  const includeWithParents = (menuId: number) => {
    let cursor = menuMap.get(menuId) ?? null;
    while (cursor) {
      normalized.add(cursor.id);
      cursor = cursor.parentId ? menuMap.get(cursor.parentId) ?? null : null;
    }
  };

  for (const menuId of requested) {
    includeWithParents(menuId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.roleMenu.deleteMany({ where: { roleId } });

    if (normalized.size > 0) {
      await tx.roleMenu.createMany({
        data: Array.from(normalized).map((menuId) => ({ roleId, menuId })),
        skipDuplicates: true,
      });
    }
  });

  return { roleId, menuIds: Array.from(normalized) };
};

export const getRolePermissionAssignments = async (roleId: number) => {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true, description: true },
  });

  if (!role) {
    throw new Error("Rol no encontrado");
  }

  const permissions = await prisma.permission.findMany({
    select: {
      id: true,
      code: true,
      label: true,
      description: true,
    },
    orderBy: [{ code: "asc" }],
  });

  const assigned = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permissionId: true },
  });

  return {
    role,
    permissions,
    assignedPermissionIds: assigned.map((item) => item.permissionId),
  };
};

export const updateRolePermissionAssignments = async (roleId: number, payload: unknown) => {
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
  if (!role) {
    throw new Error("Rol no encontrado");
  }

  const parsed = rolePermissionPayloadSchema.parse(payload);

  const availablePermissions = await prisma.permission.findMany({
    select: { id: true },
  });
  const availableIds = new Set(availablePermissions.map((item) => item.id));

  for (const permissionId of parsed.permissionIds) {
    if (!availableIds.has(permissionId)) {
      throw new Error(`Permiso invalido: ${permissionId}`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });

    if (parsed.permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: parsed.permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      });
    }
  });

  return { roleId, permissionIds: parsed.permissionIds };
};

const ensureRoleNameAvailable = async (name: string, currentRoleId?: number) => {
  const existing = await prisma.role.findFirst({
    where: {
      name,
      ...(typeof currentRoleId === "number" ? { NOT: { id: currentRoleId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error("Ya existe un rol con ese nombre");
  }
};

export const createRole = async (payload: unknown) => {
  const parsed = createRoleSchema.parse(payload);
  await ensureRoleNameAvailable(parsed.name);

  return prisma.role.create({
    data: {
      name: parsed.name,
      description: parsed.description ?? null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

export const updateRole = async (id: number, payload: unknown) => {
  const parsed = updateRoleSchema.parse(payload);

  const existing = await prisma.role.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new Error("Rol no encontrado");
  }

  const data: {
    name?: string;
    description?: string | null;
  } = {};

  if (typeof parsed.name === "string") {
    await ensureRoleNameAvailable(parsed.name, id);
    data.name = parsed.name;
  }

  if (parsed.description !== undefined) {
    data.description = parsed.description;
  }

  return prisma.role.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

export const deleteRole = async (id: number) => {
  const existing = await prisma.role.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new Error("Rol no encontrado");
  }

  const usersCount = await prisma.user.count({ where: { roleId: id } });
  if (usersCount > 0) {
    throw new Error("No se puede eliminar un rol asignado a usuarios");
  }

  await prisma.rolePermission.deleteMany({ where: { roleId: id } });
  await prisma.role.delete({ where: { id } });
};
