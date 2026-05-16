import { useEffect, useState } from "react";
import {
  BarChart3, Download, Filter, MapPin, Wrench, UserCheck, AlertTriangle,
  Trash2, DollarSign, HardDrive, ChevronDown, ChevronRight, Search,
} from "lucide-react";
import { api } from "../lib/api";
import { notify } from "../lib/toast";

/* ─── Types ─── */

type ReportAsset = {
  id: number;
  assetCode: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: string;
  deviceType: string;
  processor?: string | null;
  ramGb?: number | null;
  storageGb?: number | null;
  storageType?: string | null;
  purchaseDate?: string | null;
  warrantyEnd?: string | null;
  usefulLifeYears?: number | null;
  endOfLifeDate?: string | null;
  assignedToName?: string | null;
  assignedToDate?: string | null;
  location?: { id: number; name: string; parent?: { name: string } | null } | null;
};

type TicketRow = {
  id: number;
  title: string;
  status: string;
  priority: string;
  level: string;
  createdAt: string;
  asset?: {
    id: number;
    assetCode: string;
    brand: string;
    model: string;
    location?: { id: number; name: string; parent?: { name: string } | null } | null;
  };
  assignedTo?: { id: number; fullName: string; email?: string } | null;
  supportTopic?: { id: number; name: string } | null;
};

type DepreciationAsset = ReportAsset & {
  monthsElapsed: number;
  totalMonths: number;
  depreciationPercent: number;
  remainingPercent: number;
  isFullyDepreciated: boolean;
  custodyDocs?: Array<{ id: number; assignedToName: string; originalName: string; createdAt: string }>;
};

type ScrapAsset = ReportAsset & {
  ticketCount: number;
  updatedAt: string;
  lastCustody?: { id: number; assignedToName: string; originalName: string } | null;
};

type FailureGroup = {
  asset: TicketRow["asset"] & { serialNumber?: string };
  tickets: Array<TicketRow & {
    description?: string;
    updatedAt?: string;
    events?: Array<{ action: string; createdAt: string; details?: Record<string, unknown> }>;
  }>;
};

type ReportFilters = {
  locations: Array<{ id: number; name: string }>;
  brands: string[];
  statuses: string[];
  deviceTypes: string[];
};

/* ─── Label maps ─── */

const statusLabel: Record<string, string> = {
  AVAILABLE: "Disponible", ASSIGNED: "Asignado", MAINTENANCE: "Mantenimiento", SCRAP: "Baja",
};
const deviceTypeLabel: Record<string, string> = {
  LAPTOP: "Laptop", DESKTOP: "PC", SERVER: "Servidor", PRINTER: "Impresora", MONITOR: "Monitor", OTHER: "Otro",
};
const ticketStatusLabel: Record<string, string> = {
  OPEN: "Abierto", IN_PROGRESS: "En progreso", PROVIDER: "Proveedor", CLOSED: "Cerrado", CANCELLED: "Cancelado",
};
const priorityLabel: Record<string, string> = {
  LOW: "Baja", MEDIUM: "Media", HIGH: "Alta", CRITICAL: "Crítica",
};
const priorityColor: Record<string, string> = {
  LOW: "text-slate-500", MEDIUM: "text-blue-500", HIGH: "text-amber-500", CRITICAL: "text-red-500",
};
const statusColor: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  ASSIGNED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  MAINTENANCE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  SCRAP: "bg-slate-200 text-slate-600 dark:bg-slate-700/40 dark:text-slate-400",
};
const ticketStatusColor: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PROVIDER: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  CLOSED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  CANCELLED: "bg-slate-200 text-slate-600 dark:bg-slate-700/40 dark:text-slate-400",
};

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" }) : "—";

const locName = (a: { location?: { name: string; parent?: { name: string } | null } | null }) =>
  a.location ? (a.location.parent ? `${a.location.parent.name} > ${a.location.name}` : a.location.name) : "—";

type ReportTab = "assets-inventory" | "depreciation" | "scrap" | "tickets-zone" | "tickets-tech" | "failure-history";

/* ─── CSV export utility ─── */

