import { Monitor, Ticket, Wrench, Truck, UserCheck, Trash2, Laptop, Server, Printer, MonitorSmartphone, CircleDot, AlertTriangle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { DashboardFinancialWidget, type FinancialSummary } from "./DashboardFinancialWidget";

type RecentTicket = {
  id: number;
  title: string;
  status: string;
  priority: string;
  level: string;
  createdAt: string;
  asset: { assetCode: string } | null;
  assignedTo: { fullName: string } | null;
};

export type Summary = {
  totalAssets: number;
  ticketsOpen: number;
  maintenanceAssets: number;
  escalatedToProvider: number;
  assignedAssets: number;
  scrapAssets: number;
  assetsByStatus: { status: string; count: number }[];
  assetsByType: { type: string; count: number }[];
  ticketsByPriority: { priority: string; count: number }[];
  ticketsByStatus: { status: string; count: number }[];
  recentTickets: RecentTicket[];
};

type Props = {
  summary: Summary | null;
  loading?: boolean;
  lastUpdatedAt?: Date | null;
  showTickets?: boolean;
  onViewAsset?: (assetId: number) => void;
  onNavigate?: (route: string) => void;
};

const formatRelativeMinutes = (date: Date | null | undefined) => {
  if (!date) return "sin datos";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins <= 0) return "hace instantes";
  if (mins === 1) return "hace 1 minuto";
  return `hace ${mins} minutos`;
};

const kpiCards = [
  { key: "totalAssets" as const, label: "Total Activos", icon: Monitor, gradient: "from-blue-500 to-blue-600", bgLight: "bg-blue-50", bgDark: "dark:bg-blue-950/20", iconColor: "text-blue-500", ticketOnly: false },
  { key: "assignedAssets" as const, label: "Asignados", icon: UserCheck, gradient: "from-emerald-500 to-teal-600", bgLight: "bg-emerald-50", bgDark: "dark:bg-emerald-950/20", iconColor: "text-emerald-500", ticketOnly: false },
  { key: "maintenanceAssets" as const, label: "En Mantenimiento", icon: Wrench, gradient: "from-orange-500 to-red-500", bgLight: "bg-orange-50", bgDark: "dark:bg-orange-950/20", iconColor: "text-orange-500", ticketOnly: false },
  { key: "scrapAssets" as const, label: "Dados de Baja", icon: Trash2, gradient: "from-slate-400 to-slate-600", bgLight: "bg-slate-100", bgDark: "dark:bg-slate-800/30", iconColor: "text-slate-500", ticketOnly: false },
  { key: "ticketsOpen" as const, label: "Tickets Abiertos", icon: Ticket, gradient: "from-amber-500 to-orange-500", bgLight: "bg-amber-50", bgDark: "dark:bg-amber-950/20", iconColor: "text-amber-500", ticketOnly: true },
  { key: "escalatedToProvider" as const, label: "Escalados a Proveedor", icon: Truck, gradient: "from-rose-500 to-pink-600", bgLight: "bg-rose-50", bgDark: "dark:bg-rose-950/20", iconColor: "text-rose-500", ticketOnly: true },
];

const deviceTypeLabels: Record<string, { label: string; icon: typeof Monitor }> = {
  LAPTOP: { label: "Laptops", icon: Laptop },
  DESKTOP: { label: "Escritorios", icon: Monitor },
  SERVER: { label: "Servidores", icon: Server },
  PRINTER: { label: "Impresoras", icon: Printer },
  MONITOR: { label: "Monitores", icon: MonitorSmartphone },
  OTHER: { label: "Otros", icon: CircleDot },
};

const statusLabel: Record<string, string> = { AVAILABLE: "Disponible", ASSIGNED: "Asignado", MAINTENANCE: "Mantenimiento", SCRAP: "Baja" };
const statusColor: Record<string, string> = {
  AVAILABLE: "bg-emerald-500",
  ASSIGNED: "bg-blue-500",
  MAINTENANCE: "bg-orange-500",
  SCRAP: "bg-slate-400",
};

