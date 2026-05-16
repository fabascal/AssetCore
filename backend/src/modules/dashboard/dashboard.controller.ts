import { Request, Response } from "express";
import { getDashboardSummary } from "./dashboard.service";

export const getDashboardSummaryHandler = async (_req: Request, res: Response) => {
  const summary = await getDashboardSummary();
  return res.status(200).json({ summary });
};
