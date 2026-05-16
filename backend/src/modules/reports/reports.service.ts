import { prisma } from "../../shared/prisma";

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
  if (filters.deviceType) where.deviceType = filters.deviceType;
  if (filters.brand) where.brand = filters.brand;

  const [assets, totals, byStatus, byType, byBrand, byLocation] = await Promise.all([
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
    prisma.asset.groupBy({ by: ["assetTypeId"], where, _count: { _all: true } }),
    prisma.asset.groupBy({ by: ["brand"], where, _count: { _all: true }, orderBy: { brand: "asc" }, take: 20 }),
    prisma.asset.groupBy({ by: ["locationId"], where, _count: { _all: true } }),
  ]);

  // Resolver nombres de ubicaciones
  const locationIds = byLocation.map((r) => r.locationId).filter((id): id is number => id !== null);
  const locations = locationIds.length > 0
    ? await prisma.location.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, name: true, parent: { select: { name: true } } },
      })
    : [];
  const locationMap = new Map(locations.map((l) => [l.id, l.parent ? `${l.parent.name} > ${l.name}` : l.name]));

  return {
    total: totals,
    assets,
    byStatus: byStatus.map((r) => ({ status: r.status, count: typeof r._count === "object" ? (r._count._all ?? 0) : 0 })),
    byType: byType.map((r) => ({ assetTypeId: r.assetTypeId, count: typeof r._count === "object" ? (r._count._all ?? 0) : 0 })),
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

  // Agrupar por ubicación
  const byZone: Record<string, typeof tickets> = {};
  for (const t of tickets) {
    const locName = t.asset?.location
      ? (t.asset.location.parent ? `${t.asset.location.parent.name} > ${t.asset.location.name}` : t.asset.location.name)
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

/* ─── Reporte 5: Depreciación / Trazabilidad Contable ─── */

export const getDepreciationReport = async () => {
  const assets = await prisma.asset.findMany({
    where: { purchaseDate: { not: null } },
    select: {
      id: true,
      assetCode: true,
      brand: true,
      model: true,
      serialNumber: true,
      status: true,
      assetType: { select: { id: true, name: true } },
      purchaseDate: true,
      usefulLifeYears: true,
      endOfLifeDate: true,
      assignedToName: true,
      location: { select: { id: true, name: true, parent: { select: { name: true } } } },
      custodyDocs: {
        select: { id: true, assignedToName: true, assignedToDate: true, originalName: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { purchaseDate: "asc" },
  });

  const now = new Date();

  const enriched = assets.map((a) => {
    const purchaseDate = a.purchaseDate!;
    const usefulLife = a.usefulLifeYears ?? 5;
    const totalMonths = usefulLife * 12;
    const monthsElapsed = Math.max(0,
      (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth())
    );
    const depreciationPercent = Math.min(100, Math.round((monthsElapsed / totalMonths) * 100));
    const remainingPercent = Math.max(0, 100 - depreciationPercent);
    const isFullyDepreciated = depreciationPercent >= 100;

    return {
      ...a,
      usefulLifeYears: usefulLife,
      monthsElapsed,
      totalMonths,
      depreciationPercent,
      remainingPercent,
      isFullyDepreciated,
    };
  });

  const totalAssets = enriched.length;
  const fullyDepreciated = enriched.filter((a) => a.isFullyDepreciated).length;
  const activeNotDepreciated = enriched.filter((a) => !a.isFullyDepreciated && a.status !== "SCRAP").length;

  return {
    total: totalAssets,
    fullyDepreciated,
    activeNotDepreciated,
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

  return {
    total: assets.length,
    assets: assets.map((a) => ({
      ...a,
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
      select: { id: true, name: true, parent: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.asset.groupBy({ by: ["brand"], orderBy: { brand: "asc" } }),
    prisma.asset.groupBy({ by: ["status"] }),
    prisma.assetType.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return {
    locations: locations.map((l) => ({
      id: l.id,
      name: l.parent ? `${l.parent.name} > ${l.name}` : l.name,
    })),
    brands: brands.map((b) => b.brand),
    statuses: statuses.map((s) => s.status),
    assetTypes: types.map((t) => ({ id: t.id, name: t.name })),
  };
};
