import { TicketLevel, TicketPriority, TicketStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { queueProviderEscalationNotification } from "../../shared/notifications/provider.notification";

const createTicketSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  status: z.nativeEnum(TicketStatus).default(TicketStatus.OPEN),
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.MEDIUM),
  level: z.nativeEnum(TicketLevel).default(TicketLevel.LEVEL_1),
  supportTopicId: z.number().int().positive().nullable().optional(),
  assignedToId: z.number().int().positive().nullable().optional(),
  assetId: z.number().int().positive(),
});

const transitionSchema = z.object({
  action: z.enum(["IN_PROGRESS", "PROVIDER", "CLOSED", "CANCELLED", "REOPEN"]),
});

const reassignSchema = z.object({
  assignedToId: z.number().int().positive().nullable(),
});

export const listTickets = async (opts?: { assetId?: number; userId?: number; roleName?: string }) => {
  const where: Record<string, unknown> = {};
  if (opts?.assetId) where.assetId = opts.assetId;
  if (opts?.roleName && opts.roleName !== "admin" && opts.userId) {
    where.assignedToId = opts.userId;
  }
  return prisma.ticket.findMany({
    where,
    include: {
      supportTopic: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      asset: {
        select: {
          id: true,
          assetCode: true,
          brand: true,
          model: true,
        },
      },
      _count: {
        select: {
          comments: true,
          attachments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getTicketById = async (id: number) => {
  return prisma.ticket.findUnique({
    where: { id },
    include: {
      supportTopic: {
        select: { id: true, name: true },
      },
      assignedTo: {
        select: { id: true, fullName: true, email: true },
      },
      asset: {
        select: { id: true, assetCode: true, brand: true, model: true, serialNumber: true },
      },
      events: {
        include: {
          actor: {
            select: { id: true, fullName: true, email: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        include: {
          author: {
            select: { id: true, fullName: true, email: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      attachments: {
        include: {
          uploadedBy: {
            select: { id: true, fullName: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
};

export const listTicketTopics = async () => {
  return prisma.supportTopic.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      levels: {
        select: {
          id: true,
          levelOrder: true,
          levelName: true,
          escalationTarget: true,
          assignments: {
            select: {
              id: true,
              locationId: true,
              techUserId: true,
              location: { select: { id: true, name: true } },
              techUser: { select: { id: true, fullName: true } },
            },
          },
        },
        orderBy: [{ levelOrder: "asc" }, { id: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });
};

export const createTicket = async (payload: unknown, actorUserId?: number) => {
  const parsed = createTicketSchema.parse(payload);

  const activeTopicsCount = await prisma.supportTopic.count({ where: { isActive: true } });
  if (activeTopicsCount > 0 && typeof parsed.supportTopicId !== "number") {
    throw new Error("Debes seleccionar un tema de soporte para crear el ticket");
  }

  let mappedInitialLevel = parsed.level;
  if (typeof parsed.supportTopicId === "number") {
    const topic = await prisma.supportTopic.findFirst({
      where: {
        id: parsed.supportTopicId,
        isActive: true,
      },
      include: {
        levels: {
          orderBy: [{ levelOrder: "asc" }, { id: "asc" }],
        },
      },
    });

    if (!topic) {
      throw new Error("El tema de soporte seleccionado no existe o esta inactivo");
    }

    const firstLevel = topic.levels[0];
    if (firstLevel?.escalationTarget === "PROVIDER") {
      mappedInitialLevel = TicketLevel.PROVEEDOR;
    } else {
      mappedInitialLevel = TicketLevel.LEVEL_1;
    }
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: {
        title: parsed.title,
        description: parsed.description,
        status: parsed.status,
        priority: parsed.priority,
        level: mappedInitialLevel,
        supportTopicId: parsed.supportTopicId ?? null,
        assignedToId: parsed.assignedToId ?? null,
        assetId: parsed.assetId,
      },
      include: {
        asset: {
          select: {
            assetCode: true,
          },
        },
        supportTopic: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Crear evento de creación
    await tx.ticketEvent.create({
      data: {
        ticketId: created.id,
        actorUserId: actorUserId ?? null,
        action: "CREATED",
        details: {
          status: created.status,
          level: created.level,
          priority: created.priority,
        },
      },
    });

    // Obtener política SLA para calcular escalación automática
    const slaPolicy = await tx.sLAPolicy.findFirst({
      where: {
        priority: created.priority,
        level: created.level,
        isActive: true,
      },
    });

    if (slaPolicy && slaPolicy.autoEscalate && created.level === TicketLevel.LEVEL_1) {
      const escalationDueAt = new Date(
        Date.now() + slaPolicy.escalationHoursLevel1To2 * 60 * 60 * 1000
      );

      await tx.ticketEscalationTracking.create({
        data: {
          ticketId: created.id,
          currentLevel: TicketLevel.LEVEL_1,
          escalationDueAt,
          isEscalated: false,
        },
      });
    }

    return created;
  });

  if (ticket.level === TicketLevel.PROVEEDOR) {
    await queueProviderEscalationNotification({
      id: ticket.id,
    });
  }

  return ticket;
};

export const transitionTicket = async (id: number, payload: unknown, actorUserId?: number) => {
  const parsed = transitionSchema.parse(payload);
  const current = await prisma.ticket.findUnique({
    where: { id },
    include: {
      asset: {
        select: {
          assetCode: true,
          serialNumber: true,
        },
      },
    },
  });

  if (!current) {
    throw new Error("Ticket no encontrado");
  }

  let nextStatus = current.status;
  let nextLevel = current.level;
  let eventAction = "UPDATED";

  if (parsed.action === "IN_PROGRESS") {
    if (current.status !== TicketStatus.OPEN) {
      throw new Error("Solo un ticket Abierto puede pasar a En proceso");
    }
    nextStatus = TicketStatus.IN_PROGRESS;
    eventAction = "STATUS_IN_PROGRESS";
  }

  if (parsed.action === "PROVIDER") {
    if (current.status !== TicketStatus.IN_PROGRESS) {
      throw new Error("Solo un ticket En proceso puede pasar a Proveedor");
    }
    nextStatus = TicketStatus.PROVIDER;
    nextLevel = TicketLevel.PROVEEDOR;
    eventAction = "STATUS_PROVIDER";
  }

  if (parsed.action === "CLOSED") {
    if (current.status === TicketStatus.CLOSED || current.status === TicketStatus.CANCELLED) {
      throw new Error("El ticket ya esta cerrado o cancelado");
    }
    nextStatus = TicketStatus.CLOSED;
    eventAction = "STATUS_CLOSED";
  }

  if (parsed.action === "CANCELLED") {
    if (current.status === TicketStatus.CLOSED || current.status === TicketStatus.CANCELLED) {
      throw new Error("El ticket ya esta cerrado o cancelado");
    }
    nextStatus = TicketStatus.CANCELLED;
    eventAction = "STATUS_CANCELLED";
  }

  if (parsed.action === "REOPEN") {
    if (current.status !== TicketStatus.CLOSED) {
      throw new Error("Solo un ticket Cerrado puede reabrirse");
    }
    nextStatus = TicketStatus.OPEN;
    eventAction = "STATUS_REOPENED";
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id },
      data: {
        status: nextStatus,
        level: nextLevel,
      },
      include: {
        asset: {
          select: {
            assetCode: true,
          },
        },
      },
    });

    await tx.ticketEvent.create({
      data: {
        ticketId: updated.id,
        actorUserId: actorUserId ?? null,
        action: eventAction,
        details: {
          fromStatus: current.status,
          toStatus: nextStatus,
          fromLevel: current.level,
          toLevel: nextLevel,
        },
      },
    });

    return updated;
  });

  if (ticket.level === TicketLevel.PROVEEDOR && parsed.action === "PROVIDER") {
    await queueProviderEscalationNotification({
      id: ticket.id,
    });
  }

  return ticket;
};

export const reassignTicket = async (id: number, payload: unknown, actorUserId?: number) => {
  const parsed = reassignSchema.parse(payload);
  const current = await prisma.ticket.findUnique({ where: { id } });
  if (!current) throw new Error("Ticket no encontrado");

  if (current.status === "CLOSED" || current.status === "CANCELLED") {
    throw new Error("No se puede reasignar un ticket cerrado o cancelado");
  }

  const previousAssignedId = current.assignedToId;
  if (previousAssignedId === parsed.assignedToId) {
    throw new Error("El ticket ya esta asignado a este usuario");
  }

  if (parsed.assignedToId !== null) {
    const user = await prisma.user.findUnique({ where: { id: parsed.assignedToId } });
    if (!user || !user.isActive) throw new Error("Usuario no encontrado o inactivo");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id },
      data: { assignedToId: parsed.assignedToId },
      include: {
        assignedTo: { select: { id: true, fullName: true, email: true } },
        asset: { select: { id: true, assetCode: true, brand: true, model: true } },
      },
    });

    await tx.ticketEvent.create({
      data: {
        ticketId: id,
        actorUserId: actorUserId ?? null,
        action: "REASSIGNED",
        details: {
          previousAssignedToId: previousAssignedId,
          newAssignedToId: parsed.assignedToId,
        },
      },
    });

    return updated;
  });
};

/**
 * Obtiene tickets pendientes de escalación automática
 */
export const getTicketsPendingAutoEscalation = async () => {
  return prisma.ticketEscalationTracking.findMany({
    where: {
      isEscalated: false,
      escalationDueAt: {
        lte: new Date(),
      },
    },
  });
};

export const addComment = async (ticketId: number, body: string, authorId?: number) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error("Ticket no encontrado");

  return prisma.ticketComment.create({
    data: {
      ticketId,
      authorId: authorId ?? null,
      body,
    },
    include: {
      author: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
};

export const addAttachment = async (
  ticketId: number,
  file: { filename: string; originalName: string; mimeType: string; sizeBytes: number },
  uploadedById?: number
) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error("Ticket no encontrado");

  return prisma.ticketAttachment.create({
    data: {
      ticketId,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedById: uploadedById ?? null,
    },
    include: {
      uploadedBy: {
        select: { id: true, fullName: true },
      },
    },
  });
};

/**
 * Escala automáticamente un ticket que ha excedido su SLA
 */
export const autoEscalateTicket = async (trackingId: number) => {
  const tracking = await prisma.ticketEscalationTracking.findUnique({
    where: { id: trackingId },
  });

  if (!tracking || tracking.isEscalated) {
    throw new Error("Tracking de escalación no encontrado o ya escalado");
  }

  // Obtener el ticket
  const currentTicket = await prisma.ticket.findUnique({
    where: { id: tracking.ticketId },
    include: {
      asset: {
        select: {
          assetCode: true,
          serialNumber: true,
        },
      },
    },
  });

  if (!currentTicket) {
    throw new Error("Ticket no encontrado");
  }

  let nextLevel: TicketLevel;

  // Determinar siguiente nivel
  if (tracking.currentLevel === TicketLevel.LEVEL_1) {
    nextLevel = TicketLevel.LEVEL_2;
  } else if (tracking.currentLevel === TicketLevel.LEVEL_2) {
    nextLevel = TicketLevel.PROVEEDOR;
  } else {
    throw new Error("Ticket ya está en nivel máximo");
  }

  // Validar que tenga serial number si va a PROVEEDOR
  if (nextLevel === TicketLevel.PROVEEDOR && (!currentTicket.asset.serialNumber || !currentTicket.asset.serialNumber.trim())) {
    throw new Error("No se puede escalar a PROVEEDOR sin número de serie");
  }

  const result = await prisma.$transaction(async (tx) => {
    // Actualizar ticket
    const updated = await tx.ticket.update({
      where: { id: tracking.ticketId },
      data: {
        status: TicketStatus.PROVIDER,
        level: nextLevel,
      },
      include: {
        asset: {
          select: {
            assetCode: true,
          },
        },
      },
    });

    // Crear evento de escalación automática
    await tx.ticketEvent.create({
      data: {
        ticketId: tracking.ticketId,
        action: "AUTO_ESCALATED",
        details: {
          reason: "SLA_TIMEOUT",
          fromLevel: tracking.currentLevel,
          toLevel: nextLevel,
          slaDueAt: tracking.escalationDueAt.toISOString(),
          escalatedAt: new Date().toISOString(),
        },
      },
    });

    // Marcar tracking como escalado
    await tx.ticketEscalationTracking.update({
      where: { id: trackingId },
      data: {
        isEscalated: true,
        autoEscalatedAt: new Date(),
      },
    });

    // Crear nuevo tracking si no es nivel máximo
    if (nextLevel === TicketLevel.LEVEL_2) {
      const slaPolicy = await tx.sLAPolicy.findFirst({
        where: {
          priority: updated.priority,
          level: TicketLevel.LEVEL_2,
          isActive: true,
        },
      });

      if (slaPolicy && slaPolicy.autoEscalate) {
        const escalationDueAt = new Date(
          Date.now() + slaPolicy.escalationHoursLevel2ToProvider * 60 * 60 * 1000
        );

        await tx.ticketEscalationTracking.create({
          data: {
            ticketId: tracking.ticketId,
            currentLevel: TicketLevel.LEVEL_2,
            escalationDueAt,
            isEscalated: false,
          },
        });
      }
    }

    return updated;
  });

  // Notificar al proveedor si es necesario
  if (result.level === TicketLevel.PROVEEDOR) {
    await queueProviderEscalationNotification({
      id: result.id,
    });
  }

  return result;
};
