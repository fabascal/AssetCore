import { z } from "zod";
import { prisma } from "../../shared/prisma";

/* ─── Schemas ─── */

const nameSchema = z.string().trim().min(1).max(120);

const locationSchema = z.object({
  name: nameSchema,
  parentId: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

const brandSchema = z.object({
  name: nameSchema,
  isActive: z.boolean().default(true),
});

const modelSchema = z.object({
  name: nameSchema,
  brandId: z.coerce.number().int().positive(),
  isActive: z.boolean().default(true),
});

const processorSchema = z.object({
  name: nameSchema,
  isActive: z.boolean().default(true),
});

const ramSchema = z.object({
  label: nameSchema,
  sizeGb: z.coerce.number().int().positive(),
  isActive: z.boolean().default(true),
});

const storageSchema = z.object({
  label: nameSchema,
  sizeGb: z.coerce.number().int().positive(),
  isActive: z.boolean().default(true),
});

/* ─── Locations ─── */

export const listLocations = () =>
  prisma.location.findMany({
    include: { children: { orderBy: { name: "asc" } } },
    where: { parentId: null },
    orderBy: { name: "asc" },
  });

export const listAllLocations = () =>
  prisma.location.findMany({
    include: { parent: true, children: true },
    orderBy: { name: "asc" },
  });

export const createLocation = async (payload: unknown) => {
  const parsed = locationSchema.parse(payload);
  if (parsed.parentId) {
    const parent = await prisma.location.findUnique({ where: { id: parsed.parentId } });
    if (!parent) throw new Error("Ubicacion padre no encontrada");
  }
  return prisma.location.create({ data: parsed });
};

export const updateLocation = async (id: number, payload: unknown) => {
  const parsed = locationSchema.partial().parse(payload);
  if (parsed.parentId === id) throw new Error("Una ubicacion no puede ser padre de si misma");
  return prisma.location.update({ where: { id }, data: parsed });
};

export const deleteLocation = async (id: number) => {
  const children = await prisma.location.count({ where: { parentId: id } });
  if (children > 0) throw new Error("No se puede eliminar una ubicacion con sub-ubicaciones");
  const assets = await prisma.asset.count({ where: { locationId: id } });
  if (assets > 0) throw new Error("No se puede eliminar una ubicacion con activos asignados");
  return prisma.location.delete({ where: { id } });
};

/* ─── Brands ─── */

export const listBrands = () =>
  prisma.catalogBrand.findMany({
    include: { models: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

export const createBrand = async (payload: unknown) => {
  const parsed = brandSchema.parse(payload);
  return prisma.catalogBrand.create({ data: parsed });
};

export const updateBrand = async (id: number, payload: unknown) => {
  const parsed = brandSchema.partial().parse(payload);
  return prisma.catalogBrand.update({ where: { id }, data: parsed });
};

export const deleteBrand = async (id: number) => {
  const models = await prisma.catalogModel.count({ where: { brandId: id } });
  if (models > 0) throw new Error("No se puede eliminar una marca con modelos asociados");
  return prisma.catalogBrand.delete({ where: { id } });
};

/* ─── Models ─── */

export const listModels = (brandId?: number) =>
  prisma.catalogModel.findMany({
    where: brandId ? { brandId } : undefined,
    include: { brand: true },
    orderBy: { name: "asc" },
  });

export const createModel = async (payload: unknown) => {
  const parsed = modelSchema.parse(payload);
  const brand = await prisma.catalogBrand.findUnique({ where: { id: parsed.brandId } });
  if (!brand) throw new Error("Marca no encontrada");
  return prisma.catalogModel.create({ data: parsed });
};

export const updateModel = async (id: number, payload: unknown) => {
  const parsed = modelSchema.partial().parse(payload);
  return prisma.catalogModel.update({ where: { id }, data: parsed });
};

export const deleteModel = async (id: number) =>
  prisma.catalogModel.delete({ where: { id } });

/* ─── Processors ─── */

export const listProcessors = () =>
  prisma.catalogProcessor.findMany({ orderBy: { name: "asc" } });

export const createProcessor = async (payload: unknown) => {
  const parsed = processorSchema.parse(payload);
  return prisma.catalogProcessor.create({ data: parsed });
};

export const updateProcessor = async (id: number, payload: unknown) => {
  const parsed = processorSchema.partial().parse(payload);
  return prisma.catalogProcessor.update({ where: { id }, data: parsed });
};

export const deleteProcessor = async (id: number) =>
  prisma.catalogProcessor.delete({ where: { id } });

/* ─── RAM Catalog ─── */

export const listRam = () =>
  prisma.catalogRam.findMany({ orderBy: { sizeGb: "asc" } });

export const createRam = async (payload: unknown) => {
  const parsed = ramSchema.parse(payload);
  return prisma.catalogRam.create({ data: parsed });
};

export const updateRam = async (id: number, payload: unknown) => {
  const parsed = ramSchema.partial().parse(payload);
  return prisma.catalogRam.update({ where: { id }, data: parsed });
};

export const deleteRam = async (id: number) =>
  prisma.catalogRam.delete({ where: { id } });

/* ─── Storage Catalog ─── */

export const listStorage = () =>
  prisma.catalogStorage.findMany({ orderBy: { sizeGb: "asc" } });

export const createStorage = async (payload: unknown) => {
  const parsed = storageSchema.parse(payload);
  return prisma.catalogStorage.create({ data: parsed });
};

export const updateStorage = async (id: number, payload: unknown) => {
  const parsed = storageSchema.partial().parse(payload);
  return prisma.catalogStorage.update({ where: { id }, data: parsed });
};

export const deleteStorage = async (id: number) =>
  prisma.catalogStorage.delete({ where: { id } });

/* ─── Asset Types ─── */

const assetTypeSchema = z.object({
  name:           z.string().trim().min(1).max(120),
  usefulLifeYears: z.coerce.number().int().min(1).max(100),
  isActive:       z.boolean().default(true),
});

export const listAssetTypes = () =>
  prisma.assetType.findMany({ orderBy: { name: "asc" } });

export const createAssetType = async (payload: unknown) => {
  const parsed = assetTypeSchema.parse(payload);
  return prisma.assetType.create({ data: parsed });
};

export const updateAssetType = async (id: number, payload: unknown) => {
  const parsed = assetTypeSchema.partial().parse(payload);
  return prisma.assetType.update({ where: { id }, data: parsed });
};

export const deleteAssetType = async (id: number) => {
  const assets = await prisma.asset.count({ where: { assetTypeId: id } });
  if (assets > 0) throw new Error("No se puede eliminar un tipo con activos asignados");
  return prisma.assetType.delete({ where: { id } });
};

/* ─── Company ─── */

const companySchema = z.object({
  name: z.string().trim().min(1).max(200),
  rfc: z.string().trim().max(20).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  email: z.string().trim().email().max(120).nullable().optional(),
  website: z.string().trim().max(200).nullable().optional(),
  logoData: z.string().nullable().optional(),
  logoMime: z.string().max(50).nullable().optional(),
});

export const getCompany = async () => {
  const company = await prisma.company.findFirst({ orderBy: { id: "asc" } });
  return company;
};

export const upsertCompany = async (payload: unknown) => {
  const parsed = companySchema.parse(payload);
  const existing = await prisma.company.findFirst({ orderBy: { id: "asc" } });
  if (existing) {
    return prisma.company.update({ where: { id: existing.id }, data: parsed });
  }
  return prisma.company.create({ data: parsed });
};
