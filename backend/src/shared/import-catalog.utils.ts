type CatalogCapacity = { label: string; sizeGb: number };

const isBlank = (value: unknown) => value == null || String(value).trim() === "";

export { formatProcessorLabel, resolveCatalogProcessor, buildProcessorImportInput, formatProcessorImportError } from "./processor.utils";

export const resolveCatalogCapacity = (
  input: unknown,
  catalog: CatalogCapacity[],
): { label: string; sizeGb: number } | null => {
  if (isBlank(input)) return null;

  const raw = String(input).trim().toLowerCase();
  const byLabel = catalog.find((item) => item.label.toLowerCase() === raw);
  if (byLabel) return byLabel;

  const numeric = Number(raw.replace(/[^\d.]/g, ""));
  if (Number.isFinite(numeric) && numeric > 0) {
    const bySize = catalog.find((item) => item.sizeGb === Math.round(numeric));
    if (bySize) return bySize;
  }

  const byPartial = catalog.find(
    (item) => item.label.toLowerCase().includes(raw) || raw.includes(String(item.sizeGb)),
  );
  return byPartial ?? null;
};