const ticketStatusLabel: Record<string, string> = { OPEN: "Abierto", IN_PROGRESS: "En proceso", PROVIDER: "Proveedor", CLOSED: "Cerrado", CANCELLED: "Cancelado" };
const ticketStatusStyle: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  PROVIDER: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400",
  CLOSED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  CANCELLED: "bg-slate-100 text-slate-500 dark:bg-slate-500/10 dark:text-on-surface-variant",
};
const ticketStatusIcon: Record<string, typeof Clock> = { OPEN: AlertTriangle, IN_PROGRESS: Clock, PROVIDER: Truck, CLOSED: CheckCircle2, CANCELLED: XCircle };

const priorityLabel: Record<string, string> = { LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", CRITICAL: "Crítica" };
const priorityColor: Record<string, string> = { LOW: "bg-slate-400", MEDIUM: "bg-blue-500", HIGH: "bg-amber-500", CRITICAL: "bg-rose-500" };

export const DashboardCards = ({
  summary,
  loading = false,
  lastUpdatedAt = null,
  showTickets = true,
  onViewAsset,
  onNavigate,
}: Props) => {
  const [financial, setFinancial] = useState<FinancialSummary | null>(null);
  const [loadingFinancial, setLoadingFinancial] = useState(true);
  const [showFinancial, setShowFinancial] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingFinancial(true);
    api
      .get<{ summary: FinancialSummary }>("/dashboard/financial-summary")
      .then((res) => {
        if (!cancelled) {
          setFinancial(res.data.summary);
          setShowFinancial(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 403) setShowFinancial(false);
          else setFinancial(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFinancial(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lastUpdatedAt]);

  const defaults: Summary = {
    totalAssets: 0, ticketsOpen: 0, maintenanceAssets: 0, escalatedToProvider: 0,
    assignedAssets: 0, scrapAssets: 0,
    assetsByStatus: [], assetsByType: [], ticketsByPriority: [], ticketsByStatus: [], recentTickets: [],
  };
  const s = summary ?? defaults;

  const SkeletonBlock = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse rounded-lg bg-surface-container-high ${className}`} />
  );

  return (
    <section className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Dashboard</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Resumen general del sistema de gestión de activos y mesa de ayuda</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-[11px] text-on-surface-variant shadow-card">
          <span className={`h-1.5 w-1.5 rounded-full ${loading ? "animate-pulse bg-amber-400" : "bg-emerald-400"}`} />
          {loading ? "Actualizando..." : formatRelativeMinutes(lastUpdatedAt)}
        </span>
      </div>

      {/* KPI Cards */}
      <div className={`grid gap-4 sm:grid-cols-2 ${showTickets ? "lg:grid-cols-3 xl:grid-cols-6" : "lg:grid-cols-4"}`}>
        {kpiCards.filter((c) => showTickets || !c.ticketOnly).map((card) => {
          const Icon = card.icon;
          const value = s[card.key];
          return (
            <article key={card.key} className="group relative overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card hover-lift transition-all">
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.gradient}`} />
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">{card.label}</p>
                  {loading ? <SkeletonBlock className="h-8 w-14" /> : <p className="text-2xl font-bold tabular-nums text-on-surface">{value}</p>}
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.bgLight} ${card.bgDark} transition-transform group-hover:scale-110`}>
                  <Icon size={18} className={card.iconColor} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {showFinancial ? (
        <DashboardFinancialWidget
          data={financial}
          loading={loadingFinancial}
          onViewAsset={onViewAsset}
          onOpenReport={onNavigate ? () => onNavigate("/reports/depreciation") : undefined}
        />
      ) : null}

      {/* Main grid: Assets details + Tickets */}
      <div className={`grid gap-5 ${showTickets ? "lg:grid-cols-2" : ""}`}>
        {/* LEFT: Assets breakdown */}
        <div className="space-y-5">
          {/* Assets by status — horizontal bar */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
            <h3 className="text-sm font-semibold text-on-surface mb-4">Activos por estado</h3>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-6 w-full" />)}</div>
            ) : (
              <div className="space-y-3">
                {(["AVAILABLE", "ASSIGNED", "MAINTENANCE", "SCRAP"] as const).map((st) => {
                  const count = s.assetsByStatus.find((r) => r.status === st)?.count ?? 0;
                  const pct = s.totalAssets > 0 ? (count / s.totalAssets) * 100 : 0;
                  return (
                    <div key={st}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-on-surface-variant">{statusLabel[st]}</span>
                        <span className="text-xs font-bold tabular-nums text-on-surface">{count}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
                        <div className={`h-full rounded-full ${statusColor[st]} transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assets by device type */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
            <h3 className="text-sm font-semibold text-on-surface mb-4">Activos por tipo de equipo</h3>
            {loading ? (
              <div className="grid grid-cols-3 gap-3">{[1, 2, 3, 4, 5, 6].map((i) => <SkeletonBlock key={i} className="h-16 w-full" />)}</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {s.assetsByType
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .map((item) => {
                    const dt = deviceTypeLabels[item.type] ?? { label: item.type, icon: CircleDot };
                    const DtIcon = dt.icon;
                    return (
                      <div key={item.type} className="flex items-center gap-3 rounded-xl border border-outline-variant p-3 bg-surface-container-low">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/20">
                          <DtIcon size={16} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="text-lg font-bold tabular-nums text-on-surface leading-tight">{item.count}</p>
                          <p className="text-[11px] text-on-surface-variant">{dt.label}</p>
                        </div>
                      </div>
                    );
                  })}
                {s.assetsByType.length === 0 && <p className="col-span-full text-center text-xs text-on-surface-variant">Sin datos</p>}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Tickets section */}
        {showTickets && <div className="space-y-5">
          {/* Tickets by priority */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
            <h3 className="text-sm font-semibold text-on-surface mb-4">Tickets abiertos por prioridad</h3>
            {loading ? (
              <div className="flex gap-3">{[1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-16 flex-1" />)}</div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((pr) => {
                  const count = s.ticketsByPriority.find((r) => r.priority === pr)?.count ?? 0;
                  return (
                    <div key={pr} className="text-center rounded-xl border border-outline-variant p-3 bg-surface-container-low">
                      <div className={`mx-auto mb-1.5 h-2 w-2 rounded-full ${priorityColor[pr]}`} />
                      <p className="text-xl font-bold tabular-nums text-on-surface">{count}</p>
                      <p className="text-[11px] text-on-surface-variant">{priorityLabel[pr]}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tickets by status */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
            <h3 className="text-sm font-semibold text-on-surface mb-4">Tickets por estado</h3>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-8 w-full" />)}</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(["OPEN", "IN_PROGRESS", "PROVIDER", "CLOSED", "CANCELLED"] as const).map((st) => {
                  const count = s.ticketsByStatus.find((r) => r.status === st)?.count ?? 0;
                  const StIcon = ticketStatusIcon[st] ?? Clock;
                  return (
                    <div key={st} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${ticketStatusStyle[st]}`}>
                      <StIcon size={13} />
                      {ticketStatusLabel[st]}: {count}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent tickets */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
              <h3 className="text-sm font-semibold text-on-surface">Tickets recientes</h3>
              <span className="text-[11px] text-on-surface-variant">Últimos 10</span>
            </div>
            {loading ? (
              <div className="p-5 space-y-3">{[1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} className="h-10 w-full" />)}</div>
            ) : s.recentTickets.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-on-surface-variant">No hay tickets registrados.</p>
            ) : (
              <ul className="divide-y divide-outline-variant">
                {s.recentTickets.map((ticket) => {
                  const StIcon = ticketStatusIcon[ticket.status] ?? Clock;
                  return (
                    <li key={ticket.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-container-high transition-colors">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ticketStatusStyle[ticket.status]}`}>
                        <StIcon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-on-surface">{ticket.title}</p>
                        <p className="text-[11px] text-on-surface-variant">
                          {ticket.asset?.assetCode ?? "Sin activo"} · {ticket.assignedTo?.fullName ?? "Sin asignar"} · {new Date(ticket.createdAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${priorityColor[ticket.priority] ?? "bg-slate-300"}`} title={priorityLabel[ticket.priority] ?? ticket.priority} />
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${ticketStatusStyle[ticket.status]}`}>
                          {ticketStatusLabel[ticket.status] ?? ticket.status}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>}
      </div>
    </section>
  );
};
