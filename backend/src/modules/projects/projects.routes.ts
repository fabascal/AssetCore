import { Router } from "express";
import { checkPermission } from "../../middlewares/permission.middleware";
import {
  listProjectsHandler,
  getProjectHandler,
  createProjectHandler,
  updateProjectHandler,
  deleteProjectHandler,
  listTasksHandler,
  getTaskHandler,
  createTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
  addDependencyHandler,
  removeDependencyHandler,
} from "./projects.controller";

const projectsRouter = Router();

// Projects CRUD
projectsRouter.get("/", checkPermission("projects.read"), listProjectsHandler);
projectsRouter.get("/:id", checkPermission("projects.read"), getProjectHandler);
projectsRouter.post("/", checkPermission("projects.write"), createProjectHandler);
projectsRouter.put("/:id", checkPermission("projects.write"), updateProjectHandler);
projectsRouter.delete("/:id", checkPermission("projects.write"), deleteProjectHandler);

// Tasks CRUD (nested under project)
projectsRouter.get("/:id/tasks", checkPermission("projects.read"), listTasksHandler);
projectsRouter.get("/:id/tasks/:taskId", checkPermission("projects.read"), getTaskHandler);
projectsRouter.post("/:id/tasks", checkPermission("projects.write"), createTaskHandler);
projectsRouter.put("/:id/tasks/:taskId", checkPermission("projects.write"), updateTaskHandler);
projectsRouter.delete("/:id/tasks/:taskId", checkPermission("projects.write"), deleteTaskHandler);

// Dependencies
projectsRouter.post("/:id/dependencies", checkPermission("projects.write"), addDependencyHandler);
projectsRouter.delete("/:id/dependencies/:depId", checkPermission("projects.write"), removeDependencyHandler);

export default projectsRouter;
