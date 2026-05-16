import { Router } from "express";
import { checkPermission } from "../../middlewares/permission.middleware";
import {
  addCommentHandler,
  createTicketHandler,
  downloadAttachmentHandler,
  getTicketByIdHandler,
  listTicketTopicsHandler,
  listTicketsHandler,
  reassignTicketHandler,
  transitionTicketHandler,
  upload,
  uploadAttachmentHandler,
} from "./tickets.controller";

const ticketsRouter = Router();

ticketsRouter.get("/topics", checkPermission("tickets.read"), listTicketTopicsHandler);
ticketsRouter.get("/attachments/:id/download", checkPermission("tickets.read"), downloadAttachmentHandler);
ticketsRouter.get("/", checkPermission("tickets.read"), listTicketsHandler);
ticketsRouter.get("/:id", checkPermission("tickets.read"), getTicketByIdHandler);
ticketsRouter.post("/", checkPermission("tickets.write"), createTicketHandler);
ticketsRouter.put("/:id/transition", checkPermission("tickets.write"), transitionTicketHandler);
ticketsRouter.put("/:id/reassign", checkPermission("tickets.write"), reassignTicketHandler);
ticketsRouter.post("/:id/comments", checkPermission("tickets.write"), addCommentHandler);
ticketsRouter.post("/:id/attachments", checkPermission("tickets.write"), upload.single("file"), uploadAttachmentHandler);

export default ticketsRouter;
