import { Request, Response } from "express";
import { z } from "zod";
import { addAttachment, addComment, createTicket, getTicketById, listTicketTopics, listTickets, reassignTicket, transitionTicket } from "./tickets.service";
import { AuthRequest } from "../../types/auth-request";
import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = path.resolve(__dirname, "../../../uploads/tickets");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de archivo no permitido"));
    }
  },
});

const querySchema = z.object({
  assetId: z.string().optional(),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listTicketsHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const parsed = querySchema.parse(req.query);
  const assetId = parsed.assetId ? Number(parsed.assetId) : undefined;
  const tickets = await listTickets({
    assetId,
    userId: authReq.user?.id,
    roleName: authReq.user?.roleName,
  });
  return res.status(200).json({ tickets });
};

export const getTicketByIdHandler = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id } = idParamSchema.parse(req.params);
    const ticket = await getTicketById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket no encontrado" });
    }
    if (authReq.user?.roleName !== "admin" && ticket.assignedToId !== authReq.user?.id) {
      return res.status(403).json({ message: "No tienes acceso a este ticket" });
    }
    return res.status(200).json({ ticket });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible obtener el ticket";
    return res.status(400).json({ message });
  }
};

export const listTicketTopicsHandler = async (_req: Request, res: Response) => {
  const topics = await listTicketTopics();
  return res.status(200).json({ topics });
};

export const createTicketHandler = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const ticket = await createTicket(req.body, authReq.user?.id);
    return res.status(201).json({ ticket });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible crear el ticket";
    return res.status(400).json({ message });
  }
};

export const transitionTicketHandler = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id } = idParamSchema.parse(req.params);
    const ticket = await transitionTicket(id, req.body, authReq.user?.id);
    return res.status(200).json({ ticket });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible cambiar el ticket";
    return res.status(400).json({ message });
  }
};

export const reassignTicketHandler = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id } = idParamSchema.parse(req.params);
    const ticket = await reassignTicket(id, req.body, authReq.user?.id);
    return res.status(200).json({ ticket });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible reasignar el ticket";
    return res.status(400).json({ message });
  }
};

export const addCommentHandler = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id } = idParamSchema.parse(req.params);
    const { body } = z.object({ body: z.string().min(1) }).parse(req.body);
    const comment = await addComment(id, body, authReq.user?.id);
    return res.status(201).json({ comment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible agregar comentario";
    return res.status(400).json({ message });
  }
};

export const uploadAttachmentHandler = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { id } = idParamSchema.parse(req.params);
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No se envio archivo" });
    }
    const attachment = await addAttachment(
      id,
      {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
      authReq.user?.id
    );
    return res.status(201).json({ attachment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible subir archivo";
    return res.status(400).json({ message });
  }
};

export const downloadAttachmentHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { prisma } = await import("../../shared/prisma");
    const attachment = await prisma.ticketAttachment.findUnique({ where: { id } });
    if (!attachment) {
      return res.status(404).json({ message: "Archivo no encontrado" });
    }
    const filePath = path.join(UPLOADS_DIR, attachment.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "El archivo ya no existe en el servidor" });
    }
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${attachment.originalName}"`);
    return res.sendFile(filePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible descargar archivo";
    return res.status(400).json({ message });
  }
};
