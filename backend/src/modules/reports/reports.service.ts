import { prisma } from "../../shared/prisma";
import { buildLocationPathMap } from "../../shared/location.utils";
import { buildAssetDepreciation } from "../depreciation/depreciation.service";
import { roundMoney } from "../../shared/depreciation.utils";

/* ─── Reporte 1: Inventario General de Activos ─── */

export const getAssetsInventoryReport = async (filters: {
  locationId?: number;
  status?: string;
  deviceType?: string;
  brand?: string;
}) => {
  const where: Record<string, unknown> = {};
  if (filters.locationId) where.locationId = filters.locationId;
  if (filters.status) where.status = filters.status;
  if (filters.deviceType) where.assetType = { name: filters.deviceType };
  if (filters.brand) where.brand = filters.brand;

  const [assets, totals, byStatus, byTypeRaw, byBrand, byLocation] = await Promise.all([
    prisma.asset.findMany({
      where,
      select: {
        id: true,
        assetCode: true,
        brand: true,
        model: true,
        serialNumber: true,
        status: true,
        assetType: { select: { id: true, name: true } },
        processor: true,
        ramGb: true,
        storageGb: true,
        storageType: true,
        purchaseDate: true,
        warrantyEnd: true,
        usefulLifeYears: true,
        endOfLifeDate: true,
        assignedToName: true,
        assignedToDate: true,
        location: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } },
      },
      orderBy: { assetCode: "asc" },
    }),
    prisma.asset.count({ where }),
    prisma.asset.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.asset.groupBy({ by: ["assetTypeId"], where, _count: { _all: true } }).then(async (rows) => {
      const ids = rows.map((r) => r.assetTypeId).filter((id): id is number => id !== null);
      const types = ids.length > 0 ? await prisma.assetType.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
      const typeMap = new Map(types.map((t) => [t.id, t.name]));
      return rows.map((r) => ({ type: r.assetTypeId ? (typeMap.get(r.assetTypeId) ?? "Sin tipo") : "Sin tipo", count: typeof r._count === "object" ? (r._count._all ?? 0) : 0 }));
    }),
    prisma.asset.groupBy({ by: ["brand"], where, _count: { _all: true }, orderBy: { brand: "asc" }, take: 20 }),
    prisma.asset.groupBy({ by: ["locationId"], where, _count: { _all: true } }),
  ]);

  // Resolver nombres de ubicaciones
  const locationIds = byLocation.map((r) => r.locationId).filter((id): id is number => id !== null);
  const allLocations = await prisma.location.findMany({ select: { id: true, name: true, parentId: true } });
  const locationPaths = buildLocationPathMap(allLocations);
  const locationMap = new Map(
    locationIds.map((id) => [id, locationPaths.get(id) ?? "Desconocida"]),
  );

  return {
    total: totals,
    assets: assets.map((a) => ({
      ...a,
      deviceType: (a.assetType as { name?: string } | null)?.name ?? "",
      locationPath: a.location?.id ? locationPaths.get(a.location.id) ?? null : null,
    })),
    byStatus: byStatus.map((r) => ({ status: r.status, count: typeof r._count === "object" ? (r._count._all ?? 0) : 0 })),
    byType: byTypeRaw,
    byBrand: byBrand.map((r) => ({ brand: r.brand, count: typeof r._count === "object" ? (r._count._all ?? 0) : 0 })),
    byLocation: byLocation.map((r) => ({
      locationId: r.locationId,
      locationName: r.locationId ? locationMap.get(r.locationId) ?? "Desconocida" : "Sin ubicación",
      count: typeof r._count === "object" ? (r._count._all ?? 0) : 0,
    })),
  };
};

/* ─── Reporte 2: Tickets Abiertos por Zona y Fecha ─── */

