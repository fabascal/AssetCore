import { Request, Response } from "express";
import {
  getAssetsInventoryReport,
  getTicketsByZoneReport,
  getTicketsByTechReport,
  getAssetFailureHistory,
  getDepreciationReport,
  getScrapReport,
  getReportFilters,
} from "./reports.service";

export const filtersHandler = async (_req: Request, res: Response) => {
  const filters = await getReportFilters();
  res.json({ filters });
};

export const assetsInventoryHandler = async (req: Request, res: Response) => {
  const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const deviceType = typeof req.query.deviceType === "string" ? req.query.deviceType : undefined;
  const brand = typeof req.query.brand === "string" ? req.query.brand : undefined;

  const report = await getAssetsInventoryReport({ locationId, status, deviceType, brand });
  res.json(report);
};

export const ticketsByZoneHandler = async (req: Request, res: Response) => {
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;

  const report = await getTicketsByZoneReport({ dateFrom, dateTo });
  res.json(report);
};

export const ticketsByTechHandler = async (_req: Request, res: Response) => {
  const report = await getTicketsByTechReport();
  res.json(report);
};

export const failureHistoryHandler = async (req: Request, res: Response) => {
  const assetId = req.query.assetId ? Number(req.query.assetId) : undefined;
  const report = await getAssetFailureHistory(assetId);
  res.json(report);
};

export const depreciationHandler = async (_req: Request, res: Response) => {
  const report = await getDepreciationReport();
  res.json(report);
};

export const scrapHandler = async (_req: Request, res: Response) => {
  const report = await getScrapReport();
  res.json(report);
};
