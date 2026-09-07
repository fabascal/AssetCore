import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import QRCode from "qrcode";
import { z } from "zod";
import { createAsset, deleteAsset, decommissionAsset, getAssetById, getLifecycleReport, listAssets, updateAsset, listCustodyDocs, addCustodyDoc, deleteCustodyDoc, getCustodyDocById, bulkImportAssets } from "./assets.service";
import { getAssetDepreciation } from "../depreciation/depreciation.service";
import { AuthRequest } from "../../types/auth-request";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listAssetsHandler = async (_req: Request, res: Response) => {
  const assets = await listAssets();
  return res.status(200).json({ assets });
};

export const getAssetHandler = async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params);
  const asset = await getAssetById(id);

  if (!asset) {
    return res.status(404).json({ message: "Activo no encontrado" });
  }

  return res.status(200).json({ asset });
};

export const getAssetDepreciationHandler = async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params);
  const result = await getAssetDepreciation(id);

  if (!result) {
    return res.status(404).json({ message: "Activo no encontrado" });
  }

  if (!result.depreciation) {
    return res.status(422).json({
      ...result,
      message: result.warnings.join(" "),
    });
  }

  return res.status(200).json(result);
};

export const createAssetHandler = async (req: Request, res: Response) => {
  try {
    const asset = await createAsset(req.body);
    return res.status(201).json({ asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear activo";
    return res.status(400).json({ message });
  }
};

export const updateAssetHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const asset = await updateAsset(id, req.body);
    return res.status(200).json({ asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al actualizar activo";
    return res.status(400).json({ message });
  }
};

export const decommissionAssetHandler = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user?.id) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const { id } = idParamSchema.parse(req.params);
    const asset = await decommissionAsset(id, authReq.user.id, req.body);
    return res.status(200).json({ asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al dar de baja el activo";
    if (message.includes("no encontrado")) {
      return res.status(404).json({ message });
    }
    return res.status(400).json({ message });
  }
};

export const deleteAssetHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteAsset(id);
    return res.status(204).send();
  } catch (_error) {
    return res.status(404).json({ message: "Activo no encontrado" });
  }
};

export const getAssetQrHandler = async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params);
  const asset = await getAssetById(id);

  if (!asset) {
    return res.status(404).json({ message: "Activo no encontrado" });
  }

  const targetUrl = `https://tu-dominio.com/asset/${asset.assetCode}`;
  const qrBuffer = await QRCode.toBuffer(targetUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 300,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  res.setHeader("Content-Type", "image/png");
  return res.send(qrBuffer);
};

export const bulkImportHandler = async (req: Request, res: Response) => {
  try {
    const locationId = req.body.locationId ? Number(req.body.locationId) : null;
    const rows: unknown[] = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (rows.length === 0) return res.status(400).json({ message: "No se enviaron filas para importar" });
    const result = await bulkImportAssets({ locationId, rows });
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error en importación masiva";
    return res.status(400).json({ message });
  }
};

export const lifecycleReportHandler = async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const report = await getLifecycleReport(year);
    return res.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al generar reporte";
    return res.status(400).json({ message });
  }
};

/* ─── Custody Documents (Cartas Responsivas) ─── */

const CUSTODY_DIR = path.resolve(__dirname, "../../../uploads/custody");
if (!fs.existsSync(CUSTODY_DIR)) {
  fs.mkdirSync(CUSTODY_DIR, { recursive: true });
}

const custodyStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CUSTODY_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

const CUSTODY_ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
];

export const custodyUpload = multer({
  storage: custodyStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (CUSTODY_ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Solo se permiten imágenes (JPG, PNG, WebP) y PDF"));
  },
});

export const listCustodyDocsHandler = async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params);
  const docs = await listCustodyDocs(id);
  return res.json({ docs });
};

export const uploadCustodyDocHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No se envió archivo" });
    const authReq = req as AuthRequest;
    const doc = await addCustodyDoc(id, {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    }, authReq.user?.id);
    return res.status(201).json({ doc });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al subir carta responsiva";
    return res.status(400).json({ message });
  }
};

export const downloadCustodyDocHandler = async (req: Request, res: Response) => {
  const docId = z.coerce.number().int().positive().parse(req.params.docId);
  const doc = await getCustodyDocById(docId);
  if (!doc) return res.status(404).json({ message: "Documento no encontrado" });
  const filePath = path.join(CUSTODY_DIR, doc.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: "El archivo ya no existe en el servidor" });
  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${doc.originalName}"`);
  return res.sendFile(filePath);
};

export const deleteCustodyDocHandler = async (req: Request, res: Response) => {
  try {
    const docId = z.coerce.number().int().positive().parse(req.params.docId);
    const doc = await getCustodyDocById(docId);
    if (!doc) return res.status(404).json({ message: "Documento no encontrado" });
    const filePath = path.join(CUSTODY_DIR, doc.filename);
    await deleteCustodyDoc(docId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(204).send();
  } catch (_error) {
    return res.status(404).json({ message: "Documento no encontrado" });
  }
};
