type CatalogCapacity = { label: string; sizeGb: number };

export {
  formatProcessorLabel,
  resolveCatalogProcessor,
  buildProcessorImportInput,
  formatProcessorImportError,
  type CatalogProcessorEntry,
} from "./processors";
import { buildProcessorImportInput, formatProcessorImportError, resolveCatalogProcessor } from "./processors";
import { collectImportDateErrors } from "./import-dates";

export const resolveCatalogCapacity = (input: unknown, catalog: CatalogCapacity[]): CatalogCapacity | null => {
  if (input == null || String(input).trim() === "") return null;

  const raw = String(input).trim().toLowerCase();
  const byLabel = catalog.find((item) => item.label.toLowerCase() === raw);
  if (byLabel) return byLabel;

  const numeric = Number(raw.replace(/[^\d.]/g, ""));
  if (Number.isFinite(numeric) && numeric > 0) {
    const bySize = catalog.find((item) => item.sizeGb === Math.round(numeric));
    if (bySize) return bySize;
  }

  return catalog.find((item) => item.label.toLowerCase().includes(raw) || raw.includes(String(item.sizeGb))) ?? null;
};

export type ImportPreviewIssue = { row: number; message: string; severity: "error" | "warning" };

export type ImportPreviewContext = {
  assetTypeNames: string[];
  processors: import("./processors").CatalogProcessorEntry[];
  ramOptions: CatalogCapacity[];
  storageOptions: CatalogCapacity[];
  locationPaths: string[];
  defaultLocationId: number | null;
  resolveLocationId: (path: string) => number | null;
};

export type ImportPreviewRow = {
  brand: string;
  model: string;
  serialNumber: string;
  assetTypeName?: string;
  locationPath?: string;
  processor?: string;
  processorGeneration?: string;
  ramGb?: string;
  storageGb?: string;
  purchaseDate?: string;
  warrantyEnd?: string;
  assignedToDate?: string;
};

export const validateImportRows = (rows: ImportPreviewRow[], ctx: ImportPreviewContext): ImportPreviewIssue[] => {
  const issues: ImportPreviewIssue[] = [];
  const typeSet = new Set(ctx.assetTypeNames.map((name) => name.toLowerCase()));

  rows.forEach((row, index) => {
    const rowNum = index + 2;

    if (!row.brand?.trim() || !row.model?.trim() || !row.serialNumber?.trim()) {
      issues.push({ row: rowNum, message: "Marca, Modelo y No. Serie son obligatorios", severity: "error" });
    }

    if (row.assetTypeName && !typeSet.has(row.assetTypeName.toLowerCase().trim())) {
      issues.push({ row: rowNum, message: `Tipo "${row.assetTypeName}" no existe en catálogo`, severity: "error" });
    }

    const locationPath = row.locationPath?.trim();
    if (locationPath && !ctx.resolveLocationId(locationPath)) {
      issues.push({ row: rowNum, message: `Ubicación "${locationPath}" no encontrada`, severity: "error" });
    } else if (!locationPath && !ctx.defaultLocationId) {
      issues.push({ row: rowNum, message: "Sin ubicación (global ni por fila)", severity: "warning" });
    }

    if (row.processorGeneration?.trim() && !row.processor?.trim()) {
      issues.push({
        row: rowNum,
        message: "Generación de procesador sin nombre de procesador",
        severity: "error",
      });
    }

    const processorInput = buildProcessorImportInput(row.processor, row.processorGeneration);
    if (processorInput && !resolveCatalogProcessor(processorInput, ctx.processors)) {
      issues.push({
        row: rowNum,
        message: `Procesador "${formatProcessorImportError(row.processor, row.processorGeneration)}" no está en catálogo ITAM`,
        severity: "error",
      });
    }

    if (row.ramGb && !resolveCatalogCapacity(row.ramGb, ctx.ramOptions)) {
      issues.push({ row: rowNum, message: `RAM "${row.ramGb}" no está en catálogo ITAM`, severity: "error" });
    }

    if (row.storageGb && !resolveCatalogCapacity(row.storageGb, ctx.storageOptions)) {
      issues.push({ row: rowNum, message: `Almacenamiento "${row.storageGb}" no está en catálogo ITAM`, severity: "error" });
    }

    for (const message of collectImportDateErrors(row)) {
      issues.push({ row: rowNum, message, severity: "error" });
    }
  });

  return issues;
};
