import { assetStatuses, type AssetStatus } from "../modules/assets/assets.types";

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

export const normalizeImportStatus = (value: unknown): AssetStatus | null => {
  if (value == null || String(value).trim() === "") return null;

  const raw = String(value).trim();
  const upper = raw.toUpperCase();
  if ((assetStatuses as readonly string[]).includes(upper)) {
    return upper as AssetStatus;
  }

  const key = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return STATUS_ALIASES[key] ?? null;
};

/** Si hay persona asignada, el activo queda ASSIGNED salvo un estado explícito distinto de AVAILABLE. */
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
