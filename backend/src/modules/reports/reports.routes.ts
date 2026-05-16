import { Router } from "express";
import { checkPermission } from "../../middlewares/permission.middleware";
import {
  filtersHandler,
  assetsInventoryHandler,
  ticketsByZoneHandler,
  ticketsByTechHandler,
  failureHistoryHandler,
  depreciationHandler,
  scrapHandler,
} from "./reports.controller";

const reportsRouter = Router();

reportsRouter.get("/filters", filtersHandler);
reportsRouter.get("/assets-inventory", checkPermission("assets.read"), assetsInventoryHandler);
reportsRouter.get("/depreciation", checkPermission("assets.read"), depreciationHandler);
reportsRouter.get("/scrap", checkPermission("assets.read"), scrapHandler);
reportsRouter.get("/tickets-by-zone", checkPermission("tickets.read"), ticketsByZoneHandler);
reportsRouter.get("/tickets-by-tech", checkPermission("tickets.read"), ticketsByTechHandler);
reportsRouter.get("/failure-history", checkPermission("tickets.read"), failureHistoryHandler);

export default reportsRouter;
