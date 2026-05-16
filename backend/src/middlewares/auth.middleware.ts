import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../shared/prisma";
import { AuthRequest } from "../types/auth-request";

type JwtPayload = {
  sub: number;
  email: string;
  roleId: number;
  role: string;
};

const isJwtPayload = (value: unknown): value is JwtPayload => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sub === "number" &&
    typeof candidate.email === "string" &&
    typeof candidate.roleId === "number" &&
    typeof candidate.role === "string"
  );
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest;
  try {
    // 1. Try HttpOnly cookie first, then fallback to Authorization header
    let token: string | undefined = req.cookies?.access_token;

    if (!token) {
      const header = req.headers.authorization;
      if (header && header.startsWith("Bearer ")) {
        token = header.slice("Bearer ".length).trim();
      }
    }

    if (!token) {
      return res.status(401).json({ message: "Token no proporcionado" });
    }
    const decoded = jwt.verify(token, env.jwtSecret);
    if (!isJwtPayload(decoded)) {
      return res.status(401).json({ message: "Token invalido" });
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(decoded.sub) },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Usuario no autorizado" });
    }

    authReq.user = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions: user.role.rolePermissions.map((rp) => rp.permission.code),
    };

    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Token invalido o expirado" });
  }
};
