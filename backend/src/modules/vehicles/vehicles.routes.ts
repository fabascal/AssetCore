import { Router } from "express";
import { bulkImportRateLimiter } from "../../middlewares/rate-limit.middleware";
import { checkPermission } from "../../middlewares/permission.middleware";
import {
  createVehicleHandler,
  deleteVehicleHandler,
  getVehicleHandler,
  decommissionVehicleHandler,
  listVehiclesHandler,
  updateVehicleHandler,
  listVehicleDocsHandler,
  uploadVehicleDocHandler,
  downloadVehicleDocHandler,
  deleteVehicleDocHandler,
  vehicleDocUpload,
  bulkImportVehiclesHandler,
} from "./vehicles.controller";

const vehiclesRouter = Router();

vehiclesRouter.get("/", checkPermission("vehicles.read"), listVehiclesHandler);
vehiclesRouter.post("/bulk-import", checkPermission("vehicles.write"), bulkImportRateLimiter, bulkImportVehiclesHandler);
vehiclesRouter.get("/:id", checkPermission("vehicles.read"), getVehicleHandler);
vehiclesRouter.post("/", checkPermission("vehicles.write"), createVehicleHandler);
vehiclesRouter.put("/:id", checkPermission("vehicles.write"), updateVehicleHandler);
vehiclesRouter.post("/:id/decommission", checkPermission("vehicles.write"), decommissionVehicleHandler);
vehiclesRouter.delete("/:id", checkPermission("vehicles.write"), deleteVehicleHandler);

/* Vehicle documents */
vehiclesRouter.get("/:id/documents", checkPermission("vehicles.read"), listVehicleDocsHandler);
vehiclesRouter.post("/:id/documents", checkPermission("vehicles.write"), vehicleDocUpload.single("file"), uploadVehicleDocHandler);
vehiclesRouter.get("/:id/documents/:docId/download", checkPermission("vehicles.read"), downloadVehicleDocHandler);
vehiclesRouter.delete("/:id/documents/:docId", checkPermission("vehicles.write"), deleteVehicleDocHandler);

export default vehiclesRouter;
