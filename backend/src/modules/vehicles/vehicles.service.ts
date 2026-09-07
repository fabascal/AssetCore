import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { buildLocationPathMap, resolveLocationIdByPath } from "../../shared/location.utils";
import { collectImportDateErrors, normalizeImportRowDates } from "../../shared/import-date.utils";
import { normalizeImportStatus, resolveImportAssetStatus } from "../../shared/import-status.utils";
import { assetStatuses, assetDecommissionReasons } from "../assets/assets.types";
import { vehicleTypes, vehicleDocumentTypes, type VehicleDocumentType } from "./vehicles.types";

const calcEndOfLife = (purchaseDate: Date | null | undefined, usefulLifeYears: number | null | undefined): Date | null => {
  if (!purchaseDate || !usefulLifeYears) return null;
  const eol = new Date(purchaseDate);
  eol.setFullYear(eol.getFullYear() + usefulLifeYears);
  return eol;
};

const generateUniqueVehicleCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `VEH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const exists = await prisma.vehicle.findUnique({ where: { vehicleCode: candidate } });
    if (!exists) return candidate;
  }
  throw new Error("No se pudo generar un VehicleCode unico");
};

const attachLocationPaths = async <T extends { locationId: number | null }>(items: T[]) => {
  const rows = await prisma.location.findMany({ select: { id: true, name: true, parentId: true } });
  const paths = buildLocationPathMap(rows);
  return items.map((item) => ({
    ...item,
    locationPath: item.locationId ? paths.get(item.locationId) ?? null : null,
  }));
};

/* ─── Schemas ─── */

const createVehicleSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.coerce.number().int().min(1900).max(2100).nullable().optional(),
  color: z.string().nullable().optional(),
  plateNumber: z.string().min(1),
  serialNumber: z.string().nullable().optional(),
  engineNumber: z.string().nullable().optional(),
  vehicleType: z.enum(vehicleTypes).default("OTHER"),
  mileage: z.coerce.number().int().nonnegative().nullable().optional(),
  status: z.enum(assetStatuses).default("AVAILABLE"),
  purchaseDate: z.coerce.date().nullable().optional(),
  purchasePrice: z.coerce.number().nonnegative().nullable().optional(),
  salvageValue: z.coerce.number().nonnegative().optional(),
  warrantyEnd: z.coerce.date().nullable().optional(),
  usefulLifeYears: z.coerce.number().int().positive().nullable().optional(),
  locationId: z.coerce.number().int().positive().nullable().optional(),
  assignedToName: z.string().nullable().optional(),
  assignedToDate: z.coerce.date().nullable().optional(),
  specifications: z.record(z.string(), z.string()).default({}),
});

const updateVehicleSchema = createVehicleSchema.partial();

const decommissionVehicleSchema = z
  .object({
    reason: z.enum(assetDecommissionReasons),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .refine((payload) => payload.reason !== "OTHER" || (payload.notes && payload.notes.trim().length >= 3), {
    message: 'Describe el motivo cuando seleccionas "Otro"',
  });

/* ─── CRUD ─── */

export const listVehicles = async () => {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: { not: "SCRAP" } },
    include: {
      location: { select: { id: true, name: true, parentId: true, parent: { select: { id: true, name: true } } } },
      documents: {
        select: { id: true, documentType: true, expiresAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return attachLocationPaths(vehicles);
};

export const getVehicleById = async (id: number) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      location: { select: { id: true, name: true, parentId: true, parent: { select: { id: true, name: true } } } },
      decommissionedBy: { select: { id: true, fullName: true, email: true } },
      documents: {
        include: { uploadedBy: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!vehicle) return null;
  const [withPath] = await attachLocationPaths([vehicle]);
  return withPath;
};

export const createVehicle = async (payload: unknown) => {
  const parsed = createVehicleSchema.parse(payload);
  const vehicleCode = await generateUniqueVehicleCode();
  const usefulLife = parsed.usefulLifeYears ?? 5;
  const endOfLifeDate = calcEndOfLife(parsed.purchaseDate, usefulLife);

  return prisma.vehicle.create({
    data: {
      vehicleCode,
      brand: parsed.brand,
      model: parsed.model,
      year: parsed.year ?? null,
      color: parsed.color ?? null,
      plateNumber: parsed.plateNumber,
      serialNumber: parsed.serialNumber ?? null,
      engineNumber: parsed.engineNumber ?? null,
      vehicleType: parsed.vehicleType,
      mileage: parsed.mileage ?? null,
      status: parsed.status,
      purchaseDate: parsed.purchaseDate ?? null,
      purchasePrice: parsed.purchasePrice ?? null,
      salvageValue: parsed.salvageValue ?? 0,
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

export const updateVehicle = async (id: number, payload: unknown) => {
  const parsed = updateVehicleSchema.parse(payload);

  if (parsed.status === "SCRAP") {
    throw new Error("Para dar de baja un vehiculo usa el endpoint de baja con motivo");
  }

  const current = await prisma.vehicle.findUnique({ where: { id } });
  if (!current) throw new Error("Vehiculo no encontrado");

  const purchaseDate = parsed.purchaseDate !== undefined ? parsed.purchaseDate : current.purchaseDate;
  const usefulLife = parsed.usefulLifeYears !== undefined
    ? parsed.usefulLifeYears
    : current.usefulLifeYears ?? 5;
  const endOfLifeDate = calcEndOfLife(purchaseDate, usefulLife);

  return prisma.vehicle.update({
    where: { id },
    data: {
      ...parsed,
      usefulLifeYears: usefulLife,
      endOfLifeDate,
    },
  });
};

export const decommissionVehicle = async (id: number, userId: number, payload: unknown) => {
  const parsed = decommissionVehicleSchema.parse(payload);

  const current = await prisma.vehicle.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!current) throw new Error("Vehiculo no encontrado");
  if (current.status === "SCRAP") throw new Error("El vehiculo ya esta dado de baja");

  return prisma.vehicle.update({
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
      location: { select: { id: true, name: true, parentId: true, parent: { select: { id: true, name: true } } } },
      decommissionedBy: { select: { id: true, fullName: true, email: true } },
    },
  });
};

export const deleteVehicle = async (id: number) => {
  return prisma.vehicle.delete({ where: { id } });
};

/* ─── Documents ─── */

export const listVehicleDocs = async (vehicleId: number) => {
  return prisma.vehicleDocument.findMany({
    where: { vehicleId },
    include: { uploadedBy: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
};

export const addVehicleDoc = async (
  vehicleId: number,
  docType: VehicleDocumentType,
  file: { filename: string; originalName: string; mimeType: string; sizeBytes: number },
  options?: { description?: string; expiresAt?: Date | null; uploadedById?: number },
) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw new Error("Vehiculo no encontrado");

  return prisma.vehicleDocument.create({
    data: {
      vehicleId,
      documentType: docType,
      description: options?.description ?? null,
      expiresAt: options?.expiresAt ?? null,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedById: options?.uploadedById ?? null,
    },
    include: { uploadedBy: { select: { id: true, fullName: true } } },
  });
};

export const deleteVehicleDoc = async (docId: number) => {
  return prisma.vehicleDocument.delete({ where: { id: docId } });
};

export const getVehicleDocById = async (docId: number) => {
  return prisma.vehicleDocument.findUnique({ where: { id: docId } });
};

/* ─── Bulk Import ─── */

const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" || value === undefined ? null : value), schema);

const importRowSchema = z.object({
  brand:         z.string().min(1, "Marca requerida"),
  model:         z.string().min(1, "Modelo requerido"),
  year:          emptyToNull(z.coerce.number().int().min(1900).max(2100).nullable().optional()),
  color:         emptyToNull(z.string().nullable().optional()),
  plateNumber:   z.string().min(1, "Placa requerida"),
  serialNumber:  emptyToNull(z.string().nullable().optional()),
  engineNumber:  emptyToNull(z.string().nullable().optional()),
  vehicleType:   emptyToNull(z.enum(vehicleTypes).nullable().optional()),
  mileage:       emptyToNull(z.coerce.number().int().nonnegative().nullable().optional()),
  status:        z.preprocess((value) => normalizeImportStatus(value), z.enum(assetStatuses).nullable().optional()),
  locationPath:  emptyToNull(z.string().nullable().optional()),
  purchaseDate:  emptyToNull(z.coerce.date().nullable().optional()),
  purchasePrice: emptyToNull(z.coerce.number().nonnegative().nullable().optional()),
  salvageValue:  emptyToNull(z.coerce.number().nonnegative().nullable().optional()),
  warrantyEnd:   emptyToNull(z.coerce.date().nullable().optional()),
  assignedToName: emptyToNull(z.string().nullable().optional()),
  assignedToDate: emptyToNull(z.coerce.date().nullable().optional()),
});

type ImportRow = z.infer<typeof importRowSchema>;

export const bulkImportVehicles = async (payload: {
  locationId?: number | null;
  rows: unknown[];
}) => {
  const locationRows = await prisma.location.findMany({ select: { id: true, name: true, parentId: true } });

  const results: { row: number; vehicleCode: string }[] = [];
  const errors:  { row: number; message: string }[] = [];

  for (let i = 0; i < payload.rows.length; i++) {
    const rowNum = i + 2;
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
      const msg = err instanceof Error ? err.message : "Fila invalida";
      errors.push({ row: rowNum, message: msg });
      continue;
    }

    /* Check duplicate plate */
    const existingPlate = await prisma.vehicle.findUnique({ where: { plateNumber: parsed.plateNumber } });
    if (existingPlate) {
      errors.push({ row: rowNum, message: `Placa "${parsed.plateNumber}" ya existe (${existingPlate.vehicleCode})` });
      continue;
    }

    /* Check duplicate serial if provided */
    if (parsed.serialNumber) {
      const existingSerial = await prisma.vehicle.findUnique({ where: { serialNumber: parsed.serialNumber } });
      if (existingSerial) {
        errors.push({ row: rowNum, message: `No. Serie "${parsed.serialNumber}" ya existe (${existingSerial.vehicleCode})` });
        continue;
      }
    }

    /* Resolve location */
    let locationId = payload.locationId ?? null;
    if (parsed.locationPath) {
      const resolvedLocationId = resolveLocationIdByPath(parsed.locationPath, locationRows);
      if (!resolvedLocationId) {
        errors.push({ row: rowNum, message: `Ubicacion "${parsed.locationPath}" no encontrada` });
        continue;
      }
      locationId = resolvedLocationId;
    }

    const usefulLife = 5;
    const endOfLifeDate = calcEndOfLife(parsed.purchaseDate ?? null, usefulLife);
    const status = resolveImportAssetStatus({
      status: parsed.status ?? null,
      assignedToName: parsed.assignedToName,
    });

    try {
      const vehicleCode = await generateUniqueVehicleCode();
      await prisma.vehicle.create({
        data: {
          vehicleCode,
          brand:          parsed.brand,
          model:          parsed.model,
          year:           parsed.year ?? null,
          color:          parsed.color ?? null,
          plateNumber:    parsed.plateNumber,
          serialNumber:   parsed.serialNumber ?? null,
          engineNumber:   parsed.engineNumber ?? null,
          vehicleType:    parsed.vehicleType ?? "OTHER",
          mileage:        parsed.mileage ?? null,
          status,
          purchaseDate:   parsed.purchaseDate ?? null,
          purchasePrice:  parsed.purchasePrice ?? null,
          salvageValue:   parsed.salvageValue ?? 0,
          warrantyEnd:    parsed.warrantyEnd ?? null,
          usefulLifeYears: usefulLife,
          endOfLifeDate,
          locationId,
          assignedToName: parsed.assignedToName ?? null,
          assignedToDate: parsed.assignedToDate ?? null,
          specifications: {},
        },
      });
      results.push({ row: rowNum, vehicleCode });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al crear vehiculo";
      errors.push({ row: rowNum, message: msg });
    }
  }

  return { imported: results.length, skipped: errors.length, results, errors };
};
