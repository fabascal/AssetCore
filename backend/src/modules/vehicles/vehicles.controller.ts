import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { z } from "zod";
import {
  createVehicle, deleteVehicle, decommissionVehicle, getVehicleById,
  listVehicles, updateVehicle, listVehicleDocs, addVehicleDoc,
  deleteVehicleDoc, getVehicleDocById, bulkImportVehicles,
} from "./vehicles.service";
import { vehicleDocumentTypes, type VehicleDocumentType } from "./vehicles.types";
import { AuthRequest } from "../../types/auth-request";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listVehiclesHandler = async (_req: Request, res: Response) => {
  const vehicles = await listVehicles();
  return res.status(200).json({ vehicles });
};

export const getVehicleHandler = async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params);
  const vehicle = await getVehicleById(id);
  if (!vehicle) return res.status(404).json({ message: "Vehiculo no encontrado" });
  return res.status(200).json({ vehicle });
};

export const createVehicleHandler = async (req: Request, res: Response) => {
  try {
    const vehicle = await createVehicle(req.body);
    return res.status(201).json({ vehicle });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear vehiculo";
    return res.status(400).json({ message });
  }
};

export const updateVehicleHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const vehicle = await updateVehicle(id, req.body);
    return res.status(200).json({ vehicle });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar vehiculo";
    return res.status(400).json({ message });
  }
};

export const decommissionVehicleHandler = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user?.id) return res.status(401).json({ message: "No autenticado" });
    const { id } = idParamSchema.parse(req.params);
    const vehicle = await decommissionVehicle(id, authReq.user.id, req.body);
    return res.status(200).json({ vehicle });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al dar de baja el vehiculo";
    if (message.includes("no encontrado")) return res.status(404).json({ message });
    return res.status(400).json({ message });
  }
};

export const deleteVehicleHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteVehicle(id);
    return res.status(204).send();
  } catch (_error) {
    return res.status(404).json({ message: "Vehiculo no encontrado" });
  }
};

export const bulkImportVehiclesHandler = async (req: Request, res: Response) => {
  try {
    const locationId = req.body.locationId ? Number(req.body.locationId) : null;
    const rows: unknown[] = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (rows.length === 0) return res.status(400).json({ message: "No se enviaron filas para importar" });
    const result = await bulkImportVehicles({ locationId, rows });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error en importacion masiva";
    return res.status(400).json({ message });
  }
};

/* ─── Documents ─── */

const VEHICLE_DOCS_DIR = path.resolve(__dirname, "../../../uploads/vehicles");
if (!fs.existsSync(VEHICLE_DOCS_DIR)) {
  fs.mkdirSync(VEHICLE_DOCS_DIR, { recursive: true });
}

const vehicleDocStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VEHICLE_DOCS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

const VEHICLE_DOC_ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
];

export const vehicleDocUpload = multer({
  storage: vehicleDocStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (VEHICLE_DOC_ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Solo se permiten imagenes (JPG, PNG, WebP) y PDF"));
  },
});

export const listVehicleDocsHandler = async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params);
  const docs = await listVehicleDocs(id);
  return res.json({ docs });
};

export const uploadVehicleDocHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No se envio archivo" });

    const docType = req.body.documentType as VehicleDocumentType;
    if (!docType || !vehicleDocumentTypes.includes(docType)) {
      return res.status(400).json({ message: "Tipo de documento invalido" });
    }

    const authReq = req as AuthRequest;
    const doc = await addVehicleDoc(id, docType, {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    }, {
      description: req.body.description || undefined,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      uploadedById: authReq.user?.id,
    });
    return res.status(201).json({ doc });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al subir documento";
    return res.status(400).json({ message });
  }
};

export const downloadVehicleDocHandler = async (req: Request, res: Response) => {
  const docId = z.coerce.number().int().positive().parse(req.params.docId);
  const doc = await getVehicleDocById(docId);
  if (!doc) return res.status(404).json({ message: "Documento no encontrado" });
  const filePath = path.join(VEHICLE_DOCS_DIR, doc.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: "El archivo ya no existe en el servidor" });
  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${doc.originalName}"`);
  return res.sendFile(filePath);
};

export const deleteVehicleDocHandler = async (req: Request, res: Response) => {
  try {
    const docId = z.coerce.number().int().positive().parse(req.params.docId);
    const doc = await getVehicleDocById(docId);
    if (!doc) return res.status(404).json({ message: "Documento no encontrado" });
    const filePath = path.join(VEHICLE_DOCS_DIR, doc.filename);
    await deleteVehicleDoc(docId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(204).send();
  } catch (_error) {
    return res.status(404).json({ message: "Documento no encontrado" });
  }
};
