import { Router } from "express";
import { checkPermission } from "../../middlewares/permission.middleware";
import { getDashboardSummaryHandler } from "./dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.get("/summary", checkPermission("dashboard.read"), getDashboardSummaryHandler);

export default dashboardRouter;
