import { TicketLevel, TicketStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma";

export const getDashboardSummary = async () => {
  const [
    totalAssets,
    ticketsOpen,
    maintenanceAssets,
    escalatedToProvider,
    assetsByStatus,
    assetsByType,
    ticketsByPriority,
    ticketsByStatus,
    recentTickets,
    assignedAssets,
    scrapAssets,
  ] = await Promise.all([
    prisma.asset.count(),
    prisma.ticket.count({
      where: {
        status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.PROVIDER] },
      },
    }),
    prisma.asset.count({ where: { status: "MAINTENANCE" } }),
    prisma.ticket.count({ where: { level: TicketLevel.PROVEEDOR } }),
    prisma.asset.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.assetType.findMany({ select: { id: true, name: true, _count: { select: { assets: true } } } }),
    prisma.ticket.groupBy({
      by: ["priority"],
      where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.PROVIDER] } },
      _count: { id: true },
    }),
    prisma.ticket.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.ticket.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        level: true,
        createdAt: true,
        asset: { select: { assetCode: true } },
        assignedTo: { select: { fullName: true } },
      },
    }),
    prisma.asset.count({ where: { status: "ASSIGNED" } }),
    prisma.asset.count({ where: { status: "SCRAP" } }),
  ]);

  return {
    totalAssets,
    ticketsOpen,
    maintenanceAssets,
    escalatedToProvider,
    assignedAssets,
    scrapAssets,
    assetsByStatus: assetsByStatus.map((r) => ({ status: r.status, count: r._count.id })),
    assetsByType: assetsByType.map((r) => ({ type: r.name, count: r._count.assets })),
    ticketsByPriority: ticketsByPriority.map((r) => ({ priority: r.priority, count: r._count.id })),
    ticketsByStatus: ticketsByStatus.map((r) => ({ status: r.status, count: r._count.id })),
    recentTickets,
  };
};
