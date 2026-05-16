import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { assetStatuses, storageTypes } from "./assets.types";

const calcEndOfLife = (purchaseDate: Date | null | undefined, usefulLifeYears: number | null | undefined): Date | null => {
  if (!purchaseDate || !usefulLifeYears) return null;
  const eol = new Date(purchaseDate);
  eol.setFullYear(eol.getFullYear() + usefulLifeYears);
  return eol;
};

const createAssetSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  serialNumber: z.string().min(1),
  equipmentValue: z.coerce.number().nonnegative().nullable().optional(),
  status: z.enum(assetStatuses).default("AVAILABLE"),
  assetTypeId: z.coerce.number().int().positive().nullable().optional(),
  processor: z.string().nullable().optional(),
  ramGb: z.coerce.number().int().positive().nullable().optional(),
  storageGb: z.coerce.number().int().positive().nullable().optional(),
  storageType: z.enum(storageTypes).nullable().optional(),
  purchaseDate: z.coerce.date().nullable().optional(),
  warrantyEnd: z.coerce.date().nullable().optional(),
  usefulLifeYears: z.coerce.number().int().positive().nullable().optional(),
  locationId: z.coerce.number().int().positive().nullable().optional(),
  assignedToName: z.string().nullable().optional(),
  assignedToDate: z.coerce.date().nullable().optional(),
  specifications: z.record(z.string(), z.string()).default({}),
});

const updateAssetSchema = createAssetSchema.partial();

const generateUniqueAssetCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `AST-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const exists = await prisma.asset.findUnique({ where: { assetCode: candidate } });
    if (!exists) {
      return candidate;
    }
  }

  throw new Error("No se pudo generar un AssetCode unico");
};

export const listAssets = async () => {
  return prisma.asset.findMany({
    include: {
      assetType: { select: { id: true, name: true, usefulLifeYears: true } },
      location: { select: { id: true, name: true, parentId: true, parent: { select: { id: true, name: true } } } },
      tickets: {
        select: {
          id: true,
          priority: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getAssetById = async (id: number) => {
  return prisma.asset.findUnique({
    where: { id },
    include: {
      assetType: { select: { id: true, name: true, usefulLifeYears: true } },
      location: { select: { id: true, name: true, parentId: true, parent: { select: { id: true, name: true } } } },
      custodyDocs: {
        include: { uploadedBy: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
      },
      tickets: {
        include: {
          assignedTo: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          events: {
            include: {
              actor: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
};

export const createAsset = async (payload: unknown) => {
  const parsed = createAssetSchema.parse(payload);
  const assetCode = await generateUniqueAssetCode();

  const usefulLife = parsed.usefulLifeYears ?? 5;
  const endOfLifeDate = calcEndOfLife(parsed.purchaseDate, usefulLife);

  return prisma.asset.create({
    data: {
      assetCode,
      brand: parsed.brand,
      model: parsed.model,
      serialNumber: parsed.serialNumber,
      equipmentValue: parsed.equipmentValue ?? null,
      status: parsed.status,
      assetTypeId: parsed.assetTypeId ?? null,
      processor: parsed.processor ?? null,
      ramGb: parsed.ramGb ?? null,
      storageGb: parsed.storageGb ?? null,
      storageType: parsed.storageType ?? null,
      purchaseDate: parsed.purchaseDate ?? null,
      warrantyEnd: parsed.warrantyEnd ?? null,
      usefulLifeYears: usefulLife,
      endOfLifeDate,
      locationId: parsed.locationId ?? null,
      assignedToName: parsed.assignedToName ?? null,
      assignedToDate: parsed.assignedToDate ?? null,
      specifications: parsed.specifications,
    },
  });
};

export const updateAsset = async (id: number, payload: unknown) => {
  const parsed = updateAssetSchema.parse(payload);

  /* Recalculate end-of-life date when relevant fields change */
  const current = await prisma.asset.findUnique({ where: { id } });
  if (!current) throw new Error("Activo no encontrado");

  const purchaseDate = parsed.purchaseDate !== undefined ? parsed.purchaseDate : current.purchaseDate;
  const usefulLife = parsed.usefulLifeYears !== undefined
    ? parsed.usefulLifeYears
    : current.usefulLifeYears ?? 5;

  const endOfLifeDate = calcEndOfLife(purchaseDate, usefulLife);

  return prisma.asset.update({
    where: { id },
    data: {
      ...parsed,
      usefulLifeYears: usefulLife,
      endOfLifeDate,
    },
  });
};

export const deleteAsset = async (id: number) => {
  return prisma.asset.delete({
    where: { id },
  });
};

/* ─── Bulk Import ─── */

const importRowSchema = z.object({
  brand:          z.string().min(1, "Marca requerida"),
  model:          z.string().min(1, "Modelo requerido"),
  serialNumber:   z.string().min(1, "No. Serie requerido"),
  assetTypeName:  z.string().optional().nullable(),
  status:         z.enum(assetStatuses).optional().default("AVAILABLE"),
  processor:      z.string().optional().nullable(),
  ramGb:          z.coerce.number().int().positive().optional().nullable(),
  storageGb:      z.coerce.number().int().positive().optional().nullable(),
  storageType:    z.enum(storageTypes).optional().nullable(),
  purchaseDate:   z.coerce.date().optional().nullable(),
  warrantyEnd:    z.coerce.date().optional().nullable(),
  equipmentValue: z.coerce.number().nonnegative().optional().nullable(),
  assignedToName: z.string().optional().nullable(),
  assignedToDate: z.coerce.date().optional().nullable(),
});

type ImportRow = z.infer<typeof importRowSchema>;

export const bulkImportAssets = async (payload: {
  locationId?: number | null;
  rows: unknown[];
}) => {
  /* Pre-load asset types for name → id lookup */
  const assetTypesAll = await prisma.assetType.findMany({ select: { id: true, name: true, usefulLifeYears: true } });
  const typeByName = new Map(assetTypesAll.map((t) => [t.name.toLowerCase().trim(), t.id]));

  const results: { row: number; assetCode: string }[] = [];
  const errors:  { row: number; message: string }[]   = [];

  for (let i = 0; i < payload.rows.length; i++) {
    const rowNum = i + 2; // 1-based + header row
    let parsed: ImportRow;
    try {
      parsed = importRowSchema.parse(payload.rows[i]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fila inválida";
      errors.push({ row: rowNum, message: msg });
      continue;
    }

    /* Check duplicate serial number */
    const existing = await prisma.asset.findUnique({ where: { serialNumber: parsed.serialNumber } });
    if (existing) {
      errors.push({ row: rowNum, message: `No. Serie "${parsed.serialNumber}" ya existe (${existing.assetCode})` });
      continue;
    }

    /* Resolve asset type */
    let assetTypeId: number | null = null;
    if (parsed.assetTypeName) {
      assetTypeId = typeByName.get(parsed.assetTypeName.toLowerCase().trim()) ?? null;
      if (!assetTypeId) {
        errors.push({ row: rowNum, message: `Tipo de activo "${parsed.assetTypeName}" no encontrado` });
        continue;
      }
    }

    /* Resolve useful life from type */
    const assetTypeRecord = assetTypeId ? assetTypesAll.find((t) => t.id === assetTypeId) : null;
    const effectiveLife = assetTypeRecord?.usefulLifeYears ?? 5;

    const endOfLifeDate = calcEndOfLife(parsed.purchaseDate ?? null, effectiveLife);

    try {
      const assetCode = await generateUniqueAssetCode();
      await prisma.asset.create({
        data: {
          assetCode,
          brand:          parsed.brand,
          model:          parsed.model,
          serialNumber:   parsed.serialNumber,
          status:         parsed.status ?? "AVAILABLE",
          assetTypeId,
          processor:      parsed.processor      ?? null,
          ramGb:          parsed.ramGb           ?? null,
          storageGb:      parsed.storageGb       ?? null,
          storageType:    parsed.storageType     ?? null,
          purchaseDate:   parsed.purchaseDate    ?? null,
          warrantyEnd:    parsed.warrantyEnd     ?? null,
          equipmentValue: parsed.equipmentValue  ?? null,
          assignedToName: parsed.assignedToName  ?? null,
          assignedToDate: parsed.assignedToDate  ?? null,
          usefulLifeYears: effectiveLife,
          endOfLifeDate,
          locationId:     payload.locationId     ?? null,
          specifications: {},
        },
      });
      results.push({ row: rowNum, assetCode });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al crear activo";
      errors.push({ row: rowNum, message: msg });
    }
  }

  return { imported: results.length, skipped: errors.length, results, errors };
};

/* ─── Lifecycle Report ─── */

export const getLifecycleReport = async (year?: number) => {
  const targetYear = year ?? new Date().getFullYear();
  const startDate = new Date(targetYear, 0, 1);
  const endDate = new Date(targetYear, 11, 31, 23, 59, 59);

  const assets = await prisma.asset.findMany({
    where: {
      endOfLifeDate: { gte: startDate, lte: endDate },
      status: { not: "SCRAP" },
    },
    select: {
      id: true,
      assetCode: true,
      brand: true,
      model: true,
      serialNumber: true,
      assetTypeId: true,
      assetType: { select: { id: true, name: true } },
      status: true,
      processor: true,
      ramGb: true,
      storageGb: true,
      storageType: true,
      purchaseDate: true,
      warrantyEnd: true,
      usefulLifeYears: true,
      endOfLifeDate: true,
      assignedToName: true,
      location: { select: { id: true, name: true, parent: { select: { name: true } } } },
    },
    orderBy: { endOfLifeDate: "asc" },
  });

  /* Group by year-month */
  const byMonth: Record<string, typeof assets> = {};
  for (const a of assets) {
    if (!a.endOfLifeDate) continue;
    const key = `${a.endOfLifeDate.getFullYear()}-${String(a.endOfLifeDate.getMonth() + 1).padStart(2, "0")}`;
    (byMonth[key] ??= []).push(a);
  }

  return { year: targetYear, assets, byMonth };
};

/* ─── Custody Documents (Cartas Responsivas) ─── */

export const listCustodyDocs = async (assetId: number) => {
  return prisma.custodyDocument.findMany({
    where: { assetId },
    include: { uploadedBy: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
};

export const addCustodyDoc = async (
  assetId: number,
  file: { filename: string; originalName: string; mimeType: string; sizeBytes: number },
  uploadedById?: number,
) => {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new Error("Activo no encontrado");

  return prisma.custodyDocument.create({
    data: {
      assetId,
      assignedToName: asset.assignedToName ?? "Sin asignar",
      assignedToDate: asset.assignedToDate,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedById: uploadedById ?? null,
    },
    include: { uploadedBy: { select: { id: true, fullName: true } } },
  });
};

export const deleteCustodyDoc = async (docId: number) => {
  return prisma.custodyDocument.delete({ where: { id: docId } });
};

export const getCustodyDocById = async (docId: number) => {
  return prisma.custodyDocument.findUnique({ where: { id: docId } });
};
