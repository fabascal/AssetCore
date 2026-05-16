import { Router } from "express";
import { checkPermission } from "../../middlewares/permission.middleware";
import {
  createHelpdeskTopicHandler,
  listHelpdeskTopicsHandler,
  listLocationsHandler,
  listTechUsersHandler,
  updateHelpdeskTopicHandler,
} from "./helpdesk-config.controller";

const helpdeskConfigRouter = Router();

helpdeskConfigRouter.get("/topics", checkPermission("helpdesk.config.read"), listHelpdeskTopicsHandler);
helpdeskConfigRouter.get("/tech-users", checkPermission("helpdesk.config.read"), listTechUsersHandler);
helpdeskConfigRouter.get("/locations", checkPermission("helpdesk.config.read"), listLocationsHandler);
helpdeskConfigRouter.post("/topics", checkPermission("helpdesk.config.write"), createHelpdeskTopicHandler);
helpdeskConfigRouter.put("/topics/:id", checkPermission("helpdesk.config.write"), updateHelpdeskTopicHandler);

export default helpdeskConfigRouter;
