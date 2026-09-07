import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export const verifyWebhookSecret = (req: Request, res: Response, next: NextFunction) => {
  if (!env.isProduction && !env.webhookSecret) {
    return next();
  }

  const provided = req.header("X-Webhook-Secret") ?? req.query.secret;
  if (!provided || provided !== env.webhookSecret) {
    return res.status(401).json({ accepted: false, message: "Webhook no autorizado" });
  }

  return next();
};
