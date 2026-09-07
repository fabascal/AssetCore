import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { AssetStatus, assetStatusLabels } from "../../types";

export { btnPrimary, btnSecondary, inputCls } from "../itam-config/ItamCatalogUi";

export const AssetPanel = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 md:p-6 transition-colors duration-200 ${className}`}>
    {children}
  </div>
);

type AssetPageHeaderProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
};

export const AssetPageHeader = ({ icon: Icon, title, subtitle, badge, actions }: AssetPageHeaderProps) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-on-surface">{title}</h2>
          {badge}
        </div>
        {subtitle ? <p className="mt-0.5 text-sm text-on-surface-variant">{subtitle}</p> : null}
      </div>
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

type AssetSectionProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
};

export const AssetSection = ({ title, description, icon: Icon, children, className = "" }: AssetSectionProps) => (
  <section className={`${className}`}>
    <div className="mb-4 border-b border-outline-variant pb-3">
      <div className="flex items-center gap-2">
        {Icon ? <Icon size={16} className="text-primary" /> : null}
        <h3 className="text-sm font-semibold text-on-surface">{title}</h3>
      </div>
      {description ? <p className="mt-1 text-xs text-on-surface-variant">{description}</p> : null}
    </div>
    {children}
  </section>
);

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export const FormField = ({ label, htmlFor, hint, required, className = "", children }: FormFieldProps) => (
  <label htmlFor={htmlFor} className={`flex flex-col gap-1.5 text-sm ${className}`}>
    <span className="font-medium text-on-surface">
      {label}
      {required ? <span className="text-error"> *</span> : null}
    </span>
    {children}
    {hint ? <span className="text-xs text-on-surface-variant">{hint}</span> : null}
  </label>
);

export const ReadonlyMetric = ({
  label,
  value,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "warning" | "highlight";
  icon?: LucideIcon;
}) => {
  const toneCls = {
    default: "border-outline-variant bg-surface-container-low text-on-surface",
    warning: "border-tertiary/40 bg-tertiary-container/40 text-on-surface",
    highlight: "border-primary/30 bg-primary-container/30 text-on-surface",
  }[tone];

  return (
    <div className={`flex flex-col gap-1 rounded-xl border px-3 py-2.5 ${toneCls}`}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
        {Icon ? <Icon size={13} /> : null}
        {label}
      </span>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
};

type DetailFieldProps = {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  mono?: boolean;
  highlight?: boolean;
  className?: string;
};

export const DetailField = ({ label, value, icon: Icon, mono, highlight, className = "" }: DetailFieldProps) => (
  <div
    className={`rounded-xl border px-4 py-3 transition-colors duration-200 ${
      highlight
        ? "border-primary/30 bg-primary-container/20"
        : "border-outline-variant bg-surface-container-low"
    } ${className}`}
  >
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
      {Icon ? <Icon size={13} className="text-primary" /> : null}
      {label}
    </div>
    <div className={`mt-1 text-sm text-on-surface ${mono ? "font-mono" : ""}`}>{value}</div>
  </div>
);

export const DetailFieldGrid = ({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) => {
  const colCls = { 2: "md:grid-cols-2", 3: "md:grid-cols-2 lg:grid-cols-3", 4: "md:grid-cols-2 lg:grid-cols-4" }[cols];
  return <div className={`grid gap-3 ${colCls}`}>{children}</div>;
};

const statusTone: Record<AssetStatus, string> = {
  AVAILABLE: "bg-primary-container text-on-primary-container",
  ASSIGNED: "bg-secondary-container text-on-secondary-container",
  MAINTENANCE: "bg-tertiary-container text-on-tertiary-container",
  SCRAP: "bg-error-container text-on-error-container",
};

export const AssetStatusBadge = ({ status }: { status: AssetStatus }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone[status]}`}>
    {assetStatusLabels[status]}
  </span>
);

export const FormActions = ({ children }: { children: ReactNode }) => (
  <div className="mt-6 flex flex-wrap gap-3 border-t border-outline-variant pt-5">{children}</div>
);

export const formatCurrencyMxn = (value?: number | null) =>
  value !== null && value !== undefined
    ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value))
    : "—";

export const formatDateMx = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" }) : "—";

export const formatStorage = (storageGb?: number | null, storageType?: string | null) => {
  if (!storageGb) return "—";
  return `${storageGb} GB${storageType ? ` · ${storageType}` : ""}`;
};

export const formatRam = (ramGb?: number | null) => (ramGb ? `${ramGb} GB` : "—");

export const hasTechnicalSpecs = (asset: {
  processor?: string | null;
  ramGb?: number | null;
  storageGb?: number | null;
  storageType?: string | null;
}) => Boolean(asset.processor || asset.ramGb || asset.storageGb || asset.storageType);