export const getTicketsByZoneReport = async (filters: {
  dateFrom?: string;
  dateTo?: string;
}) => {
  const where: Record<string, unknown> = {
    status: { in: ["OPEN", "IN_PROGRESS", "PROVIDER"] },
  };

  if (filters.dateFrom || filters.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (filters.dateFrom) createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    where.createdAt = createdAt;
  }

  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      level: true,
      createdAt: true,
      asset: {
        select: {
          id: true,
          assetCode: true,
          brand: true,
          model: true,
          location: { select: { id: true, name: true, parent: { select: { name: true } } } },
        },
      },
      assignedTo: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const locationPaths = buildLocationPathMap(
    await prisma.location.findMany({ select: { id: true, name: true, parentId: true } }),
  );

  // Agrupar por ubicación
  const byZone: Record<string, typeof tickets> = {};
  for (const t of tickets) {
    const locName = t.asset?.location?.id
      ? locationPaths.get(t.asset.location.id) ?? t.asset.location.name
      : "Sin ubicación";
    (byZone[locName] ??= []).push(t);
  }

  return { total: tickets.length, tickets, byZone };
};

/* ─── Reporte 3: Tickets por Técnico Asignado ─── */

export const getTicketsByTechReport = async () => {
  const tickets = await prisma.ticket.findMany({
    where: { status: { in: ["OPEN", "IN_PROGRESS", "PROVIDER"] } },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      level: true,
      createdAt: true,
      asset: { select: { assetCode: true, brand: true, model: true } },
      assignedTo: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const byTech: Record<string, { tech: { id: number; fullName: string; email: string } | null; tickets: typeof tickets }> = {};
  for (const t of tickets) {
    const key = t.assignedTo ? String(t.assignedTo.id) : "unassigned";
    if (!byTech[key]) {
      byTech[key] = { tech: t.assignedTo, tickets: [] };
    }
    byTech[key].tickets.push(t);
  }

  return {
    total: tickets.length,
    byTech: Object.values(byTech).sort((a, b) => b.tickets.length - a.tickets.length),
  };
};

/* ─── Reporte 4: Historial de Fallas por Equipo ─── */

export const getAssetFailureHistory = async (assetId?: number) => {
  const where: Record<string, unknown> = {};
  if (assetId) where.assetId = assetId;

  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      level: true,
      createdAt: true,
      updatedAt: true,
      asset: {
        select: {
          id: true,
          assetCode: true,
          brand: true,
          model: true,
          serialNumber: true,
          location: { select: { id: true, name: true, parent: { select: { name: true } } } },
        },
      },
      assignedTo: { select: { id: true, fullName: true } },
      supportTopic: { select: { id: true, name: true } },
      events: {
        select: { action: true, createdAt: true, details: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Agrupar por equipo
  const byAsset: Record<string, { asset: (typeof tickets)[0]["asset"]; tickets: typeof tickets }> = {};
  for (const t of tickets) {
    const key = String(t.asset.id);
    if (!byAsset[key]) {
      byAsset[key] = { asset: t.asset, tickets: [] };
    }
    byAsset[key].tickets.push(t);
  }

  // Ordenar por cantidad de tickets desc
  const sorted = Object.values(byAsset).sort((a, b) => b.tickets.length - a.tickets.length);

  return { totalTickets: tickets.length, totalAssets: sorted.length, byAsset: sorted };
};

/* ─── Reporte 5: Depreciación LISR / Trazabilidad Contable ─── */

export const getDepreciationReport = async () => {
  const assets = await prisma.asset.findMany({
    where: {
      status: { not: "SCRAP" },
      purchaseDate: { not: null },
    },
    select: {
      id: true,
      assetCode: true,
      brand: true,
      model: true,
      serialNumber: true,
      status: true,
      purchaseDate: true,
      purchasePrice: true,
      equipmentValue: true,
      salvageValue: true,
      usefulLifeYears: true,
      endOfLifeDate: true,
      assignedToName: true,
      assetType: { select: { id: true, name: true, depreciationRate: true, usefulLifeYears: true } },
      location: { select: { id: true, name: true, parentId: true, parent: { select: { name: true } } } },
      custodyDocs: {
        select: { id: true, assignedToName: true, assignedToDate: true, originalName: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { purchaseDate: "asc" },
  });

  const enriched = assets.map((a) => {
    const { depreciation, warnings } = buildAssetDepreciation({
      ...a,
      assetTypeId: a.assetType?.id ?? null,
    });

    return {
      ...a,
      deviceType: a.assetType?.name ?? "",
      depreciation,
      warnings,
      depreciationPercent: depreciation?.depreciationPercent ?? 0,
      remainingPercent: depreciation
        ? roundMoney(Math.max(0, 100 - depreciation.depreciationPercent))
        : 100,
      isFullyDepreciated: depreciation?.isFullyDepreciated ?? false,
      monthsElapsed: depreciation?.monthsElapsed ?? 0,
      monthlyDepreciation: depreciation?.monthlyDepreciation ?? null,
      accumulatedDepreciation: depreciation?.accumulatedDepreciation ?? null,
      bookValue: depreciation?.bookValue ?? null,
      depreciableBase: depreciation?.depreciableBase ?? null,
      depreciationRatePercent: depreciation?.depreciationRatePercent ?? null,
      monthsUntilFullyDepreciated: depreciation?.monthsUntilFullyDepreciated ?? null,
      purchasePriceResolved: depreciation?.purchasePrice ?? null,
    };
  });

  const withDepreciation = enriched.filter((a) => a.depreciation);
  const fullyDepreciated = withDepreciation.filter((a) => a.isFullyDepreciated).length;
  const activeNotDepreciated = withDepreciation.filter((a) => !a.isFullyDepreciated).length;

  const totalOriginalValue = roundMoney(
    withDepreciation.reduce((sum, a) => sum + (a.depreciation?.purchasePrice ?? 0), 0),
  );
  const totalBookValue = roundMoney(
    withDepreciation.reduce((sum, a) => sum + (a.depreciation?.bookValue ?? 0), 0),
  );
  const totalAccumulatedDepreciation = roundMoney(
    withDepreciation.reduce((sum, a) => sum + (a.depreciation?.accumulatedDepreciation ?? 0), 0),
  );

  return {
    total: enriched.length,
    withDepreciationData: withDepreciation.length,
    fullyDepreciated,
    activeNotDepreciated,
    totalOriginalValue,
    totalBookValue,
    totalAccumulatedDepreciation,
    assets: enriched,
  };
};

/* ─── Reporte 6: Activos dados de Baja ─── */

export const getScrapReport = async () => {
  const assets = await prisma.asset.findMany({
    where: { status: "SCRAP" },
    select: {
      id: true,
      assetCode: true,
      brand: true,
      model: true,
      serialNumber: true,
      assetType: { select: { id: true, name: true } },
      purchaseDate: true,
      endOfLifeDate: true,
      usefulLifeYears: true,
      assignedToName: true,
      decommissionReason: true,
      decommissionNotes: true,
      decommissionedAt: true,
      decommissionedBy: { select: { id: true, fullName: true, email: true } },
      updatedAt: true,
      location: { select: { id: true, name: true, parent: { select: { name: true } } } },
      custodyDocs: {
        select: { id: true, assignedToName: true, originalName: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      tickets: {
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const locationPaths = buildLocationPathMap(
    await prisma.location.findMany({ select: { id: true, name: true, parentId: true } }),
  );

  return {
    total: assets.length,
    assets: assets.map((a) => ({
      ...a,
      locationPath: a.location?.id ? locationPaths.get(a.location.id) ?? a.location.name : null,
      ticketCount: a.tickets.length,
      lastCustody: a.custodyDocs[0] ?? null,
    })),
  };
};

/* ─── Filtros disponibles para UI ─── */

export const getReportFilters = async () => {
  const [locations, brands, statuses, types] = await Promise.all([
    prisma.location.findMany({
      where: { isActive: true },
      select: { id: true, name: true, parentId: true },
      orderBy: { name: "asc" },
    }),
    prisma.asset.groupBy({ by: ["brand"], orderBy: { brand: "asc" } }),
    prisma.asset.groupBy({ by: ["status"] }),
    prisma.assetType.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const locationPaths = buildLocationPathMap(locations);

  return {
    locations: locations
      .map((l) => ({
        id: l.id,
        name: locationPaths.get(l.id) ?? l.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
    brands: brands.map((b) => b.brand),
    statuses: statuses.map((s) => s.status),
    assetTypes: types.map((t) => ({ id: t.id, name: t.name })),
    deviceTypes: types.map((t) => t.name),
  };
};
