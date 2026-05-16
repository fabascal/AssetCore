import { Router } from "express";
import { incomingWebhookHandler } from "./webhooks.controller";

const webhooksRouter = Router();

webhooksRouter.post("/incoming", incomingWebhookHandler);

export default webhooksRouter;
