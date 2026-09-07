type LocationRow = {
  id: number;
  name: string;
  parentId: number | null;
};

export const buildLocationPath = (locationId: number, byId: Map<number, LocationRow>): string => {
  const parts: string[] = [];
  const seen = new Set<number>();
  let cursor = byId.get(locationId);

  while (cursor) {
    if (seen.has(cursor.id)) break;
    seen.add(cursor.id);
    parts.unshift(cursor.name);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  return parts.join(" > ");
};

export const buildLocationPathMap = (rows: LocationRow[]): Map<number, string> => {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const paths = new Map<number, string>();

  for (const row of rows) {
    paths.set(row.id, buildLocationPath(row.id, byId));
  }

  return paths;
};

export const collectDescendantIds = (locationId: number, rows: LocationRow[]): Set<number> => {
  const byParent = new Map<number | null, number[]>();
  for (const row of rows) {
    const siblings = byParent.get(row.parentId) ?? [];
    siblings.push(row.id);
    byParent.set(row.parentId, siblings);
  }

  const result = new Set<number>();
  const stack = [locationId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || result.has(current)) continue;
    result.add(current);
    for (const childId of byParent.get(current) ?? []) {
      stack.push(childId);
    }
  }

  return result;
};

export const assertValidLocationParent = (
  locationId: number,
  parentId: number | null | undefined,
  rows: LocationRow[],
) => {
  if (!parentId) return;
  if (parentId === locationId) {
    throw new Error("Una ubicacion no puede ser padre de si misma");
  }

  const descendants = collectDescendantIds(locationId, rows);
  if (descendants.has(parentId)) {
    throw new Error("No se puede mover una ubicacion dentro de sus sub-ubicaciones");
  }

  if (!rows.some((row) => row.id === parentId)) {
    throw new Error("Ubicacion padre no encontrada");
  }
};

const normalizePathInput = (pathInput: string) =>
  pathInput
    .trim()
    .split(/\s*(?:>|\/|→)\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" > ");

export const resolveLocationIdByPath = (pathInput: string, rows: LocationRow[]): number | null => {
  const trimmed = pathInput.trim();
  if (!trimmed) return null;

  const pathMap = buildLocationPathMap(rows);
  const targets = new Set([trimmed.toLowerCase(), normalizePathInput(trimmed).toLowerCase()]);

  for (const [id, path] of pathMap) {
    if (targets.has(path.toLowerCase())) return id;
  }

  return null;
};
