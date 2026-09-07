import { Router } from "express";
import { checkPermission } from "../../middlewares/permission.middleware";
import { getDashboardSummaryHandler, getFinancialSummaryHandler } from "./dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.get("/summary", checkPermission("dashboard.read"), getDashboardSummaryHandler);
dashboardRouter.get("/financial-summary", checkPermission("assets.read"), getFinancialSummaryHandler);

export default dashboardRouter;
