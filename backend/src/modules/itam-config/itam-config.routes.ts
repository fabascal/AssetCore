import { Router } from "express";
import { checkPermission } from "../../middlewares/permission.middleware";
import {
  listLocationsHandler, createLocationHandler, updateLocationHandler, deleteLocationHandler,
  listBrandsHandler, createBrandHandler, updateBrandHandler, deleteBrandHandler,
  listModelsHandler, createModelHandler, updateModelHandler, deleteModelHandler,
  listProcessorsHandler, createProcessorHandler, updateProcessorHandler, deleteProcessorHandler,
  listRamHandler, createRamHandler, updateRamHandler, deleteRamHandler,
  listStorageHandler, createStorageHandler, updateStorageHandler, deleteStorageHandler,
  getCompanyHandler, upsertCompanyHandler,
  listAssetTypesHandler, createAssetTypeHandler, updateAssetTypeHandler, deleteAssetTypeHandler,
} from "./itam-config.controller";

const itamConfigRouter = Router();

const read = checkPermission("itam.config.read");
const write = checkPermission("itam.config.write");

/* Locations */
itamConfigRouter.get("/locations", read, listLocationsHandler);
itamConfigRouter.post("/locations", write, createLocationHandler);
itamConfigRouter.put("/locations/:id", write, updateLocationHandler);
itamConfigRouter.delete("/locations/:id", write, deleteLocationHandler);

/* Brands */
itamConfigRouter.get("/brands", read, listBrandsHandler);
itamConfigRouter.post("/brands", write, createBrandHandler);
itamConfigRouter.put("/brands/:id", write, updateBrandHandler);
itamConfigRouter.delete("/brands/:id", write, deleteBrandHandler);

/* Models */
itamConfigRouter.get("/models", read, listModelsHandler);
itamConfigRouter.post("/models", write, createModelHandler);
itamConfigRouter.put("/models/:id", write, updateModelHandler);
itamConfigRouter.delete("/models/:id", write, deleteModelHandler);

/* Processors */
itamConfigRouter.get("/processors", read, listProcessorsHandler);
itamConfigRouter.post("/processors", write, createProcessorHandler);
itamConfigRouter.put("/processors/:id", write, updateProcessorHandler);
itamConfigRouter.delete("/processors/:id", write, deleteProcessorHandler);

/* RAM */
itamConfigRouter.get("/ram", read, listRamHandler);
itamConfigRouter.post("/ram", write, createRamHandler);
itamConfigRouter.put("/ram/:id", write, updateRamHandler);
itamConfigRouter.delete("/ram/:id", write, deleteRamHandler);

/* Storage */
itamConfigRouter.get("/storage", read, listStorageHandler);
itamConfigRouter.post("/storage", write, createStorageHandler);
itamConfigRouter.put("/storage/:id", write, updateStorageHandler);
itamConfigRouter.delete("/storage/:id", write, deleteStorageHandler);

/* Asset Types */
itamConfigRouter.get("/asset-types", read, listAssetTypesHandler);
itamConfigRouter.post("/asset-types", write, createAssetTypeHandler);
itamConfigRouter.put("/asset-types/:id", write, updateAssetTypeHandler);
itamConfigRouter.delete("/asset-types/:id", write, deleteAssetTypeHandler);

/* Company */
itamConfigRouter.get("/company", read, getCompanyHandler);
itamConfigRouter.put("/company", write, upsertCompanyHandler);

export default itamConfigRouter;
