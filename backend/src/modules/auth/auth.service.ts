import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../shared/prisma";
import { getMenusByRole } from "../menus/menus.service";
import { getRolePermissionCodes } from "../../shared/rbac.utils";
import { LoginResponse } from "./auth.types";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

/* ── Token helpers ─────────────────────────────────────── */

export const generateAccessToken = (user: { id: number; email: string; role: string; roleId: number }) => {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, roleId: user.roleId },
    env.jwtSecret,
    { expiresIn: env.accessTokenExpiresInSec },
  );
};

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const createRefreshToken = async (userId: number): Promise<{ raw: string; family: string }> => {
  const raw = crypto.randomBytes(48).toString("base64url");
  const family = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(raw),
      userId,
      family,
      expiresAt,
    },
  });

  return { raw, family };
};

export const rotateRefreshToken = async (rawToken: string) => {
  const tokenHash = hashToken(rawToken);

  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing) {
    throw new Error("Refresh token inválido");
  }

  // If already revoked → possible theft: revoke whole family
  if (existing.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { family: existing.family },
      data: { revokedAt: new Date() },
    });
    throw new Error("Refresh token reutilizado — familia revocada");
  }

  if (existing.expiresAt < new Date()) {
    throw new Error("Refresh token expirado");
  }

  // Revoke current token
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  // Issue a new token in the same family
  const raw = crypto.randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(raw),
      userId: existing.userId,
      family: existing.family,
      expiresAt,
    },
  });

  // Load user for new access token
  const user = await prisma.user.findUnique({
    where: { id: existing.userId },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    throw new Error("Usuario no autorizado");
  }

  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role.name,
    roleId: user.roleId,
  });

  return { accessToken, refreshToken: raw, user };
};

export const revokeRefreshTokenFamily = async (rawToken: string) => {
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (existing) {
    await prisma.refreshToken.updateMany({
      where: { family: existing.family },
      data: { revokedAt: new Date() },
    });
  }
};

/* ── Login ─────────────────────────────────────────────── */

export const login = async (payload: unknown): Promise<LoginResponse> => {
  const parsed = loginSchema.parse(payload);

  const user = await prisma.user.findUnique({
    where: { email: parsed.email.toLowerCase() },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    throw new Error("Credenciales inválidas");
  }

  const validPassword = await bcrypt.compare(parsed.password, user.passwordHash);
  if (!validPassword) {
    throw new Error("Credenciales inválidas");
  }

  const allowedMenus = await getMenusByRole(user.roleId);
  const permissions = await getRolePermissionCodes(user.roleId);

  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role.name,
    roleId: user.roleId,
  });

  const refresh = await createRefreshToken(user.id);

  return {
    accessToken,
    refreshToken: refresh.raw,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: {
        id: user.role.id,
        name: user.role.name,
      },
    },
    menus: allowedMenus,
    permissions,
  };
};

export const getMyProfile = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    throw new Error("Usuario no autorizado");
  }

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: {
      id: user.role.id,
      name: user.role.name,
    },
  };
};

export const updateMyProfile = async (userId: number, payload: unknown) => {
  const parsed = updateProfileSchema.parse(payload);

  const existingUser = await prisma.user.findFirst({
    where: {
      email: parsed.email.toLowerCase(),
      NOT: { id: userId },
    },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error("El correo ya está en uso por otro usuario");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: parsed.fullName.trim(),
      email: parsed.email.toLowerCase().trim(),
    },
    include: { role: true },
  });

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: {
      id: user.role.id,
      name: user.role.name,
    },
  };
};

export const changeMyPassword = async (userId: number, payload: unknown) => {
  const parsed = changePasswordSchema.parse(payload);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new Error("Usuario no autorizado");
  }

  const validCurrentPassword = await bcrypt.compare(parsed.currentPassword, user.passwordHash);
  if (!validCurrentPassword) {
    throw new Error("La contraseña actual no es correcta");
  }

  const passwordHash = await bcrypt.hash(parsed.newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { updated: true };
};
