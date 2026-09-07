import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { buildLocationPathMap, resolveLocationIdByPath } from "../../shared/location.utils";
import { resolveCatalogCapacity, resolveCatalogProcessor } from "../../shared/import-catalog.utils";
import {
  buildProcessorImportInput,
  formatProcessorImportError,
} from "../../shared/processor.utils";
import { collectImportDateErrors, normalizeImportRowDates } from "../../shared/import-date.utils";
import { normalizeImportStatus, resolveImportAssetStatus } from "../../shared/import-status.utils";
import { assetStatuses, assetDecommissionReasons, storageTypes } from "./assets.types";

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
  purchasePrice: z.coerce.number().nonnegative().nullable().optional(),
  salvageValue: z.coerce.number().nonnegative().optional(),
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

const decommissionAssetSchema = z
  .object({
    reason: z.enum(assetDecommissionReasons),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .refine((payload) => payload.reason !== "OTHER" || (payload.notes && payload.notes.trim().length >= 3), {
    message: 'Describe el motivo cuando seleccionas "Otro"',
  });

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

const attachLocationPaths = async <T extends { locationId: number | null }>(assets: T[]) => {
  const rows = await prisma.location.findMany({ select: { id: true, name: true, parentId: true } });
  const paths = buildLocationPathMap(rows);

  return assets.map((asset) => ({
    ...asset,
    locationPath: asset.locationId ? paths.get(asset.locationId) ?? null : null,
  }));
};

export const listAssets = async () => {
  const assets = await prisma.asset.findMany({
    where: {
      status: { not: "SCRAP" },
    },
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

  return attachLocationPaths(assets);
};

export const getAssetById = async (id: number) => {
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      assetType: { select: { id: true, name: true, usefulLifeYears: true } },
      location: { select: { id: true, name: true, parentId: true, parent: { select: { id: true, name: true } } } },
      decommissionedBy: { select: { id: true, fullName: true, email: true } },
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

  if (!asset) return null;
  const [withPath] = await attachLocationPaths([asset]);
  return withPath;
};

export const createAsset = async (payload: unknown) => {
  const parsed = createAssetSchema.parse(payload);
  const assetCode = await generateUniqueAssetCode();

  const usefulLife = parsed.usefulLifeYears ?? 5;
  const endOfLifeDate = calcEndOfLife(parsed.purchaseDate, usefulLife);
  const purchasePrice = parsed.purchasePrice ?? parsed.equipmentValue ?? null;

  return prisma.asset.create({
    data: {
      assetCode,
      brand: parsed.brand,
      model: parsed.model,
      serialNumber: parsed.serialNumber,
      equipmentValue: parsed.equipmentValue ?? purchasePrice,
      purchasePrice,
      salvageValue: parsed.salvageValue ?? 0,
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

  if (parsed.status === "SCRAP") {
    throw new Error("Para dar de baja un activo usa el endpoint de baja con motivo");
  }

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

export const decommissionAsset = async (id: number, userId: number, payload: unknown) => {
  const parsed = decommissionAssetSchema.parse(payload);

  const current = await prisma.asset.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!current) {
    throw new Error("Activo no encontrado");
  }
  if (current.status === "SCRAP") {
    throw new Error("El activo ya está dado de baja");
  }

  return prisma.asset.update({
    where: { id },
    data: {
      status: "SCRAP",
      assignedToName: null,
      assignedToDate: null,
      decommissionReason: parsed.reason,
      decommissionNotes: parsed.notes?.trim() || null,
      decommissionedAt: new Date(),
      decommissionedById: userId,
    },
    include: {
      assetType: { select: { id: true, name: true, usefulLifeYears: true } },
      location: { select: { id: true, name: true, parentId: true, parent: { select: { id: true, name: true } } } },
      decommissionedBy: { select: { id: true, fullName: true, email: true } },
    },
  });
};

export const deleteAsset = async (id: number) => {
  return prisma.asset.delete({
    where: { id },
  });
};

/* ─── Bulk Import ─── */

const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" || value === undefined ? null : value), schema);

const importRowSchema = z.object({
  brand:          z.string().min(1, "Marca requerida"),
  model:          z.string().min(1, "Modelo requerido"),
  serialNumber:   z.string().min(1, "No. Serie requerido"),
  assetTypeName:  emptyToNull(z.string().nullable().optional()),
  locationPath:   emptyToNull(z.string().nullable().optional()),
  status:         z.preprocess((value) => normalizeImportStatus(value), z.enum(assetStatuses).nullable().optional()),
  processor:      emptyToNull(z.string().nullable().optional()),
  processorGeneration: emptyToNull(z.string().nullable().optional()),
  ramGb:          emptyToNull(z.union([z.string(), z.number()]).nullable().optional()),
  storageGb:      emptyToNull(z.union([z.string(), z.number()]).nullable().optional()),
  storageType:    emptyToNull(z.enum(storageTypes).nullable().optional()),
  purchaseDate:   emptyToNull(z.coerce.date().nullable().optional()),
  warrantyEnd:    emptyToNull(z.coerce.date().nullable().optional()),
  purchasePrice:  emptyToNull(z.coerce.number().nonnegative().nullable().optional()),
  salvageValue:   emptyToNull(z.coerce.number().nonnegative().nullable().optional()),
  equipmentValue: emptyToNull(z.coerce.number().nonnegative().nullable().optional()),
  assignedToName: emptyToNull(z.string().nullable().optional()),
  assignedToDate: emptyToNull(z.coerce.date().nullable().optional()),
});

type ImportRow = z.infer<typeof importRowSchema>;

export const bulkImportAssets = async (payload: {
  locationId?: number | null;
  rows: unknown[];
}) => {
  const [assetTypesAll, processorsAll, ramAll, storageAll, locationRows] = await Promise.all([
    prisma.assetType.findMany({ select: { id: true, name: true, usefulLifeYears: true } }),
    prisma.catalogProcessor.findMany({ where: { isActive: true }, select: { name: true, generation: true } }),
    prisma.catalogRam.findMany({ where: { isActive: true }, select: { label: true, sizeGb: true } }),
    prisma.catalogStorage.findMany({ where: { isActive: true }, select: { label: true, sizeGb: true } }),
    prisma.location.findMany({ select: { id: true, name: true, parentId: true } }),
  ]);

  const typeByName = new Map(assetTypesAll.map((t) => [t.name.toLowerCase().trim(), t.id]));

  const results: { row: number; assetCode: string }[] = [];
  const errors:  { row: number; message: string }[]   = [];

  for (let i = 0; i < payload.rows.length; i++) {
    const rowNum = i + 2; // 1-based + header row
    const rawRow = payload.rows[i];
    const dateErrors = collectImportDateErrors(
      rawRow && typeof rawRow === "object" ? (rawRow as Record<string, unknown>) : {},
    );
    if (dateErrors.length > 0) {
      errors.push({ row: rowNum, message: dateErrors.join("; ") });
      continue;
    }

    let parsed: ImportRow;
    try {
      parsed = importRowSchema.parse(normalizeImportRowDates(
        rawRow && typeof rawRow === "object" ? (rawRow as Record<string, unknown>) : {},
      ));
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

    /* Resolve location: per-row path overrides global default */
    let locationId = payload.locationId ?? null;
    if (parsed.locationPath) {
      const resolvedLocationId = resolveLocationIdByPath(parsed.locationPath, locationRows);
      if (!resolvedLocationId) {
        errors.push({ row: rowNum, message: `Ubicación "${parsed.locationPath}" no encontrada` });
        continue;
      }
      locationId = resolvedLocationId;
    }

    /* Resolve hardware specs against ITAM catalogs (optional for switches, printers, etc.) */
    if (parsed.processorGeneration?.trim() && !parsed.processor?.trim()) {
      errors.push({ row: rowNum, message: "Generación de procesador sin nombre de procesador" });
      continue;
    }

    let processor: string | null = null;
    const processorInput = buildProcessorImportInput(parsed.processor, parsed.processorGeneration);
    if (processorInput) {
      processor = resolveCatalogProcessor(processorInput, processorsAll);
      if (!processor) {
        errors.push({
          row: rowNum,
          message: `Procesador "${formatProcessorImportError(parsed.processor, parsed.processorGeneration)}" no existe en catálogo ITAM`,
        });
        continue;
      }
    }

    let ramGb: number | null = null;
    if (parsed.ramGb != null) {
      const ramMatch = resolveCatalogCapacity(parsed.ramGb, ramAll);
      if (!ramMatch) {
        errors.push({ row: rowNum, message: `RAM "${parsed.ramGb}" no existe en catálogo ITAM` });
        continue;
      }
      ramGb = ramMatch.sizeGb;
    }

    let storageGb: number | null = null;
    if (parsed.storageGb != null) {
      const storageMatch = resolveCatalogCapacity(parsed.storageGb, storageAll);
      if (!storageMatch) {
        errors.push({ row: rowNum, message: `Almacenamiento "${parsed.storageGb}" no existe en catálogo ITAM` });
        continue;
      }
      storageGb = storageMatch.sizeGb;
    }

    /* Resolve useful life from type */
    const assetTypeRecord = assetTypeId ? assetTypesAll.find((t) => t.id === assetTypeId) : null;
    const effectiveLife = assetTypeRecord?.usefulLifeYears ?? 5;

    const endOfLifeDate = calcEndOfLife(parsed.purchaseDate ?? null, effectiveLife);
    const purchasePrice = parsed.purchasePrice ?? parsed.equipmentValue ?? null;
    const salvageValue = parsed.salvageValue ?? 0;
    const status = resolveImportAssetStatus({
      status: parsed.status ?? null,
      assignedToName: parsed.assignedToName,
    });

    try {
      const assetCode = await generateUniqueAssetCode();
      await prisma.asset.create({
        data: {
          assetCode,
          brand:          parsed.brand,
          model:          parsed.model,
          serialNumber:   parsed.serialNumber,
          status,
          assetTypeId,
          processor,
          ramGb,
          storageGb,
          storageType:    parsed.storageType     ?? null,
          purchaseDate:   parsed.purchaseDate    ?? null,
          warrantyEnd:    parsed.warrantyEnd     ?? null,
          purchasePrice,
          salvageValue,
          equipmentValue: purchasePrice ?? parsed.equipmentValue ?? null,
          assignedToName: parsed.assignedToName  ?? null,
          assignedToDate: parsed.assignedToDate  ?? null,
          usefulLifeYears: effectiveLife,
          endOfLifeDate,
          locationId,
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
      locationId: true,
      location: { select: { id: true, name: true, parentId: true, parent: { select: { name: true } } } },
    },
    orderBy: { endOfLifeDate: "asc" },
  });

  const assetsWithPaths = await attachLocationPaths(assets);

  /* Group by year-month */
  const byMonth: Record<string, typeof assetsWithPaths> = {};
  for (const a of assetsWithPaths) {
    if (!a.endOfLifeDate) continue;
    const key = `${a.endOfLifeDate.getFullYear()}-${String(a.endOfLifeDate.getMonth() + 1).padStart(2, "0")}`;
    (byMonth[key] ??= []).push(a);
  }

  return { year: targetYear, assets: assetsWithPaths, byMonth };
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
