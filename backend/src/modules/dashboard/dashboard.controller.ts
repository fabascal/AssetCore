import { Request, Response } from "express";
import { getDashboardSummary } from "./dashboard.service";
import { getFinancialSummary } from "../depreciation/depreciation.service";

export const getDashboardSummaryHandler = async (_req: Request, res: Response) => {
  const summary = await getDashboardSummary();
  return res.status(200).json({ summary });
};

export const getFinancialSummaryHandler = async (_req: Request, res: Response) => {
  const summary = await getFinancialSummary();
  return res.status(200).json({ summary });
};
