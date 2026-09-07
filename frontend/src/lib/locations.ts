export type LocationNode = {
  id: number;
  name: string;
  parentId: number | null;
  isActive?: boolean;
};

export const buildLocationPath = (locationId: number, byId: Map<number, LocationNode>): string => {
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

export const buildLocationOptions = (locations: LocationNode[]) => {
  const byId = new Map(locations.map((location) => [location.id, location]));

  return locations
    .map((location) => ({
      id: location.id,
      label: buildLocationPath(location.id, byId),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
};

export const collectDescendantIds = (locationId: number, locations: LocationNode[]): Set<number> => {
  const byParent = new Map<number | null, number[]>();
  for (const location of locations) {
    const siblings = byParent.get(location.parentId) ?? [];
    siblings.push(location.id);
    byParent.set(location.parentId, siblings);
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

export const formatAssetLocation = (
  location?: { id: number; name: string; parentId?: number | null; parent?: { name: string } | null } | null,
  locationPath?: string | null,
) => {
  if (locationPath) return locationPath;
  if (!location) return "—";
  if (location.parent) return `${location.parent.name} → ${location.name}`;
  return location.name;
};

const normalizePathInput = (pathInput: string) =>
  pathInput
    .trim()
    .split(/\s*(?:>|\/|→)\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" > ");

export const resolveLocationIdByPath = (pathInput: string, locations: LocationNode[]): number | null => {
  const trimmed = pathInput.trim();
  if (!trimmed) return null;

  const byId = new Map(locations.map((location) => [location.id, location]));
  const targets = new Set([trimmed.toLowerCase(), normalizePathInput(trimmed).toLowerCase()]);

  for (const location of locations) {
    const path = buildLocationPath(location.id, byId);
    if (targets.has(path.toLowerCase())) return location.id;
  }

  return null;
};
