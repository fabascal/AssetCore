import { useMemo, useState } from "react";
import { Search, Filter, Plus, Printer } from "lucide-react";
import { Asset, assetStatusLabels } from "../types";
import { formatAssetLocation } from "../lib/locations";
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

const statusLabel = assetStatusLabels;

type LifecycleState = "expired" | "expiring_this_year" | null;

const getLifecycleState = (asset: Asset): LifecycleState => {
  if (!asset.endOfLifeDate) return null;
  const eol = new Date(asset.endOfLifeDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eol.setHours(0, 0, 0, 0);
  if (eol < today) return "expired";
  if (eol.getFullYear() === today.getFullYear()) return "expiring_this_year";
  return null;
};

/** Color de barra alineado al texto del badge (emerald-700, blue-700, etc.). */
const getRowAccentKey = (asset: Asset): string => {
  const lifecycle = getLifecycleState(asset);
  if (lifecycle === "expired") return "expired";
  if (lifecycle === "expiring_this_year") return "expiring_this_year";
  return asset.status;
};

const rowAccentBg: Record<string, string> = {
  expired: "bg-red-600 dark:bg-red-400",
  expiring_this_year: "bg-amber-600 dark:bg-amber-400",
  ASSIGNED: "bg-blue-600 dark:bg-blue-400",
  AVAILABLE: "bg-emerald-600 dark:bg-emerald-400",
  MAINTENANCE: "bg-amber-600 dark:bg-amber-400",
  SCRAP: "bg-rose-600 dark:bg-rose-400",
};

const RowAccentBar = ({ asset }: { asset: Asset }) => (
  <span
    className={`absolute left-0 top-0 bottom-0 w-[3px] ${rowAccentBg[getRowAccentKey(asset)] ?? "bg-outline-variant"}`}
    aria-hidden
  />
);

const lifecycleStyles = {
  expired: "bg-error-container text-on-error-container",
  expiring_this_year: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400",
} as const;

const lifecycleLabels = {
  expired: "Vencido",
  expiring_this_year: "Vence este año",
} as const;

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
          <h2 className="text-2xl font-bold text-on-surface">Inventario de Activos</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            {filteredAssets.length} activo{filteredAssets.length !== 1 ? "s" : ""} encontrado{filteredAssets.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBatchPrint(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition"
            title="Imprimir etiquetas por ubicación"
          >
            <Printer size={15} /> Etiquetas
          </button>
          {onNew && (
            <button
              onClick={onNew}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-on-primary shadow-sm hover:brightness-110 transition focus-ring"
            >
              <Plus size={16} /> Nuevo Activo
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por Marca, Modelo o Serial..."
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-9 pr-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition focus-ring"
          />
        </div>

        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Asset["status"] | "ALL")}
            className="appearance-none rounded-xl border border-outline-variant bg-surface-container-lowest pl-8 pr-8 py-2.5 text-sm text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition"
          >
            <option value="ALL">Todos los estados</option>
            <option value="AVAILABLE">Disponible</option>
            <option value="ASSIGNED">Asignado</option>
            <option value="MAINTENANCE">Mantenimiento</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-card">
        <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">AssetCode</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Tipo</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Marca</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Modelo</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Serie</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Ubicación</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Asignado a</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Estado</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {loading ? (
              <tr>
                <td className="px-4 py-12 text-center text-sm text-on-surface-variant" colSpan={9}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Cargando activos...
                  </span>
                </td>
              </tr>
            ) : null}
            {!loading &&
              filteredAssets.map((asset) => {
              const lifecycle = getLifecycleState(asset);

              return (
                <tr key={asset.id} className="relative transition-colors hover:bg-surface-container-high">
                  <td className="relative px-4 py-3.5 text-sm font-semibold text-primary">
                    <RowAccentBar asset={asset} />
                    <span className="relative">{asset.assetCode}</span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-on-surface-variant">{asset.assetType?.name ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm text-on-surface">{asset.brand}</td>
                  <td className="px-4 py-3.5 text-sm text-on-surface">{asset.model}</td>
                  <td className="px-4 py-3.5 text-sm font-mono text-on-surface-variant">{asset.serialNumber}</td>
                  <td className="px-4 py-3.5 text-xs text-on-surface-variant">{formatAssetLocation(asset.location, asset.locationPath)}</td>
                  <td className="px-4 py-3.5 text-xs text-on-surface-variant">{asset.assignedToName ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold ${statusStyles[asset.status]}`}>
                        {statusLabel[asset.status]}
                      </span>
                      {lifecycle ? (
                        <span className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold ${lifecycleStyles[lifecycle]}`}>
                          {lifecycleLabels[lifecycle]}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onView(asset.id)}
                        className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition"
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(asset)}
                        className="rounded-lg bg-primary-container px-3 py-1.5 text-xs font-medium text-on-primary-container hover:brightness-110 transition focus-ring"
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
                <td className="px-4 py-12 text-center text-sm text-on-surface-variant" colSpan={9}>
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
