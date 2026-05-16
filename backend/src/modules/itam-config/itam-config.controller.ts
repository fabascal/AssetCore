import { Request, Response } from "express";
import { z } from "zod";
import * as svc from "./itam-config.service";

const idParam = z.object({ id: z.coerce.number().int().positive() });

const wrap = (fn: (req: Request, res: Response) => Promise<Response>) =>
  async (req: Request, res: Response) => {
    try {
      return await fn(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error en configuracion ITAM";
      const status = message.includes("no encontrad") ? 404 : 400;
      return res.status(status).json({ message });
    }
  };

/* ─── Locations ─── */

export const listLocationsHandler = wrap(async (_req, res) => {
  const locations = await svc.listAllLocations();
  return res.json({ locations });
});

export const createLocationHandler = wrap(async (req, res) => {
  const location = await svc.createLocation(req.body);
  return res.status(201).json({ location });
});

export const updateLocationHandler = wrap(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const location = await svc.updateLocation(id, req.body);
  return res.json({ location });
});

export const deleteLocationHandler = wrap(async (req, res) => {
  const { id } = idParam.parse(req.params);
  await svc.deleteLocation(id);
  return res.status(204).send();
});

/* ─── Brands ─── */

export const listBrandsHandler = wrap(async (_req, res) => {
  const brands = await svc.listBrands();
  return res.json({ brands });
});

export const createBrandHandler = wrap(async (req, res) => {
  const brand = await svc.createBrand(req.body);
  return res.status(201).json({ brand });
});

export const updateBrandHandler = wrap(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const brand = await svc.updateBrand(id, req.body);
  return res.json({ brand });
});

export const deleteBrandHandler = wrap(async (req, res) => {
  const { id } = idParam.parse(req.params);
  await svc.deleteBrand(id);
  return res.status(204).send();
});

/* ─── Models ─── */

export const listModelsHandler = wrap(async (req, res) => {
  const brandId = req.query.brandId ? Number(req.query.brandId) : undefined;
  const models = await svc.listModels(brandId);
  return res.json({ models });
});

export const createModelHandler = wrap(async (req, res) => {
  const model = await svc.createModel(req.body);
  return res.status(201).json({ model });
});

export const updateModelHandler = wrap(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const model = await svc.updateModel(id, req.body);
  return res.json({ model });
});

export const deleteModelHandler = wrap(async (req, res) => {
  const { id } = idParam.parse(req.params);
  await svc.deleteModel(id);
  return res.status(204).send();
});

/* ─── Processors ─── */

export const listProcessorsHandler = wrap(async (_req, res) => {
  const processors = await svc.listProcessors();
  return res.json({ processors });
});

export const createProcessorHandler = wrap(async (req, res) => {
  const processor = await svc.createProcessor(req.body);
  return res.status(201).json({ processor });
});

export const updateProcessorHandler = wrap(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const processor = await svc.updateProcessor(id, req.body);
  return res.json({ processor });
});

export const deleteProcessorHandler = wrap(async (req, res) => {
  const { id } = idParam.parse(req.params);
  await svc.deleteProcessor(id);
  return res.status(204).send();
});

/* ─── RAM ─── */

export const listRamHandler = wrap(async (_req, res) => {
  const ram = await svc.listRam();
  return res.json({ ram });
});

export const createRamHandler = wrap(async (req, res) => {
  const item = await svc.createRam(req.body);
  return res.status(201).json({ item });
});

export const updateRamHandler = wrap(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const item = await svc.updateRam(id, req.body);
  return res.json({ item });
});

export const deleteRamHandler = wrap(async (req, res) => {
  const { id } = idParam.parse(req.params);
  await svc.deleteRam(id);
  return res.status(204).send();
});

/* ─── Storage ─── */

export const listStorageHandler = wrap(async (_req, res) => {
  const storage = await svc.listStorage();
  return res.json({ storage });
});

export const createStorageHandler = wrap(async (req, res) => {
  const item = await svc.createStorage(req.body);
  return res.status(201).json({ item });
});

export const updateStorageHandler = wrap(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const item = await svc.updateStorage(id, req.body);
  return res.json({ item });
});

export const deleteStorageHandler = wrap(async (req, res) => {
  const { id } = idParam.parse(req.params);
  await svc.deleteStorage(id);
  return res.status(204).send();
});

/* ─── Asset Types ─── */

export const listAssetTypesHandler = wrap(async (_req, res) => {
  const assetTypes = await svc.listAssetTypes();
  return res.json({ assetTypes });
});

export const createAssetTypeHandler = wrap(async (req, res) => {
  const assetType = await svc.createAssetType(req.body);
  return res.status(201).json({ assetType });
});

export const updateAssetTypeHandler = wrap(async (req, res) => {
  const { id } = idParam.parse(req.params);
  const assetType = await svc.updateAssetType(id, req.body);
  return res.json({ assetType });
});

export const deleteAssetTypeHandler = wrap(async (req, res) => {
  const { id } = idParam.parse(req.params);
  await svc.deleteAssetType(id);
  return res.status(204).send();
});

/* ─── Company ─── */

export const getCompanyHandler = wrap(async (_req, res) => {
  const company = await svc.getCompany();
  return res.json({ company });
});

export const upsertCompanyHandler = wrap(async (req, res) => {
  const company = await svc.upsertCompany(req.body);
  return res.json({ company });
});
