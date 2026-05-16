import { Request, Response } from "express";
import { z } from "zod";
import {
  createHelpdeskTopic,
  listActiveTechUsers,
  listHelpdeskTopics,
  listLocations,
  updateHelpdeskTopic,
} from "./helpdesk-config.service";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listHelpdeskTopicsHandler = async (_req: Request, res: Response) => {
  try {
    const topics = await listHelpdeskTopics();
    return res.status(200).json({ topics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible listar temas de soporte";
    return res.status(400).json({ message });
  }
};

export const listTechUsersHandler = async (_req: Request, res: Response) => {
  try {
    const users = await listActiveTechUsers();
    return res.status(200).json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible listar usuarios tech";
    return res.status(400).json({ message });
  }
};

export const listLocationsHandler = async (_req: Request, res: Response) => {
  try {
    const locations = await listLocations();
    return res.status(200).json({ locations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible listar ubicaciones";
    return res.status(400).json({ message });
  }
};

export const createHelpdeskTopicHandler = async (req: Request, res: Response) => {
  try {
    const topic = await createHelpdeskTopic(req.body);
    return res.status(201).json({ topic });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible crear tema de soporte";
    return res.status(400).json({ message });
  }
};

export const updateHelpdeskTopicHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const topic = await updateHelpdeskTopic(id, req.body);
    return res.status(200).json({ topic });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible actualizar tema de soporte";
    if (message.includes("no encontrado")) {
      return res.status(404).json({ message });
    }
    return res.status(400).json({ message });
  }
};
