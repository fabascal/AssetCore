import { Prisma, TicketPriority } from "@prisma/client";
import { prisma } from "../../shared/prisma";
import { analyzeIncomingMessage } from "../../shared/ai/agent.service";
import { createTicket } from "../tickets/tickets.service";

const resolvePriority = (text: string): TicketPriority => {
  const lower = text.toLowerCase();
  if (/(critico|caido|urgente|sever[oa]\s*1|bloqueante)/i.test(lower)) return "CRITICAL";
  if (/(alto|sever[oa]\s*2|importante)/i.test(lower)) return "HIGH";
  if (/(bajo|menor|sever[oa]\s*4)/i.test(lower)) return "LOW";
  return "MEDIUM";
};

const buildChannel = (payload: Record<string, unknown>) => {
  if (payload.From || payload.WaId) return "WHATSAPP";
  if (payload.subject || payload.fromEmail) return "EMAIL";
  return "GENERIC";
};

export const processIncomingWebhook = async (payload: Record<string, unknown>) => {
  const body = String(payload.Body ?? payload.body ?? payload.text ?? "");
  const sender = String(payload.From ?? payload.from ?? payload.fromEmail ?? "");
  const subject = String(payload.Subject ?? payload.subject ?? "");
  const channel = buildChannel(payload);

  const message = await prisma.incomingMessage.create({
    data: {
      channel,
      sender: sender || null,
      subject: subject || null,
      body: body || "(empty)",
      rawPayload: payload as Prisma.InputJsonValue,
    },
  });

  const analysis = await analyzeIncomingMessage(`${subject}\n${body}`.trim());

  const asset =
    (analysis.assetCode
      ? await prisma.asset.findUnique({ where: { assetCode: analysis.assetCode } })
      : null) ||
    (analysis.serialNumber
      ? await prisma.asset.findUnique({ where: { serialNumber: analysis.serialNumber } })
      : null);

  let createdTicketId: number | null = null;
  let aiAction = "Sin accion";

  if ((analysis.intent === "CREATE_TICKET" || analysis.intent === "REPORT_FAILURE") && asset) {
    const technician =
      (await prisma.user.findUnique({ where: { email: "tecnico.n1@assetcore.local" } })) ||
      (await prisma.user.findFirst({
        where: { role: { name: "tech" }, isActive: true },
      }));

    const ticket = await createTicket(
      {
        title: `Auto: ${subject || "Incidente recibido por webhook"}`,
        description: body || "Mensaje entrante sin detalle",
        priority: resolvePriority(body),
        assetId: asset.id,
        assignedToId: technician?.id ?? null,
      },
      undefined
    );

    createdTicketId = ticket.id;
    aiAction = `Ticket #${ticket.id} creado automaticamente para ${asset.assetCode}`;
  } else if (analysis.intent === "QUERY_STATUS" && asset) {
    const latestTicket = await prisma.ticket.findFirst({
      where: { assetId: asset.id },
      orderBy: { createdAt: "desc" },
    });
    aiAction = latestTicket
      ? `Consulta detectada: ultimo ticket #${latestTicket.id} estado ${latestTicket.status}`
      : `Consulta detectada: sin tickets previos para ${asset.assetCode}`;
  } else if (!asset) {
    aiAction = "No se encontro asset por assetCode/serial";
  }

  const updated = await prisma.incomingMessage.update({
    where: { id: message.id },
    data: {
      aiIntent: analysis.intent,
      aiAction,
      detectedAssetCode: analysis.assetCode ?? null,
      detectedSerialNumber: analysis.serialNumber ?? null,
      createdTicketId,
      processedAt: new Date(),
    },
  });

  return updated;
};

export const listIncomingMessages = async () => {
  return prisma.incomingMessage.findMany({
    include: {
      createdTicket: {
        select: {
          id: true,
          status: true,
          level: true,
          priority: true,
          asset: {
            select: {
              assetCode: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
};
