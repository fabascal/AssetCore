import { Router } from "express";
import { webhookRateLimiter } from "../../middlewares/rate-limit.middleware";
import { verifyWebhookSecret } from "../../middlewares/webhook.middleware";
import { incomingWebhookHandler } from "./webhooks.controller";

const webhooksRouter = Router();

webhooksRouter.post("/incoming", webhookRateLimiter, verifyWebhookSecret, incomingWebhookHandler);

export default webhooksRouter;
