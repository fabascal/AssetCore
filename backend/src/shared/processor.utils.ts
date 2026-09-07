export type CatalogProcessorEntry = {
  name: string;
  generation?: string | null;
};

export const formatProcessorLabel = (entry: CatalogProcessorEntry): string => {
  const name = entry.name.trim();
  const generation = entry.generation?.trim();
  if (!generation) return name;
  return `${name} (Gen ${generation})`;
};

/** Combina columnas Procesador + Generacion del CSV de importación. */
export const buildProcessorImportInput = (
  processor?: string | null,
  generation?: string | null,
): string | null => {
  const name = processor?.trim();
  const gen = generation?.trim().replace(/^gen\.?\s*/i, "");
  if (!name) return null;
  if (!gen) return name;

  const lower = name.toLowerCase();
  if (lower.includes("(gen ") || /\sgen\s+\d/.test(lower)) return name;

  return `${name} (Gen ${gen})`;
};

export const formatProcessorImportError = (
  processor?: string | null,
  generation?: string | null,
): string => buildProcessorImportInput(processor, generation) ?? processor?.trim() ?? "";

const normalizeProcessorInput = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\(\s*gen\s+/g, "(gen ")
    .replace(/\s*gen\s*(\d+)/g, " gen $1");

export const resolveCatalogProcessor = (
  input: unknown,
  catalog: CatalogProcessorEntry[],
): string | null => {
  if (input == null || String(input).trim() === "") return null;

  const raw = String(input).trim();
  const normalized = normalizeProcessorInput(raw);

  for (const item of catalog) {
    if (formatProcessorLabel(item).toLowerCase() === raw.toLowerCase()) {
      return formatProcessorLabel(item);
    }
  }

  for (const item of catalog) {
    if (item.name.toLowerCase() === raw.toLowerCase()) {
      return formatProcessorLabel(item);
    }
  }

  const genMatch = normalized.match(/^(.+?)\s+gen\s+(\d+[\w.-]*)$/);
  if (genMatch) {
    const [, namePart, generationPart] = genMatch;
    const match = catalog.find(
      (item) =>
        item.name.toLowerCase() === namePart.trim() &&
        (item.generation?.trim().toLowerCase() ?? "") === generationPart.trim(),
    );
    if (match) return formatProcessorLabel(match);
  }

  const nameMatches = catalog.filter((item) => item.name.toLowerCase() === raw.toLowerCase());
  if (nameMatches.length === 1) return formatProcessorLabel(nameMatches[0]);

  return null;
};
