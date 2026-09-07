import { AlertTriangle, ArrowUpRight, DollarSign, Loader2, TrendingDown } from "lucide-react";
import { formatCurrencyMxn } from "./assets/AssetUi";

export type FinancialSummary = {
  asOfDate: string;
  totalOriginalValue: number;
  totalBookValue: number;
  totalAccumulatedDepreciation: number;
  activeAssetsCount: number;
  assetsWithDepreciationData: number;
  fullyDepreciatedCount: number;
  nearingFullDepreciation: Array<{
    id: number;
    assetCode: string;
    brand: string;
    model: string;
    bookValue: number;
    monthsUntilFullyDepreciated: number;
    projectedFullDepreciationDate: string | null;
  }>;
};

type Props = {
  data: FinancialSummary | null;
  loading?: boolean;
  onViewAsset?: (assetId: number) => void;
  onOpenReport?: () => void;
};

export const DashboardFinancialWidget = ({ data, loading = false, onViewAsset, onOpenReport }: Props) => {
  const remainingPct =
    data && data.totalOriginalValue > 0
      ? Math.round((data.totalBookValue / data.totalOriginalValue) * 100)
      : 0;

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            <DollarSign size={16} className="text-primary" />
            Resumen financiero del inventario
          </h3>
          <p className="mt-1 text-xs text-on-surface-variant">
            MOI, valor en libros y depreciación acumulada de activos en circulación.
          </p>
        </div>
        {onOpenReport ? (
          <button
            type="button"
            onClick={onOpenReport}
            className="inline-flex items-center gap-1 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-surface-container-high"
          >
            Ver reporte
            <ArrowUpRight size={13} />
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-on-surface-variant">
          <Loader2 size={16} className="animate-spin" />
          Calculando valores contables…
        </div>
      ) : !data || data.assetsWithDepreciationData === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-6 text-center text-sm text-on-surface-variant">
          Sin datos contables suficientes. Completa MOI y fecha de compra en los activos.
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">MOI total</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-on-surface">{formatCurrencyMxn(data.totalOriginalValue)}</p>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary-container/25 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Valor en libros</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-primary">{formatCurrencyMxn(data.totalBookValue)}</p>
            </div>
            <div className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">Depreciación acumulada</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-on-surface">{formatCurrencyMxn(data.totalAccumulatedDepreciation)}</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-on-surface-variant">
              <span className="flex items-center gap-1">
                <TrendingDown size={13} />
                {remainingPct}% del MOI aún en libros
              </span>
              <span>
                {data.assetsWithDepreciationData} de {data.activeAssetsCount} activos con datos
                {data.fullyDepreciatedCount > 0 ? ` · ${data.fullyDepreciatedCount} al 100%` : ""}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.max(2, remainingPct)}%` }}
              />
            </div>
          </div>

          {data.nearingFullDepreciation.length > 0 ? (
            <div className="rounded-xl border border-amber-300/50 bg-amber-50/80 dark:border-amber-500/25 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 border-b border-amber-200/60 px-4 py-2.5 dark:border-amber-500/20">
                <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400" />
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                  Renovación próxima ({data.nearingFullDepreciation.length})
                </p>
                <span className="text-[11px] text-amber-700/80 dark:text-amber-300/70">Depreciación al 100% en ≤ 3 meses</span>
              </div>
              <ul className="divide-y divide-amber-200/50 dark:divide-amber-500/15">
                {data.nearingFullDepreciation.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onViewAsset?.(item.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-amber-100/60 dark:hover:bg-amber-500/10"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-primary">{item.assetCode}</p>
                        <p className="truncate text-xs text-on-surface-variant">
                          {item.brand} {item.model}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                          {item.monthsUntilFullyDepreciated === 1
                            ? "1 mes restante"
                            : `${item.monthsUntilFullyDepreciated} meses restantes`}
                        </p>
                        <p className="text-[11px] text-on-surface-variant">En libros: {formatCurrencyMxn(item.bookValue)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              {data.nearingFullDepreciation.length > 5 ? (
                <p className="px-4 py-2 text-center text-[11px] text-on-surface-variant">
                  y {data.nearingFullDepreciation.length - 5} más en el reporte
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
