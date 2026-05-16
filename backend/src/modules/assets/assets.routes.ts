import { Router } from "express";
import { checkPermission } from "../../middlewares/permission.middleware";
import {
  createAssetHandler,
  deleteAssetHandler,
  getAssetHandler,
  getAssetQrHandler,
  lifecycleReportHandler,
  listAssetsHandler,
  updateAssetHandler,
  listCustodyDocsHandler,
  uploadCustodyDocHandler,
  downloadCustodyDocHandler,
  deleteCustodyDocHandler,
  custodyUpload,
  bulkImportHandler,
} from "./assets.controller";

const assetsRouter = Router();

assetsRouter.get("/", checkPermission("assets.read"), listAssetsHandler);
assetsRouter.post("/bulk-import", checkPermission("assets.write"), bulkImportHandler);
assetsRouter.get("/lifecycle-report", checkPermission("assets.read"), lifecycleReportHandler);
assetsRouter.get("/:id", checkPermission("assets.read"), getAssetHandler);
assetsRouter.get("/:id/qr", checkPermission("assets.read"), getAssetQrHandler);
assetsRouter.post("/", checkPermission("assets.write"), createAssetHandler);
assetsRouter.put("/:id", checkPermission("assets.write"), updateAssetHandler);
assetsRouter.delete("/:id", checkPermission("assets.write"), deleteAssetHandler);

/* Custody documents (cartas responsivas firmadas) */
assetsRouter.get("/:id/custody-docs", checkPermission("assets.read"), listCustodyDocsHandler);
assetsRouter.post("/:id/custody-docs", checkPermission("assets.write"), custodyUpload.single("file"), uploadCustodyDocHandler);
assetsRouter.get("/:id/custody-docs/:docId/download", checkPermission("assets.read"), downloadCustodyDocHandler);
assetsRouter.delete("/:id/custody-docs/:docId", checkPermission("assets.write"), deleteCustodyDocHandler);

export default assetsRouter;
