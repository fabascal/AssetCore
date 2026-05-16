import Twilio from "twilio";
import { env } from "../../config/env";
import { prisma } from "../prisma";

export const queueProviderEscalationNotification = async (ticket: { id: number }) => {
  const fullTicket = await prisma.ticket.findUnique({
    where: { id: ticket.id },
    include: {
      asset: true,
      events: {
        orderBy: { createdAt: "asc" },
        include: {
          actor: {
            select: { fullName: true, email: true },
          },
        },
      },
    },
  });

  if (!fullTicket) return;

  const failureHistory = fullTicket.events.map((event) => ({
    action: event.action,
    at: event.createdAt.toISOString(),
    by: event.actor?.fullName ?? "Sistema",
    details: event.details,
  }));

  const payload = {
    ticket: {
      id: fullTicket.id,
      title: fullTicket.title,
      description: fullTicket.description,
      priority: fullTicket.priority,
      status: fullTicket.status,
      level: fullTicket.level,
    },
    asset: {
      id: fullTicket.asset.id,
      assetCode: fullTicket.asset.assetCode,
      brand: fullTicket.asset.brand,
      model: fullTicket.asset.model,
      serialNumber: fullTicket.asset.serialNumber,
      specifications: fullTicket.asset.specifications,
    },
    failureHistory,
  };

  if (env.providerNotifyWebhookUrl) {
    try {
      await fetch(env.providerNotifyWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[provider-notify:webhook:error]", error);
    }
  }

  if (
    env.twilioAccountSid &&
    env.twilioAuthToken &&
    env.twilioWhatsAppFrom &&
    env.providerWhatsAppTo
  ) {
    try {
      const client = Twilio(env.twilioAccountSid, env.twilioAuthToken);
      const summary = [
        `Ticket #${fullTicket.id} escalado a PROVEEDOR`,
        `Activo: ${fullTicket.asset.assetCode} (${fullTicket.asset.brand} ${fullTicket.asset.model})`,
        `Prioridad: ${fullTicket.priority}`,
        `Falla: ${fullTicket.title}`,
      ].join("\n");

      await client.messages.create({
        from: env.twilioWhatsAppFrom,
        to: env.providerWhatsAppTo,
        body: summary,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[provider-notify:twilio:error]", error);
    }
  }
};
