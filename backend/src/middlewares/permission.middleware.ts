import { NextFunction, Request, Response } from "express";
import { AuthRequest } from "../types/auth-request";

export const checkPermission = (permissionCode: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;

    if (!authReq.user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    if (!authReq.user.permissions.includes(permissionCode)) {
      return res.status(403).json({ message: "Sin permisos suficientes" });
    }

    return next();
  };
};
