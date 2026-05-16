import { Request, Response } from "express";
import { z } from "zod";
import {
  createRole,
  createUser,
  deleteRole,
  getRoleMenuAssignments,
  getUserById,
  listRoles,
  listUsers,
  updateRole,
  updateRoleMenuAssignments,
  updateUser,
} from "./users.service";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listUsersHandler = async (req: Request, res: Response) => {
  try {
    const users = await listUsers(req.query);
    return res.status(200).json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible listar usuarios";
    return res.status(400).json({ message });
  }
};

export const getUserHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const user = await getUserById(id);

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible obtener el usuario";
    return res.status(400).json({ message });
  }
};

export const createUserHandler = async (req: Request, res: Response) => {
  try {
    const user = await createUser(req.body);
    return res.status(201).json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible crear el usuario";
    return res.status(400).json({ message });
  }
};

export const updateUserHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const user = await updateUser(id, req.body);
    return res.status(200).json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible actualizar el usuario";
    if (message.includes("no encontrado")) {
      return res.status(404).json({ message });
    }
    return res.status(400).json({ message });
  }
};

export const listRolesHandler = async (_req: Request, res: Response) => {
  try {
    const roles = await listRoles();
    return res.status(200).json({ roles });
  } catch (_error) {
    return res.status(500).json({ message: "No fue posible listar roles" });
  }
};

export const createRoleHandler = async (req: Request, res: Response) => {
  try {
    const role = await createRole(req.body);
    return res.status(201).json({ role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible crear el rol";
    return res.status(400).json({ message });
  }
};

export const updateRoleHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const role = await updateRole(id, req.body);
    return res.status(200).json({ role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible actualizar el rol";
    if (message.includes("no encontrado")) {
      return res.status(404).json({ message });
    }
    return res.status(400).json({ message });
  }
};

export const deleteRoleHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteRole(id);
    return res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible eliminar el rol";
    if (message.includes("no encontrado")) {
      return res.status(404).json({ message });
    }
    return res.status(400).json({ message });
  }
};

export const getRoleMenusHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = await getRoleMenuAssignments(id);
    return res.status(200).json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible obtener menus del rol";
    if (message.includes("no encontrado")) {
      return res.status(404).json({ message });
    }
    return res.status(400).json({ message });
  }
};

export const updateRoleMenusHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = await updateRoleMenuAssignments(id, req.body);
    return res.status(200).json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible actualizar menus del rol";
    if (message.includes("no encontrado")) {
      return res.status(404).json({ message });
    }
    return res.status(400).json({ message });
  }
};
