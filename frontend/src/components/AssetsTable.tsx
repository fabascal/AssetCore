import { useMemo, useState } from "react";
import { Search, Filter, Plus, Printer } from "lucide-react";
import { Asset } from "../types";
import { BatchLabelPrintModal } from "./BatchLabelPrintModal";

type Props = {
  assets: Asset[];
  loading?: boolean;
  onView: (assetId: number) => void;
  onEdit: (asset: Asset) => void;
  onNew?: () => void;
};

const statusStyles: Record<Asset["status"], string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  ASSIGNED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  MAINTENANCE: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  SCRAP: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};

const statusLabel: Record<Asset["status"], string> = {
  AVAILABLE: "Disponible",
  ASSIGNED: "Asignado",
  MAINTENANCE: "Mantenimiento",
  SCRAP: "Scrap",
};

const urgencyRank = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 } as const;

const urgencyAccent: Record<string, string> = {
  CRITICAL: "border-l-[3px] border-l-red-500",
  HIGH: "border-l-[3px] border-l-orange-500",
  MEDIUM: "border-l-[3px] border-l-amber-400",
  LOW: "border-l-[3px] border-l-emerald-400",
  NONE: "",
};

export const AssetsTable = ({ assets, loading = false, onView, onEdit, onNew }: Props) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Asset["status"] | "ALL">("ALL");
  const [showBatchPrint, setShowBatchPrint] = useState(false);

  const filteredAssets = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const statusMatch = statusFilter === "ALL" ? true : asset.status === statusFilter;
      if (!statusMatch) return false;
      if (!normalized) return true;

      return (
        asset.brand.toLowerCase().includes(normalized) ||
        asset.model.toLowerCase().includes(normalized) ||
        asset.serialNumber.toLowerCase().includes(normalized) ||
        (asset.assetType?.name ?? "").toLowerCase().includes(normalized) ||
        (asset.location?.parent?.name ?? "").toLowerCase().includes(normalized) ||
        (asset.location?.name ?? "").toLowerCase().includes(normalized) ||
        (asset.assignedToName ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [assets, search, statusFilter]);

  return (
    <section className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Inventario de Activos</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {filteredAssets.length} activo{filteredAssets.length !== 1 ? "s" : ""} encontrado{filteredAssets.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBatchPrint(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-light dark:border-border-dark px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-surface-lighter transition"
            title="Imprimir etiquetas por ubicación"
          >
            <Printer size={15} /> Etiquetas
          </button>
          {onNew && (
            <button
              onClick={onNew}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-dark transition"
            >
              <Plus size={16} /> Nuevo Activo
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por Marca, Modelo o Serial..."
            className="w-full rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition"
          />
        </div>

        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Asset["status"] | "ALL")}
            className="appearance-none rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark pl-8 pr-8 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition"
          >
            <option value="ALL">Todos los estados</option>
            <option value="AVAILABLE">Disponible</option>
            <option value="ASSIGNED">Asignado</option>
            <option value="MAINTENANCE">Mantenimiento</option>
            <option value="SCRAP">Scrap</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-card">
        <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border-light dark:border-border-dark bg-slate-50/80 dark:bg-background-dark">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">AssetCode</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tipo</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Marca</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Modelo</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Serie</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ubicación</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Asignado a</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Estado</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark">
            {loading ? (
              <tr>
                <td className="px-4 py-12 text-center text-sm text-slate-400" colSpan={9}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Cargando activos...
                  </span>
                </td>
              </tr>
            ) : null}
            {!loading &&
              filteredAssets.map((asset) => {
              const maxPriority =
                asset.tickets?.reduce<string>((acc, t) => {
                  const current = urgencyRank[(t.priority as keyof typeof urgencyRank) ?? "LOW"] ?? 1;
                  const best = urgencyRank[(acc as keyof typeof urgencyRank) ?? "LOW"] ?? 1;
                  return current > best ? t.priority : acc;
                }, "LOW") ?? "NONE";
              const rowClass = urgencyAccent[maxPriority] ?? "";

              return (
                <tr key={asset.id} className={`transition-colors hover:bg-slate-50 dark:hover:bg-surface-lighter/40 ${rowClass}`}>
                  <td className="px-4 py-3.5 text-sm font-semibold text-primary">{asset.assetCode}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">{asset.assetType?.name ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm text-slate-700 dark:text-slate-200">{asset.brand}</td>
                  <td className="px-4 py-3.5 text-sm text-slate-700 dark:text-slate-200">{asset.model}</td>
                  <td className="px-4 py-3.5 text-sm font-mono text-slate-500 dark:text-slate-400">{asset.serialNumber}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">{asset.location ? (asset.location.parent ? `${asset.location.parent.name} → ${asset.location.name}` : asset.location.name) : "—"}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">{asset.assignedToName ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm">
                    <span className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold ${statusStyles[asset.status]}`}>
                      {statusLabel[asset.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onView(asset.id)}
                        className="rounded-lg border border-border-light dark:border-border-dark px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-lighter transition"
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(asset)}
                        className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition"
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
            {!loading && filteredAssets.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center text-sm text-slate-400" colSpan={9}>
                  No hay activos que coincidan con los filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </div>

      {showBatchPrint && (
        <BatchLabelPrintModal assets={assets} onClose={() => setShowBatchPrint(false)} />
      )}
    </section>
  );
};