const exportCsv = (filename: string, headers: string[], rows: (string | number | null | undefined)[][]) => {
  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const bom = "\uFEFF";
  const csv = bom + [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  notify.success("Exportar", `Se exportó el reporte ${filename}`);
};

/* ─── Shared UI components ─── */

const Badge = ({ text, className }: { text: string; className: string }) => (
  <span className={`inline-block rounded-lg px-2 py-0.5 text-[11px] font-semibold ${className}`}>{text}</span>
);

const SummaryCard = ({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) => (
  <div className={`rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-5 shadow-card`}>
    <p className={`text-xs uppercase tracking-wider ${color}`}>{label}</p>
    <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
    {sub && <p className="text-xs text-slate-400">{sub}</p>}
  </div>
);

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-12 text-sm text-slate-400">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
    Generando reporte...
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-8 text-center text-sm text-slate-400">
    {message}
  </div>
);

/* ────────────────────────────────────────── */
/*  Component principal                       */
/* ────────────────────────────────────────── */

const tabMeta: Record<ReportTab, { title: string; description: string; icon: typeof BarChart3; iconBg: string; iconColor: string }> = {
  "assets-inventory": { title: "Inventario General", description: "Total de activos con filtros por ubicación, estado, tipo y marca.", icon: HardDrive, iconBg: "bg-blue-100 dark:bg-blue-500/15", iconColor: "text-blue-600 dark:text-blue-400" },
  "depreciation": { title: "Depreciación", description: "Trazabilidad contable: vida útil, porcentaje depreciado y documentos de custodia.", icon: DollarSign, iconBg: "bg-emerald-100 dark:bg-emerald-500/15", iconColor: "text-emerald-600 dark:text-emerald-400" },
  "scrap": { title: "Activos en Baja", description: "Equipos dados de baja con historial de tickets y cartas responsivas.", icon: Trash2, iconBg: "bg-slate-200 dark:bg-slate-600/20", iconColor: "text-slate-600 dark:text-slate-400" },
  "tickets-zone": { title: "Tickets por Zona", description: "Tickets abiertos agrupados por ubicación del equipo.", icon: MapPin, iconBg: "bg-amber-100 dark:bg-amber-500/15", iconColor: "text-amber-600 dark:text-amber-400" },
  "tickets-tech": { title: "Tickets por Técnico", description: "Carga de trabajo por técnico asignado.", icon: UserCheck, iconBg: "bg-purple-100 dark:bg-purple-500/15", iconColor: "text-purple-600 dark:text-purple-400" },
  "failure-history": { title: "Historial de Fallas", description: "Equipos con más incidencias para detectar patrones de falla.", icon: AlertTriangle, iconBg: "bg-red-100 dark:bg-red-500/15", iconColor: "text-red-600 dark:text-red-400" },
};

const routeToTab: Record<string, ReportTab> = {
  "/reports": "assets-inventory",
  "/reports/assets-inventory": "assets-inventory",
  "/reports/depreciation": "depreciation",
  "/reports/scrap": "scrap",
  "/reports/tickets-zone": "tickets-zone",
  "/reports/tickets-tech": "tickets-tech",
  "/reports/failure-history": "failure-history",
};

export const ReportsView = ({ currentRoute, onViewAsset }: { currentRoute: string; onViewAsset?: (assetId: number) => void }) => {
  const activeTab = routeToTab[currentRoute] ?? "assets-inventory";
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<ReportFilters | null>(null);

  // Asset inventory state
  const [invData, setInvData] = useState<{
    total: number;
    assets: ReportAsset[];
    byStatus: { status: string; count: number }[];
    byType: { type: string; count: number }[];
    byBrand: { brand: string; count: number }[];
    byLocation: { locationId: number | null; locationName: string; count: number }[];
  } | null>(null);
  const [invFilters, setInvFilters] = useState({ locationId: "", status: "", deviceType: "", brand: "" });

  // Tickets by zone
  const [zoneData, setZoneData] = useState<{ total: number; byZone: Record<string, TicketRow[]> } | null>(null);
  const [zoneDateFrom, setZoneDateFrom] = useState("");
  const [zoneDateTo, setZoneDateTo] = useState("");

  // Tickets by tech
  const [techData, setTechData] = useState<{
    total: number;
    byTech: Array<{ tech: { id: number; fullName: string; email: string } | null; tickets: TicketRow[] }>;
  } | null>(null);

  // Failure history
  const [failureData, setFailureData] = useState<{
    totalTickets: number;
    totalAssets: number;
    byAsset: FailureGroup[];
  } | null>(null);
  const [failureAssetId, setFailureAssetId] = useState("");

  // Depreciation
  const [depData, setDepData] = useState<{
    total: number;
    fullyDepreciated: number;
    activeNotDepreciated: number;
    assets: DepreciationAsset[];
  } | null>(null);

  // Scrap
  const [scrapData, setScrapData] = useState<{ total: number; assets: ScrapAsset[] } | null>(null);

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const ns = new Set(prev);
      if (ns.has(key)) ns.delete(key); else ns.add(key);
      return ns;
    });
  };

  // Load filters once
  useEffect(() => {
    api.get<{ filters: ReportFilters }>("/reports/filters")
      .then((r) => setFilters(r.data.filters))
      .catch(() => undefined);
  }, []);

  // Load report data based on active tab
  const loadReport = async () => {
    setLoading(true);
    try {
      if (activeTab === "assets-inventory") {
        const params = new URLSearchParams();
        if (invFilters.locationId) params.set("locationId", invFilters.locationId);
        if (invFilters.status) params.set("status", invFilters.status);
        if (invFilters.deviceType) params.set("deviceType", invFilters.deviceType);
        if (invFilters.brand) params.set("brand", invFilters.brand);
        const res = await api.get(`/reports/assets-inventory?${params.toString()}`);
        setInvData(res.data as typeof invData);
      } else if (activeTab === "tickets-zone") {
        const params = new URLSearchParams();
        if (zoneDateFrom) params.set("dateFrom", zoneDateFrom);
        if (zoneDateTo) params.set("dateTo", zoneDateTo);
        const res = await api.get(`/reports/tickets-by-zone?${params.toString()}`);
        setZoneData(res.data as typeof zoneData);
      } else if (activeTab === "tickets-tech") {
        const res = await api.get("/reports/tickets-by-tech");
        setTechData(res.data as typeof techData);
      } else if (activeTab === "failure-history") {
        const params = new URLSearchParams();
        if (failureAssetId) params.set("assetId", failureAssetId);
        const res = await api.get(`/reports/failure-history?${params.toString()}`);
        setFailureData(res.data as typeof failureData);
      } else if (activeTab === "depreciation") {
        const res = await api.get("/reports/depreciation");
        setDepData(res.data as typeof depData);
      } else if (activeTab === "scrap") {
        const res = await api.get("/reports/scrap");
        setScrapData(res.data as typeof scrapData);
      }
    } catch {
      notify.error("Reportes", "No se pudo cargar el reporte.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [activeTab]);

  /* ═══ Renders ═══ */

  const renderAssetsInventory = () => {
    if (!invData) return <EmptyState message="No hay datos disponibles." />;

    const exportInventory = () => {
      const headers = ["Código", "Marca", "Modelo", "No. Serie", "Tipo", "Estado", "Ubicación", "Responsable", "Fecha Compra", "Garantía hasta", "Vida Útil", "Fin de Vida"];
      const rows = invData.assets.map((a) => [
        a.assetCode, a.brand, a.model, a.serialNumber,
        deviceTypeLabel[a.deviceType] ?? a.deviceType,
        statusLabel[a.status] ?? a.status,
        locName(a), a.assignedToName ?? "",
        fmtDate(a.purchaseDate), fmtDate(a.warrantyEnd),
        a.usefulLifeYears ?? "", fmtDate(a.endOfLifeDate),
      ]);
      exportCsv("inventario_activos.csv", headers, rows);
    };

    return (
      <>
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Total Activos" value={invData.total} color="text-slate-500 dark:text-slate-400" />
          {invData.byStatus.map((s) => (
            <SummaryCard key={s.status} label={statusLabel[s.status] ?? s.status} value={s.count} color="text-slate-500 dark:text-slate-400" />
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-4 shadow-card">
          <Filter size={16} className="text-slate-400 mb-2" />
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">Ubicación</label>
            <select value={invFilters.locationId} onChange={(e) => setInvFilters((p) => ({ ...p, locationId: e.target.value }))} className="rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors">
              <option value="">Todas</option>
              {filters?.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">Estado</label>
            <select value={invFilters.status} onChange={(e) => setInvFilters((p) => ({ ...p, status: e.target.value }))} className="rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors">
              <option value="">Todos</option>
              {filters?.statuses.map((s) => <option key={s} value={s}>{statusLabel[s] ?? s}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">Tipo</label>
            <select value={invFilters.deviceType} onChange={(e) => setInvFilters((p) => ({ ...p, deviceType: e.target.value }))} className="rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors">
              <option value="">Todos</option>
              {filters?.deviceTypes.map((t) => <option key={t} value={t}>{deviceTypeLabel[t] ?? t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">Marca</label>
            <select value={invFilters.brand} onChange={(e) => setInvFilters((p) => ({ ...p, brand: e.target.value }))} className="rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors">
              <option value="">Todas</option>
              {filters?.brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <button onClick={loadReport} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition">
            <Search size={14} className="inline mr-1 -mt-0.5" /> Filtrar
          </button>
          {invData.assets.length > 0 && (
            <button onClick={exportInventory} className="ml-auto rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition">
              <Download size={14} className="inline mr-1 -mt-0.5" /> Exportar
            </button>
          )}
        </div>

        {/* Breakdown charts (simple bar representation) */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* By Type */}
          <div className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-5 shadow-card">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Por Tipo de Equipo</h4>
            <div className="space-y-2">
              {invData.byType.map((t) => (
                <div key={t.type} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-slate-500 dark:text-slate-400">{deviceTypeLabel[t.type] ?? t.type}</span>
                  <div className="flex-1 h-5 rounded-full bg-slate-100 dark:bg-surface-lighter overflow-hidden">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(4, (t.count / invData.total) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 w-8 text-right">{t.count}</span>
                </div>
              ))}
            </div>
          </div>
          {/* By Location */}
          <div className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-5 shadow-card">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Por Ubicación</h4>
            <div className="space-y-2">
              {invData.byLocation.map((l, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-40 text-xs text-slate-500 dark:text-slate-400 truncate" title={l.locationName}>{l.locationName}</span>
                  <div className="flex-1 h-5 rounded-full bg-slate-100 dark:bg-surface-lighter overflow-hidden">
                    <div className="h-full rounded-full bg-accent/70" style={{ width: `${Math.max(4, (l.count / invData.total) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 w-8 text-right">{l.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border-light dark:border-border-dark text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="p-3">Código</th><th className="p-3">Tipo</th><th className="p-3">Marca/Modelo</th>
                <th className="p-3">Estado</th><th className="p-3">Ubicación</th><th className="p-3">Responsable</th>
                <th className="p-3">Fecha Compra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {invData.assets.map((a) => (
                <tr key={a.id} onClick={() => onViewAsset?.(a.id)} className="hover:bg-slate-50 dark:hover:bg-surface-lighter/40 transition-colors cursor-pointer">
                  <td className="p-3 font-semibold text-primary underline decoration-primary/30">{a.assetCode}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{deviceTypeLabel[a.deviceType] ?? a.deviceType}</td>
                  <td className="p-3 text-slate-700 dark:text-slate-200">{a.brand} {a.model}</td>
                  <td className="p-3"><Badge text={statusLabel[a.status] ?? a.status} className={statusColor[a.status] ?? ""} /></td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{locName(a)}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{a.assignedToName || "—"}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{fmtDate(a.purchaseDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderDepreciation = () => {
    if (!depData) return <EmptyState message="No hay datos de depreciación." />;

    const exportDep = () => {
      const headers = ["Código", "Marca", "Modelo", "No. Serie", "Tipo", "Estado", "Ubicación", "Fecha Compra", "Vida Útil (años)", "Meses Transcurridos", "Depreciación %", "Valor Residual %", "Totalmente Depreciado"];
      const rows = depData.assets.map((a) => [
        a.assetCode, a.brand, a.model, a.serialNumber,
        deviceTypeLabel[a.deviceType] ?? a.deviceType,
        statusLabel[a.status] ?? a.status,
        locName(a), fmtDate(a.purchaseDate),
        a.usefulLifeYears, a.monthsElapsed, a.depreciationPercent, a.remainingPercent,
        a.isFullyDepreciated ? "Sí" : "No",
      ]);
      exportCsv("depreciacion_activos.csv", headers, rows);
    };

    return (
      <>
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Total con Fecha de Compra" value={depData.total} color="text-slate-500 dark:text-slate-400" />
          <SummaryCard label="Totalmente Depreciados" value={depData.fullyDepreciated} sub="requieren reemplazo" color="text-red-500 dark:text-red-400" />
          <SummaryCard label="Activos sin Depreciar" value={depData.activeNotDepreciated} sub="en operación" color="text-emerald-500 dark:text-emerald-400" />
        </div>

        {depData.assets.length > 0 && (
          <div className="flex justify-end">
            <button onClick={exportDep} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition">
              <Download size={14} className="inline mr-1 -mt-0.5" /> Exportar
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border-light dark:border-border-dark text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="p-3">Código</th><th className="p-3">Marca/Modelo</th><th className="p-3">Estado</th>
                <th className="p-3">Ubicación</th><th className="p-3">Compra</th><th className="p-3">Vida Útil</th>
                <th className="p-3">Depreciación</th><th className="p-3">Residual</th>
                <th className="p-3">Docs Custodia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {depData.assets.map((a) => (
                <tr key={a.id} onClick={() => onViewAsset?.(a.id)} className={`hover:bg-slate-50 dark:hover:bg-surface-lighter/40 transition-colors cursor-pointer ${a.isFullyDepreciated ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}>
                  <td className="p-3 font-semibold text-primary underline decoration-primary/30">{a.assetCode}</td>
                  <td className="p-3 text-slate-700 dark:text-slate-200">{a.brand} {a.model}</td>
                  <td className="p-3"><Badge text={statusLabel[a.status] ?? a.status} className={statusColor[a.status] ?? ""} /></td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{locName(a)}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{fmtDate(a.purchaseDate)}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{a.usefulLifeYears} años</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 rounded-full bg-slate-100 dark:bg-surface-lighter overflow-hidden">
                        <div className={`h-full rounded-full ${a.isFullyDepreciated ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${a.depreciationPercent}%` }} />
                      </div>
                      <span className={`text-xs font-semibold ${a.isFullyDepreciated ? "text-red-500" : "text-slate-600 dark:text-slate-300"}`}>
                        {a.depreciationPercent}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{a.remainingPercent}%</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400 text-xs">
                    {a.custodyDocs && a.custodyDocs.length > 0 ? `${a.custodyDocs.length} doc(s)` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderScrap = () => {
    if (!scrapData) return <EmptyState message="No hay activos dados de baja." />;

    const exportScr = () => {
      const headers = ["Código", "Marca", "Modelo", "No. Serie", "Tipo", "Ubicación", "Fecha Compra", "Fin de Vida", "Tickets Asociados", "Fecha Baja", "Última Custodia"];
      const rows = scrapData.assets.map((a) => [
        a.assetCode, a.brand, a.model, a.serialNumber,
        deviceTypeLabel[a.deviceType] ?? a.deviceType,
        locName(a), fmtDate(a.purchaseDate), fmtDate(a.endOfLifeDate),
        a.ticketCount, fmtDate(a.updatedAt),
        a.lastCustody?.assignedToName ?? "—",
      ]);
      exportCsv("activos_baja.csv", headers, rows);
    };

    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          <SummaryCard label="Total Dados de Baja" value={scrapData.total} color="text-slate-500 dark:text-slate-400" />
        </div>

        {scrapData.assets.length > 0 && (
          <div className="flex justify-end">
            <button onClick={exportScr} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition">
              <Download size={14} className="inline mr-1 -mt-0.5" /> Exportar
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border-light dark:border-border-dark text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="p-3">Código</th><th className="p-3">Marca/Modelo</th><th className="p-3">No. Serie</th>
                <th className="p-3">Tipo</th><th className="p-3">Ubicación</th><th className="p-3">Compra</th>
                <th className="p-3">Fin de Vida</th><th className="p-3">Tickets</th><th className="p-3">Fecha Baja</th>
                <th className="p-3">Última Custodia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {scrapData.assets.map((a) => (
                <tr key={a.id} onClick={() => onViewAsset?.(a.id)} className="hover:bg-slate-50 dark:hover:bg-surface-lighter/40 transition-colors cursor-pointer">
                  <td className="p-3 font-semibold text-primary underline decoration-primary/30">{a.assetCode}</td>
                  <td className="p-3 text-slate-700 dark:text-slate-200">{a.brand} {a.model}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{a.serialNumber}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{deviceTypeLabel[a.deviceType] ?? a.deviceType}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{locName(a)}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{fmtDate(a.purchaseDate)}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{fmtDate(a.endOfLifeDate)}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{a.ticketCount}</td>
                  <td className="p-3 text-slate-500 dark:text-slate-400">{fmtDate(a.updatedAt)}</td>
                  <td className="p-3 text-xs text-slate-500 dark:text-slate-400">{a.lastCustody?.assignedToName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderTicketsByZone = () => {
    if (!zoneData) return <EmptyState message="No hay tickets abiertos." />;
    const zones = Object.entries(zoneData.byZone).sort((a, b) => b[1].length - a[1].length);

    const exportZone = () => {
      const headers = ["Zona", "Ticket ID", "Título", "Estado", "Prioridad", "Equipo", "Técnico", "Fecha Creación"];
      const rows: (string | number)[] [] = [];
      for (const [zone, tickets] of zones) {
        for (const t of tickets) {
          rows.push([zone, t.id, t.title, ticketStatusLabel[t.status] ?? t.status, priorityLabel[t.priority] ?? t.priority, t.asset?.assetCode ?? "", t.assignedTo?.fullName ?? "Sin asignar", fmtDate(t.createdAt)]);
        }
      }
      exportCsv("tickets_por_zona.csv", headers, rows);
    };

    return (
      <>
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-4 shadow-card">
          <Filter size={16} className="text-slate-400 mb-2" />
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">Desde</label>
            <input type="date" value={zoneDateFrom} onChange={(e) => setZoneDateFrom(e.target.value)} className="rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">Hasta</label>
            <input type="date" value={zoneDateTo} onChange={(e) => setZoneDateTo(e.target.value)} className="rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors" />
          </div>
          <button onClick={loadReport} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition">
            <Search size={14} className="inline mr-1 -mt-0.5" /> Filtrar
          </button>
          {zoneData.total > 0 && (
            <button onClick={exportZone} className="ml-auto rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition">
              <Download size={14} className="inline mr-1 -mt-0.5" /> Exportar
            </button>
          )}
        </div>

        <SummaryCard label="Total Tickets Abiertos" value={zoneData.total} sub={`en ${zones.length} zona(s)`} color="text-blue-500 dark:text-blue-400" />

        <div className="space-y-3">
          {zones.map(([zone, tickets]) => (
            <div key={zone} className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-card overflow-hidden">
              <button onClick={() => toggleSection(`zone-${zone}`)} className="flex w-full items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-surface-lighter/40 transition-colors">
                <div className="flex items-center gap-2">
                  {expandedSections.has(`zone-${zone}`) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <MapPin size={14} className="text-primary" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{zone}</span>
                </div>
                <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
                </span>
              </button>
              {expandedSections.has(`zone-${zone}`) && (
                <div className="border-t border-border-light dark:border-border-dark overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="p-3">ID</th><th className="p-3">Título</th><th className="p-3">Estado</th>
                        <th className="p-3">Prioridad</th><th className="p-3">Equipo</th><th className="p-3">Técnico</th>
                        <th className="p-3">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                      {tickets.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-surface-lighter/40 transition-colors">
                          <td className="p-3 font-semibold text-primary">#{t.id}</td>
                          <td className="p-3 text-slate-700 dark:text-slate-200 max-w-xs truncate">{t.title}</td>
                          <td className="p-3"><Badge text={ticketStatusLabel[t.status] ?? t.status} className={ticketStatusColor[t.status] ?? ""} /></td>
                          <td className={`p-3 text-xs font-semibold ${priorityColor[t.priority] ?? ""}`}>{priorityLabel[t.priority] ?? t.priority}</td>
                          <td className="p-3">{t.asset ? <button onClick={() => onViewAsset?.(t.asset!.id)} className="text-primary font-semibold underline decoration-primary/30 hover:decoration-primary">{t.asset.assetCode}</button> : "—"}</td>
                          <td className="p-3 text-slate-500 dark:text-slate-400">{t.assignedTo?.fullName ?? "Sin asignar"}</td>
                          <td className="p-3 text-slate-500 dark:text-slate-400">{fmtDate(t.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    );
  };

  const renderTicketsByTech = () => {
    if (!techData) return <EmptyState message="No hay tickets abiertos." />;

    const exportTech = () => {
      const headers = ["Técnico", "Email", "Ticket ID", "Título", "Estado", "Prioridad", "Equipo", "Fecha"];
      const rows: (string | number)[][] = [];
      for (const group of techData.byTech) {
        for (const t of group.tickets) {
          rows.push([
            group.tech?.fullName ?? "Sin asignar", group.tech?.email ?? "",
            t.id, t.title, ticketStatusLabel[t.status] ?? t.status,
            priorityLabel[t.priority] ?? t.priority, t.asset?.assetCode ?? "", fmtDate(t.createdAt),
          ]);
        }
      }
      exportCsv("tickets_por_tecnico.csv", headers, rows);
    };

    return (
      <>
        <div className="flex items-center justify-between">
          <SummaryCard label="Total Tickets Abiertos" value={techData.total} sub={`${techData.byTech.length} técnico(s)`} color="text-blue-500 dark:text-blue-400" />
          {techData.total > 0 && (
            <button onClick={exportTech} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition">
              <Download size={14} className="inline mr-1 -mt-0.5" /> Exportar
            </button>
          )}
        </div>

        <div className="space-y-3">
          {techData.byTech.map((group, idx) => (
            <div key={idx} className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-card overflow-hidden">
              <button onClick={() => toggleSection(`tech-${idx}`)} className="flex w-full items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-surface-lighter/40 transition-colors">
                <div className="flex items-center gap-2">
                  {expandedSections.has(`tech-${idx}`) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <UserCheck size={14} className="text-primary" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{group.tech?.fullName ?? "Sin asignar"}</span>
                  {group.tech?.email && <span className="text-xs text-slate-400">{group.tech.email}</span>}
                </div>
                <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {group.tickets.length} ticket{group.tickets.length !== 1 ? "s" : ""}
                </span>
              </button>
              {expandedSections.has(`tech-${idx}`) && (
                <div className="border-t border-border-light dark:border-border-dark overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="p-3">ID</th><th className="p-3">Título</th><th className="p-3">Estado</th>
                        <th className="p-3">Prioridad</th><th className="p-3">Equipo</th><th className="p-3">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                      {group.tickets.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-surface-lighter/40 transition-colors">
                          <td className="p-3 font-semibold text-primary">#{t.id}</td>
                          <td className="p-3 text-slate-700 dark:text-slate-200 max-w-xs truncate">{t.title}</td>
                          <td className="p-3"><Badge text={ticketStatusLabel[t.status] ?? t.status} className={ticketStatusColor[t.status] ?? ""} /></td>
                          <td className={`p-3 text-xs font-semibold ${priorityColor[t.priority] ?? ""}`}>{priorityLabel[t.priority] ?? t.priority}</td>
                          <td className="p-3">{t.asset ? <button onClick={() => onViewAsset?.(t.asset!.id)} className="text-primary font-semibold underline decoration-primary/30 hover:decoration-primary">{t.asset.assetCode}</button> : "—"}</td>
                          <td className="p-3 text-slate-500 dark:text-slate-400">{fmtDate(t.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    );
  };

  const renderFailureHistory = () => {
    if (!failureData) return <EmptyState message="No hay historial de fallas." />;

    const exportFailures = () => {
      const headers = ["Código Equipo", "Marca", "Modelo", "No. Serie", "Ticket ID", "Título", "Estado", "Prioridad", "Tema", "Técnico", "Fecha Creación"];
      const rows: (string | number)[][] = [];
      for (const group of failureData.byAsset) {
        for (const t of group.tickets) {
          rows.push([
            group.asset?.assetCode ?? "", group.asset?.brand ?? "", group.asset?.model ?? "", group.asset?.serialNumber ?? "",
            t.id, t.title, ticketStatusLabel[t.status] ?? t.status,
            priorityLabel[t.priority] ?? t.priority, t.supportTopic?.name ?? "",
            t.assignedTo?.fullName ?? "Sin asignar", fmtDate(t.createdAt),
          ]);
        }
      }
      exportCsv("historial_fallas.csv", headers, rows);
    };

    return (
      <>
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-4 shadow-card">
          <Filter size={16} className="text-slate-400 mb-2" />
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">Filtrar por equipo (ID)</label>
            <input type="number" value={failureAssetId} onChange={(e) => setFailureAssetId(e.target.value)} placeholder="Dejar vacío para todos" className="w-full rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors" />
          </div>
          <button onClick={loadReport} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark transition">
            <Search size={14} className="inline mr-1 -mt-0.5" /> Buscar
          </button>
          {failureData.totalTickets > 0 && (
            <button onClick={exportFailures} className="ml-auto rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition">
              <Download size={14} className="inline mr-1 -mt-0.5" /> Exportar
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SummaryCard label="Total Tickets" value={failureData.totalTickets} color="text-slate-500 dark:text-slate-400" />
          <SummaryCard label="Equipos Afectados" value={failureData.totalAssets} color="text-amber-500 dark:text-amber-400" />
        </div>

        <div className="space-y-3">
          {failureData.byAsset.map((group, idx) => (
            <div key={idx} className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-card overflow-hidden">
              <button onClick={() => toggleSection(`fail-${idx}`)} className="flex w-full items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-surface-lighter/40 transition-colors">
                <div className="flex items-center gap-2">
                  {expandedSections.has(`fail-${idx}`) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <Wrench size={14} className="text-amber-500" />
                  <span onClick={(e) => { e.stopPropagation(); if (group.asset) onViewAsset?.(group.asset.id); }} className="text-sm font-semibold text-primary underline decoration-primary/30 hover:decoration-primary cursor-pointer">{group.asset?.assetCode}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{group.asset?.brand} {group.asset?.model}</span>
                  {group.asset?.serialNumber && <span className="text-xs text-slate-400">SN: {group.asset.serialNumber}</span>}
                </div>
                <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  group.tickets.length >= 5 ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                  group.tickets.length >= 3 ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                  "bg-primary/10 text-primary"
                }`}>
                  {group.tickets.length} falla{group.tickets.length !== 1 ? "s" : ""}
                </span>
              </button>
              {expandedSections.has(`fail-${idx}`) && (
                <div className="border-t border-border-light dark:border-border-dark overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="p-3">ID</th><th className="p-3">Título</th><th className="p-3">Estado</th>
                        <th className="p-3">Prioridad</th><th className="p-3">Tema</th><th className="p-3">Técnico</th>
                        <th className="p-3">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                      {group.tickets.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-surface-lighter/40 transition-colors">
                          <td className="p-3 font-semibold text-primary">#{t.id}</td>
                          <td className="p-3 text-slate-700 dark:text-slate-200 max-w-xs truncate">{t.title}</td>
                          <td className="p-3"><Badge text={ticketStatusLabel[t.status] ?? t.status} className={ticketStatusColor[t.status] ?? ""} /></td>
                          <td className={`p-3 text-xs font-semibold ${priorityColor[t.priority] ?? ""}`}>{priorityLabel[t.priority] ?? t.priority}</td>
                          <td className="p-3 text-slate-500 dark:text-slate-400">{t.supportTopic?.name ?? "—"}</td>
                          <td className="p-3 text-slate-500 dark:text-slate-400">{t.assignedTo?.fullName ?? "Sin asignar"}</td>
                          <td className="p-3 text-slate-500 dark:text-slate-400">{fmtDate(t.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    );
  };

  const meta = tabMeta[activeTab];
  const HeaderIcon = meta.icon;

  return (
    <section className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.iconBg}`}>
          <HeaderIcon size={20} className={meta.iconColor} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{meta.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{meta.description}</p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-5">
          {activeTab === "assets-inventory" && renderAssetsInventory()}
          {activeTab === "depreciation" && renderDepreciation()}
          {activeTab === "scrap" && renderScrap()}
          {activeTab === "tickets-zone" && renderTicketsByZone()}
          {activeTab === "tickets-tech" && renderTicketsByTech()}
          {activeTab === "failure-history" && renderFailureHistory()}
        </div>
      )}
    </section>
  );
};
