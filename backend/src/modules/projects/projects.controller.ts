import { Request, Response } from "express";
import { z } from "zod";
import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  addDependency,
  removeDependency,
} from "./projects.service";

const idParam = z.object({ id: z.coerce.number().int().positive() });
const projectTaskParams = z.object({
  id: z.coerce.number().int().positive(),
  taskId: z.coerce.number().int().positive(),
});
const depParam = z.object({
  id: z.coerce.number().int().positive(),
  depId: z.coerce.number().int().positive(),
});

// ── Projects ───────────────────────────────────────

export const listProjectsHandler = async (_req: Request, res: Response) => {
  const projects = await listProjects();
  return res.json({ projects });
};

export const getProjectHandler = async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const project = await getProjectById(id);
  if (!project) return res.status(404).json({ message: "Proyecto no encontrado" });
  return res.json({ project });
};

export const createProjectHandler = async (req: Request, res: Response) => {
  try {
    const project = await createProject(req.body);
    return res.status(201).json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear proyecto";
    return res.status(400).json({ message });
  }
};

export const updateProjectHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParam.parse(req.params);
    const project = await updateProject(id, req.body);
    return res.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar proyecto";
    return res.status(400).json({ message });
  }
};

export const deleteProjectHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParam.parse(req.params);
    await deleteProject(id);
    return res.status(204).send();
  } catch (_err) {
    return res.status(404).json({ message: "Proyecto no encontrado" });
  }
};

// ── Tasks ──────────────────────────────────────────

export const listTasksHandler = async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const tasks = await listTasks(id);
  return res.json({ tasks });
};

export const getTaskHandler = async (req: Request, res: Response) => {
  const { id, taskId } = projectTaskParams.parse(req.params);
  const task = await getTaskById(id, taskId);
  if (!task) return res.status(404).json({ message: "Tarea no encontrada" });
  return res.json({ task });
};

export const createTaskHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParam.parse(req.params);
    const task = await createTask(id, req.body);
    return res.status(201).json({ task });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear tarea";
    return res.status(400).json({ message });
  }
};

export const updateTaskHandler = async (req: Request, res: Response) => {
  try {
    const { id, taskId } = projectTaskParams.parse(req.params);
    const task = await updateTask(id, taskId, req.body);
    return res.json({ task });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar tarea";
    return res.status(400).json({ message });
  }
};

export const deleteTaskHandler = async (req: Request, res: Response) => {
  try {
    const { id, taskId } = projectTaskParams.parse(req.params);
    await deleteTask(id, taskId);
    return res.status(204).send();
  } catch (_err) {
    return res.status(404).json({ message: "Tarea no encontrada" });
  }
};

// ── Dependencies ───────────────────────────────────

export const addDependencyHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParam.parse(req.params);
    const dep = await addDependency(id, req.body);
    return res.status(201).json({ dependency: dep });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear dependencia";
    return res.status(400).json({ message });
  }
};

export const removeDependencyHandler = async (req: Request, res: Response) => {
  try {
    const { depId } = depParam.parse(req.params);
    await removeDependency(depId);
    return res.status(204).send();
  } catch (_err) {
    return res.status(404).json({ message: "Dependencia no encontrada" });
  }
};
