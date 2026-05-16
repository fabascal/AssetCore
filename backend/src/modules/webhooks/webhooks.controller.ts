import { Request, Response } from "express";
import { listIncomingMessages, processIncomingWebhook } from "./webhooks.service";

export const incomingWebhookHandler = async (req: Request, res: Response) => {
  try {
    const payload = (req.body ?? {}) as Record<string, unknown>;
    const result = await processIncomingWebhook(payload);
    return res.status(202).json({
      accepted: true,
      messageId: result.id,
      aiIntent: result.aiIntent,
      aiAction: result.aiAction,
      createdTicketId: result.createdTicketId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return res.status(400).json({ accepted: false, message });
  }
};

export const listAiLogsHandler = async (_req: Request, res: Response) => {
  const logs = await listIncomingMessages();
  return res.status(200).json({ logs });
};
