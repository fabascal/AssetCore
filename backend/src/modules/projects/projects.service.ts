import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { projectStatuses, ganttTaskStatuses, dependencyTypes } from "./projects.types";

// ── Schemas ────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(projectStatuses).default("PLANNING"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const updateProjectSchema = createProjectSchema.partial();

const createTaskSchema = z.object({
  parentTaskId: z.number().int().positive().optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(ganttTaskStatuses).default("PENDING"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  progress: z.number().int().min(0).max(100).default(0),
  isCritical: z.boolean().default(false),
  isMilestone: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  assignedToId: z.number().int().positive().optional().nullable(),
  assetId: z.number().int().positive().optional().nullable(),
});

const updateTaskSchema = createTaskSchema.partial();

const createDependencySchema = z.object({
  predecessorId: z.number().int().positive(),
  successorId: z.number().int().positive(),
  type: z.enum(dependencyTypes).default("FINISH_TO_START"),
});

// ── Projects ───────────────────────────────────────

const taskInclude = {
  assignedTo: { select: { id: true, fullName: true, email: true } },
  asset: { select: { id: true, assetCode: true, brand: true, model: true } },
  dependenciesAsPredecessor: {
    select: { id: true, successorId: true, type: true },
  },
  dependenciesAsSuccessor: {
    select: { id: true, predecessorId: true, type: true },
  },
} as const;

export const listProjects = async () => {
  return prisma.project.findMany({
    include: {
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getProjectById = async (id: number) => {
  return prisma.project.findUnique({
    where: { id },
    include: {
      tasks: {
        include: taskInclude,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });
};

export const createProject = async (payload: unknown) => {
  const parsed = createProjectSchema.parse(payload);
  return prisma.project.create({ data: parsed });
};

export const updateProject = async (id: number, payload: unknown) => {
  const parsed = updateProjectSchema.parse(payload);
  return prisma.project.update({ where: { id }, data: parsed });
};

export const deleteProject = async (id: number) => {
  return prisma.project.delete({ where: { id } });
};

// ── Tasks ──────────────────────────────────────────

export const listTasks = async (projectId: number) => {
  return prisma.projectTask.findMany({
    where: { projectId },
    include: taskInclude,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
};

export const getTaskById = async (projectId: number, taskId: number) => {
  return prisma.projectTask.findFirst({
    where: { id: taskId, projectId },
    include: {
      ...taskInclude,
      children: {
        include: taskInclude,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
  });
};

export const createTask = async (projectId: number, payload: unknown) => {
  const parsed = createTaskSchema.parse(payload);
  return prisma.projectTask.create({
    data: { ...parsed, projectId },
    include: taskInclude,
  });
};

export const updateTask = async (projectId: number, taskId: number, payload: unknown) => {
  const parsed = updateTaskSchema.parse(payload);
  return prisma.projectTask.update({
    where: { id: taskId, projectId },
    data: parsed,
    include: taskInclude,
  });
};

export const deleteTask = async (projectId: number, taskId: number) => {
  return prisma.projectTask.delete({
    where: { id: taskId, projectId },
  });
};

// ── Dependencies ───────────────────────────────────

export const addDependency = async (projectId: number, payload: unknown) => {
  const parsed = createDependencySchema.parse(payload);

  // Verify both tasks belong to the same project
  const tasks = await prisma.projectTask.findMany({
    where: { id: { in: [parsed.predecessorId, parsed.successorId] }, projectId },
    select: { id: true },
  });
  if (tasks.length !== 2) {
    throw new Error("Ambas tareas deben pertenecer al mismo proyecto");
  }

  return prisma.taskDependency.create({ data: parsed });
};

export const removeDependency = async (depId: number) => {
  return prisma.taskDependency.delete({ where: { id: depId } });
};
