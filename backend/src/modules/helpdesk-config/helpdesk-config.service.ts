import { z } from "zod";
import { prisma } from "../../shared/prisma";

const escalationTargetSchema = z.enum(["TECH", "PROVIDER"]);

const assignmentSchema = z.object({
  locationId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
  techUserId: z.coerce.number().int().positive().nullable().optional().transform((v) => v ?? null),
});

const supportLevelSchema = z
  .object({
    levelOrder: z.coerce.number().int().positive(),
    levelName: z.string().trim().min(1).max(120),
    escalationTarget: escalationTargetSchema,
    assignments: z.array(assignmentSchema).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.escalationTarget === "TECH") {
      if (value.assignments.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assignments"],
          message: "Un nivel TECH necesita al menos una asignación",
        });
      }
      for (let i = 0; i < value.assignments.length; i++) {
        if (typeof value.assignments[i].techUserId !== "number") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["assignments", i, "techUserId"],
            message: "Cada asignación TECH debe tener un usuario asignado",
          });
        }
      }
    }
  });

const supportTopicSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).nullable().optional(),
  isActive: z.boolean().default(true),
  levels: z.array(supportLevelSchema).min(1),
});

const validateUniqueOrders = (levels: Array<{ levelOrder: number }>) => {
  const seen = new Set<number>();
  for (const level of levels) {
    if (seen.has(level.levelOrder)) {
      throw new Error("No se permiten niveles duplicados para el mismo tema");
    }
    seen.add(level.levelOrder);
  }
};

const ensureTechUsersExist = async (techUserIds: number[]) => {
  if (techUserIds.length === 0) return;
  const unique = [...new Set(techUserIds)];
  const users = await prisma.user.findMany({
    where: { id: { in: unique }, isActive: true },
    select: { id: true },
  });
  if (users.length !== unique.length) {
    throw new Error("Uno o mas usuarios tech asignados no son validos o no estan activos");
  }
};

const levelInclude = {
  assignments: {
    include: {
      techUser: { select: { id: true, fullName: true, email: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: [{ id: "asc" as const }],
  },
};

export const listHelpdeskTopics = async () => {
  return prisma.supportTopic.findMany({
    include: {
      levels: {
        include: levelInclude,
        orderBy: [{ levelOrder: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
};

export const listActiveTechUsers = async () => {
  return prisma.user.findMany({
    where: {
      isActive: true,
      role: { name: { equals: "tech", mode: "insensitive" } },
    },
    select: { id: true, fullName: true, email: true },
    orderBy: [{ fullName: "asc" }],
  });
};

export const listLocations = async () => {
  return prisma.location.findMany({
    where: { isActive: true },
    select: { id: true, name: true, parentId: true },
    orderBy: [{ name: "asc" }],
  });
};

export const createHelpdeskTopic = async (payload: unknown) => {
  const parsed = supportTopicSchema.parse(payload);
  validateUniqueOrders(parsed.levels);

  const allTechIds = parsed.levels
    .flatMap((l) => l.assignments.map((a) => a.techUserId))
    .filter((v): v is number => typeof v === "number");
  await ensureTechUsersExist(allTechIds);

  return prisma.supportTopic.create({
    data: {
      name: parsed.name,
      description: parsed.description ?? null,
      isActive: parsed.isActive,
      levels: {
        create: parsed.levels.map((level) => ({
          levelOrder: level.levelOrder,
          levelName: level.levelName,
          escalationTarget: level.escalationTarget,
          assignments: {
            create: level.escalationTarget === "TECH"
              ? level.assignments.map((a) => ({
                  locationId: a.locationId,
                  techUserId: a.techUserId,
                }))
              : [],
          },
        })),
      },
    },
    include: {
      levels: {
        include: levelInclude,
        orderBy: [{ levelOrder: "asc" }, { id: "asc" }],
      },
    },
  });
};

export const updateHelpdeskTopic = async (topicId: number, payload: unknown) => {
  const parsed = supportTopicSchema.parse(payload);

  const existing = await prisma.supportTopic.findUnique({ where: { id: topicId }, select: { id: true } });
  if (!existing) throw new Error("Tema de soporte no encontrado");

  validateUniqueOrders(parsed.levels);

  const allTechIds = parsed.levels
    .flatMap((l) => l.assignments.map((a) => a.techUserId))
    .filter((v): v is number => typeof v === "number");
  await ensureTechUsersExist(allTechIds);

  return prisma.$transaction(async (tx) => {
    await tx.supportTopicLevel.deleteMany({ where: { topicId } });

    return tx.supportTopic.update({
      where: { id: topicId },
      data: {
        name: parsed.name,
        description: parsed.description ?? null,
        isActive: parsed.isActive,
        levels: {
          create: parsed.levels.map((level) => ({
            levelOrder: level.levelOrder,
            levelName: level.levelName,
            escalationTarget: level.escalationTarget,
            assignments: {
              create: level.escalationTarget === "TECH"
                ? level.assignments.map((a) => ({
                    locationId: a.locationId,
                    techUserId: a.techUserId,
                  }))
                : [],
            },
          })),
        },
      },
      include: {
        levels: {
          include: levelInclude,
          orderBy: [{ levelOrder: "asc" }, { id: "asc" }],
        },
      },
    });
  });
};
