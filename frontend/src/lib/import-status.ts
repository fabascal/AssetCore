import type { AssetStatus } from "../types";

const STATUS_ALIASES: Record<string, AssetStatus> = {
  available: "AVAILABLE",
  disponible: "AVAILABLE",
  assigned: "ASSIGNED",
  asignado: "ASSIGNED",
  maintenance: "MAINTENANCE",
  mantenimiento: "MAINTENANCE",
  scrap: "SCRAP",
  baja: "SCRAP",
};

const ASSET_STATUSES: AssetStatus[] = ["AVAILABLE", "ASSIGNED", "MAINTENANCE", "SCRAP"];

export const normalizeImportStatus = (value: unknown): AssetStatus | null => {
  if (value == null || String(value).trim() === "") return null;

  const raw = String(value).trim();
  const upper = raw.toUpperCase();
  if (ASSET_STATUSES.includes(upper as AssetStatus)) {
    return upper as AssetStatus;
  }

  const key = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return STATUS_ALIASES[key] ?? null;
};

export const resolveImportAssetStatus = (input: {
  status?: AssetStatus | null;
  assignedToName?: string | null;
}): AssetStatus => {
  const hasAssignment = Boolean(input.assignedToName?.trim());
  const status = input.status ?? null;

  if (status && status !== "AVAILABLE") return status;
  if (hasAssignment) return "ASSIGNED";
  if (status) return status;
  return "AVAILABLE";
};

export const applyImportStatusRules = <T extends { status?: string; assignedToName?: string }>(row: T): T => ({
  ...row,
  status: resolveImportAssetStatus({
    status: normalizeImportStatus(row.status),
    assignedToName: row.assignedToName,
  }),
});
