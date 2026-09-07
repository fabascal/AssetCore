import { prisma } from "./prisma";

export const getRolePermissionCodes = async (roleId: number): Promise<string[]> => {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: { select: { code: true } } },
  });

  return rows.map((row) => row.permission.code);
};
