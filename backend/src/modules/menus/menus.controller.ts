import { Request, Response } from "express";
import { getMenusByRole } from "./menus.service";
import { AuthRequest } from "../../types/auth-request";

export const getMyMenusHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return res.status(401).json({ message: "No autenticado" });
  }

  const menus = await getMenusByRole(authReq.user.roleId);
  return res.status(200).json({ menus });
};
