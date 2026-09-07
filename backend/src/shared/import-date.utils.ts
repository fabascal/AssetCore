/** Parsea fechas de importación CSV: YYYY-MM-DD o DD/MM/YYYY (formato México). */
export const parseImportDate = (value: string | undefined | null): string | null => {
  if (value == null) return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : raw;
  }

  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!dmy) return null;

  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const year = Number(dmy[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getDate() !== day || date.getMonth() + 1 !== month || date.getFullYear() !== year) return null;

  return iso;
};

export const collectImportDateErrors = (row: Record<string, unknown>): string[] => {
  const labels: Record<string, string> = {
    purchaseDate: "Fecha Compra",
    warrantyEnd: "Fin Garantia",
    assignedToDate: "Fecha Asignacion",
  };
  const errors: string[] = [];
  const fields = ["purchaseDate", "warrantyEnd", "assignedToDate"] as const;

  for (const field of fields) {
    const value = row[field];
    if (value == null || value === "") continue;
    if (!parseImportDate(String(value))) {
      errors.push(`${labels[field]}: formato inválido "${value}" (use YYYY-MM-DD o DD/MM/YYYY)`);
    }
  }

  return errors;
};

export const normalizeImportRowDates = (row: Record<string, unknown>): Record<string, unknown> => {
  const normalized = { ...row };
  const fields = ["purchaseDate", "warrantyEnd", "assignedToDate"] as const;

  for (const field of fields) {
    const value = normalized[field];
    if (value == null || value === "") continue;
    const iso = parseImportDate(String(value));
    if (iso) normalized[field] = iso;
  }

  return normalized;
};
