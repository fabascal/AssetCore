import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof Error && err.message.startsWith("CORS:")) {
    return res.status(403).json({ message: "Origen no permitido" });
  }

  if (env.isProduction) {
    console.error("[assetcore-backend] unhandled error:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }

  const message = err instanceof Error ? err.message : "Error interno del servidor";
  console.error("[assetcore-backend] error:", err);
  return res.status(500).json({ message });
};
