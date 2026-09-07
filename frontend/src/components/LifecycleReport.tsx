import { useEffect, useState } from "react";
import { CalendarDays, AlertTriangle, TrendingDown, Download } from "lucide-react";
import { api } from "../lib/api";
import { formatAssetLocation } from "../lib/locations";
import { notify } from "../lib/toast";

type ReportAsset = {
  id: number;
  assetCode: string;
  brand: string;
  model: string;
  serialNumber: string | null;
  deviceType: string;
  status: string;
  processor: string | null;
  ramGb: number | null;
  storageGb: number | null;
  storageType: string | null;
  purchaseDate: string | null;
  warrantyEnd: string | null;
  usefulLifeYears: number | null;
  endOfLifeDate: string | null;
  assignedToName: string | null;
  location: { id: number; name: string; parent?: { name: string } | null } | null;
  locationPath?: string | null;
};

type ReportData = {
  year: number;
  assets: ReportAsset[];
  byMonth: Record<string, ReportAsset[]>;
};

const deviceTypeLabel: Record<string, string> = {
  LAPTOP: "Laptop", DESKTOP: "PC", SERVER: "Servidor", PRINTER: "Impresora", MONITOR: "Monitor", OTHER: "Otro",
};

const monthName = (key: string) => {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "long" });
};

export const LifecycleReport = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (y: number) => {
    setLoading(true);
    try {
      const res = await api.get<ReportData>(`/assets/lifecycle-report?year=${y}`);
      setData(res.data);
    } catch {
      notify.error("Reporte", "No se pudo cargar el reporte de ciclo de vida.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(year); }, [year]);

  const exportExcel = () => {
    if (!data || data.assets.length === 0) return;
    const statusLabel: Record<string, string> = {
      ACTIVE: "Activo", STORED: "Almacenado", MAINTENANCE: "Mantenimiento", SCRAP: "Baja",
    };
    const header = ["Código","Marca","Modelo","No. Serie","Tipo","Estado","Procesador","RAM (GB)","Almacenamiento (GB)","Tipo Almacenamiento","Ubicación","Responsable","Fecha Compra","Garantía hasta","Vida Útil (años)","Fin de Vida"];
    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("es-MX") : "";
    const locName = (a: ReportAsset & { locationPath?: string | null }) => formatAssetLocation(a.location, a.locationPath);
    const esc = (v: string | number | null | undefined) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = data.assets.map((a) => [
      a.assetCode, a.brand, a.model, a.serialNumber ?? "",
      deviceTypeLabel[a.deviceType] ?? a.deviceType,
      statusLabel[a.status] ?? a.status,
      a.processor ?? "", a.ramGb ?? "", a.storageGb ?? "", a.storageType ?? "",
      locName(a), a.assignedToName ?? "",
      fmtDate(a.purchaseDate), fmtDate(a.warrantyEnd),
      a.usefulLifeYears ?? "", fmtDate(a.endOfLifeDate),
    ].map(esc).join(","));
    const bom = "\uFEFF";
    const csv = bom + [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ciclo_de_vida_${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify.success("Exportar", `Se exportaron ${data.assets.length} registros.`);
  };

  const sortedMonths = data ? Object.keys(data.byMonth).sort() : [];
  const now = new Date();

  return (
    <section className="animate-fade-in space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/15">
          <TrendingDown size={20} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Reporte de Ciclo de Vida</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Equipos por vencer para planificación de presupuesto.</p>
        </div>
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600 dark:text-slate-300">Año base:</label>
        <div className="flex gap-1">
          {[year - 1, year, year + 1, year + 2].map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                y === year
                  ? "bg-primary text-white shadow-sm"
                  : "border border-border-light dark:border-border-dark text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-lighter"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        {data && data.assets.length > 0 && (
          <button
            onClick={exportExcel}
            className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition"
          >
            <Download size={16} /> Exportar Excel
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
          Generando reporte...
        </div>
      ) : !data || data.assets.length === 0 ? (
        <div className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-8 text-center text-sm text-slate-400">
          No hay equipos con fin de vida en el rango seleccionado.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-5 shadow-card">
              <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Total por vencer</p>
              <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{data.assets.length}</p>
              <p className="text-xs text-slate-400">equipos en rango</p>
            </div>
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5 shadow-card">
              <p className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400">Vencen este año</p>
              <p className="mt-1 text-3xl font-bold text-amber-700 dark:text-amber-300">
                {data.assets.filter((a) => a.endOfLifeDate && new Date(a.endOfLifeDate).getFullYear() === year).length}
              </p>
              <p className="text-xs text-amber-500">equipos en {year}</p>
            </div>
            <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-5 shadow-card">
              <p className="text-xs uppercase tracking-wider text-red-600 dark:text-red-400">Ya vencidos</p>
              <p className="mt-1 text-3xl font-bold text-red-700 dark:text-red-300">
                {data.assets.filter((a) => a.endOfLifeDate && new Date(a.endOfLifeDate) < now).length}
              </p>
              <p className="text-xs text-red-500">requieren reemplazo</p>
            </div>
          </div>

          {/* By month */}
          <div className="space-y-4">
            {sortedMonths.map((key) => {
              const monthAssets = data.byMonth[key];
              const isPast = new Date(key + "-28") < now;
              return (
                <div key={key} className={`rounded-2xl border bg-white dark:bg-surface-dark p-5 shadow-card ${
                  isPast ? "border-red-200 dark:border-red-800" : "border-border-light dark:border-border-dark"
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white capitalize">
                      <CalendarDays size={16} className="text-primary" />
                      {monthName(key)}
                      {isPast && <AlertTriangle size={14} className="text-red-500" />}
                    </h3>
                    <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      {monthAssets.length} equipo{monthAssets.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border-light dark:border-border-dark text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <th className="pb-2 pr-4">Código</th>
                          <th className="pb-2 pr-4">Tipo</th>
                          <th className="pb-2 pr-4">Marca/Modelo</th>
                          <th className="pb-2 pr-4">Ubicación</th>
                          <th className="pb-2 pr-4">Compra</th>
                          <th className="pb-2">Fin de vida</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-light dark:divide-border-dark">
                        {monthAssets.map((a) => (
                          <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-surface-lighter/40 transition-colors">
                            <td className="py-2 pr-4 font-semibold text-primary">{a.assetCode}</td>
                            <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{deviceTypeLabel[a.deviceType] ?? a.deviceType}</td>
                            <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{a.brand} {a.model}</td>
                            <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{formatAssetLocation(a.location, a.locationPath)}</td>
                            <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">
                              {a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString("es-MX", { year: "numeric", month: "short" }) : "—"}
                            </td>
                            <td className={`py-2 font-medium ${
                              a.endOfLifeDate && new Date(a.endOfLifeDate) < now ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"
                            }`}>
                              {a.endOfLifeDate ? new Date(a.endOfLifeDate).toLocaleDateString("es-MX", { year: "numeric", month: "short" }) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};
