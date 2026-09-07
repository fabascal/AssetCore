import { Router } from "express";
import { checkPermission } from "../../middlewares/permission.middleware";
import {
	createRoleHandler,
	createUserHandler,
	deleteRoleHandler,
	getRoleMenusHandler,
	getRolePermissionsHandler,
	getUserHandler,
	listRolesHandler,
	listUsersHandler,
	updateRoleMenusHandler,
	updateRolePermissionsHandler,
	updateRoleHandler,
	updateUserHandler,
} from "./users.controller";

const usersRouter = Router();

usersRouter.get("/", checkPermission("users.read"), listUsersHandler);
usersRouter.get("/roles", checkPermission("users.read"), listRolesHandler);
usersRouter.post("/roles", checkPermission("users.write"), createRoleHandler);
usersRouter.put("/roles/:id", checkPermission("users.write"), updateRoleHandler);
usersRouter.delete("/roles/:id", checkPermission("users.write"), deleteRoleHandler);
usersRouter.get("/roles/:id/menus", checkPermission("users.write"), getRoleMenusHandler);
usersRouter.put("/roles/:id/menus", checkPermission("users.write"), updateRoleMenusHandler);
usersRouter.get("/roles/:id/permissions", checkPermission("users.write"), getRolePermissionsHandler);
usersRouter.put("/roles/:id/permissions", checkPermission("users.write"), updateRolePermissionsHandler);
usersRouter.get("/:id", checkPermission("users.read"), getUserHandler);
usersRouter.post("/", checkPermission("users.write"), createUserHandler);
usersRouter.put("/:id", checkPermission("users.write"), updateUserHandler);

export default usersRouter;
