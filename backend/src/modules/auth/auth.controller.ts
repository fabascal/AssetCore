import { CookieOptions, Request, Response } from "express";
import { env } from "../../config/env";
import { AuthRequest } from "../../types/auth-request";
import {
  changeMyPassword,
  getMyProfile,
  login,
  rotateRefreshToken,
  revokeRefreshTokenFamily,
  updateMyProfile,
} from "./auth.service";

/* ── Cookie helpers ────────────────────────────────────── */

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const baseCookieOpts: CookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: "strict",
  ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
};

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOpts,
    maxAge: 15 * 60 * 1000, // 15 min
    path: "/",
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookieOpts,
    maxAge: env.refreshTokenDays * 24 * 60 * 60 * 1000,
    path: "/api/auth", // only sent to auth endpoints
  });
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookieOpts, path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookieOpts, path: "/api/auth" });
};

/* ── Handlers ──────────────────────────────────────────── */

export const loginHandler = async (req: Request, res: Response) => {
  try {
    const result = await login(req.body);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    // Send user + menus in body (NO tokens in body)
    return res.status(200).json({ user: result.user, menus: result.menus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error en autenticación";
    return res.status(401).json({ message });
  }
};

export const refreshHandler = async (req: Request, res: Response) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (!rawToken) {
      return res.status(401).json({ message: "Refresh token no proporcionado" });
    }

    const result = await rotateRefreshToken(rawToken);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.status(200).json({
      user: {
        id: result.user.id,
        fullName: result.user.fullName,
        email: result.user.email,
        role: { id: result.user.role.id, name: result.user.role.name },
      },
    });
  } catch (error) {
    clearAuthCookies(res);
    const message = error instanceof Error ? error.message : "Error al renovar sesión";
    return res.status(401).json({ message });
  }
};

export const logoutHandler = async (req: Request, res: Response) => {
  try {
    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (rawToken) {
      await revokeRefreshTokenFamily(rawToken);
    }
    clearAuthCookies(res);
    return res.status(200).json({ message: "Sesión cerrada" });
  } catch {
    clearAuthCookies(res);
    return res.status(200).json({ message: "Sesión cerrada" });
  }
};

export const getMyProfileHandler = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return res.status(401).json({ message: "Usuario no autorizado" });
    }

    const profile = await getMyProfile(authReq.user.id);
    return res.status(200).json({ user: profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible obtener el perfil";
    return res.status(400).json({ message });
  }
};

export const updateMyProfileHandler = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return res.status(401).json({ message: "Usuario no autorizado" });
    }

    const updatedUser = await updateMyProfile(authReq.user.id, req.body);
    return res.status(200).json({ user: updatedUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible actualizar el perfil";
    return res.status(400).json({ message });
  }
};

export const changeMyPasswordHandler = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      return res.status(401).json({ message: "Usuario no autorizado" });
    }

    await changeMyPassword(authReq.user.id, req.body);
    return res.status(200).json({ message: "Contraseña actualizada" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible cambiar la contraseña";
    return res.status(400).json({ message });
  }
};
