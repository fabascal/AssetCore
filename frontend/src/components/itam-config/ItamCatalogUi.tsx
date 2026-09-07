import { LucideIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { ReactNode } from "react";

export const inputCls =
  "w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none transition-all duration-200 placeholder:text-on-surface-variant/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm font-medium text-on-surface transition-all duration-200 hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50";

type CatalogToolbarProps = {
  title: string;
  description: string;
  count: number;
  countLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const CatalogToolbar = ({
  title,
  description,
  count,
  countLabel,
  search,
  onSearchChange,
  searchPlaceholder,
  actionLabel,
  onAction,
}: CatalogToolbarProps) => (
  <div className="space-y-4 border-b border-outline-variant pb-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-on-surface">{title}</h3>
        <p className="mt-0.5 text-sm text-on-surface-variant">{description}</p>
      </div>
      <span className="inline-flex items-center rounded-full bg-tertiary-container px-3 py-1 text-xs font-semibold text-on-tertiary-container">
        {count} {countLabel}
      </span>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className={`${inputCls} min-w-[200px] flex-1`}
      />
      {onAction && actionLabel ? (
        <button type="button" onClick={onAction} className={btnPrimary}>
          <Plus size={16} />
          {actionLabel}
        </button>
      ) : null}
    </div>
  </div>
);

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const CatalogEmptyState = ({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant bg-surface-container-low px-6 py-14 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
      <Icon size={22} />
    </div>
    <p className="mt-4 text-sm font-semibold text-on-surface">{title}</p>
    <p className="mt-1 max-w-sm text-sm text-on-surface-variant">{description}</p>
    {onAction && actionLabel ? (
      <button type="button" onClick={onAction} className={`${btnPrimary} mt-5`}>
        <Plus size={16} />
        {actionLabel}
      </button>
    ) : null}
  </div>
);

type IconActionProps = {
  label: string;
  onClick: () => void;
  icon: "edit" | "add" | "delete";
  size?: "sm" | "md";
};

const iconMap = { edit: Pencil, add: Plus, delete: Trash2 } as const;
const toneMap = {
  edit: "text-on-surface-variant hover:bg-surface-container-high hover:text-primary",
  add: "text-on-surface-variant hover:bg-secondary-container hover:text-on-secondary-container",
  delete: "text-on-surface-variant hover:bg-error-container hover:text-on-error-container",
};

export const IconAction = ({ label, onClick, icon, size = "md" }: IconActionProps) => {
  const Icon = iconMap[icon];
  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const iconSize = size === "sm" ? 13 : 15;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex ${dim} items-center justify-center rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${toneMap[icon]}`}
    >
      <Icon size={iconSize} />
    </button>
  );
};

type CatalogTableProps = {
  columns: Array<{ key: string; label: string; align?: "left" | "center" | "right"; className?: string }>;
  children: ReactNode;
};

export const CatalogTable = ({ columns, children }: CatalogTableProps) => (
  <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-outline-variant bg-surface-container-low">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant ${
                  col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"
                } ${col.className ?? ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">{children}</tbody>
      </table>
    </div>
  </div>
);

export const CatalogRow = ({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) => (
  <tr
    onClick={onClick}
    className={`transition-colors duration-200 hover:bg-surface-container-low ${onClick ? "cursor-pointer" : ""}`}
  >
    {children}
  </tr>
);

export const CatalogLoading = () => (
  <div className="space-y-3 py-2">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-container-high" />
    ))}
  </div>
);
