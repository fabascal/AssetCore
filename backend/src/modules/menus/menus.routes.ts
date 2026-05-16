import { Router } from "express";
import { getMyMenusHandler } from "./menus.controller";
import { checkPermission } from "../../middlewares/permission.middleware";

const menusRouter = Router();

menusRouter.get("/me", checkPermission("menus.read"), getMyMenusHandler);

export default menusRouter;
