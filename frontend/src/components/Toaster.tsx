import { useCallback, useEffect, useReducer, useRef } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
  Loader2,
} from "lucide-react";
import { toastBus, ToastData, ToastVariant } from "../lib/toast-bus";

/* ── Types ─────────────────────────────────────────── */

type ToastItem = ToastData & { exiting: boolean };

type Action =
  | { type: "ADD";        toast: ToastData }
  | { type: "START_EXIT"; id: string }
  | { type: "REMOVE";     id: string };

/* ── Reducer ─────────────────────────────────────── */

const MAX_VISIBLE = 5;
const EXIT_DURATION = 320; // ms — must match CSS animation

function reducer(state: ToastItem[], action: Action): ToastItem[] {
  switch (action.type) {
    case "ADD":
      return [{ ...action.toast, exiting: false }, ...state].slice(0, MAX_VISIBLE);
    case "START_EXIT":
      return state.map((t) => (t.id === action.id ? { ...t, exiting: true } : t));
    case "REMOVE":
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

/* ── Variant config ─────────────────────────────── */

type VariantCfg = {
  Icon: React.ElementType;
  spin?: boolean;
  iconRing: string;   // border color of icon wrapper
  iconBg: string;     // bg of icon wrapper
  iconColor: string;  // icon color
  bar: string;        // progress bar color
};

const VARIANT: Record<ToastVariant, VariantCfg> = {
  success: {
    Icon: CheckCircle2,
    iconRing:  "border-emerald-200 dark:border-emerald-800",
    iconBg:    "bg-emerald-50 dark:bg-emerald-950/60",
    iconColor: "text-emerald-500",
    bar:       "bg-emerald-500",
  },
  error: {
    Icon: XCircle,
    iconRing:  "border-red-200 dark:border-red-800",
    iconBg:    "bg-red-50 dark:bg-red-950/60",
    iconColor: "text-red-500",
    bar:       "bg-red-500",
  },
  warning: {
    Icon: AlertTriangle,
    iconRing:  "border-amber-200 dark:border-amber-800",
    iconBg:    "bg-amber-50 dark:bg-amber-950/60",
    iconColor: "text-amber-500",
    bar:       "bg-amber-500",
  },
  info: {
    Icon: Info,
    iconRing:  "border-blue-200 dark:border-blue-800",
    iconBg:    "bg-blue-50 dark:bg-blue-950/60",
    iconColor: "text-blue-500",
    bar:       "bg-blue-500",
  },
  loading: {
    Icon: Loader2,
    spin: true,
    iconRing:  "border-primary/30 dark:border-primary/40",
    iconBg:    "bg-primary/8 dark:bg-primary/15",
    iconColor: "text-primary",
    bar:       "bg-primary",
  },
};

/* ── Single Toast card ───────────────────────────── */

type ToastCardProps = {
  toast: ToastItem;
  onDismiss: (id: string) => void;
};

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const cfg = VARIANT[toast.variant];
  const persistent = toast.duration === 0;

  /* Auto-dismiss timer */
  useEffect(() => {
    if (persistent) return;
    const tid = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(tid);
  }, [toast.id, toast.duration, persistent, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        /* Layout */
        "relative w-[340px] overflow-hidden",
        /* Shape */
        "rounded-2xl border",
        /* Colors — light */
        "bg-white border-border-light shadow-card-hover",
        /* Colors — dark */
        "dark:bg-surface-dark dark:border-border-dark dark:shadow-none",
        /* Animation */
        toast.exiting ? "toast-exit" : "toast-enter",
      ].join(" ")}
    >
      {/* Body */}
      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* Icon */}
        <div
          className={[
            "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border",
            cfg.iconBg,
            cfg.iconRing,
          ].join(" ")}
        >
          <cfg.Icon
            size={16}
            className={[cfg.iconColor, cfg.spin ? "animate-spin" : ""].join(" ")}
          />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-white">
            {toast.title}
          </p>
          {toast.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {toast.description}
            </p>
          )}
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="ml-1 flex-shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-surface-lighter dark:hover:text-slate-200"
          aria-label="Cerrar notificación"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      {!persistent && (
        <div className="absolute bottom-0 left-0 h-[3px] w-full overflow-hidden rounded-b-2xl bg-black/5 dark:bg-white/5">
          <div
            className={["h-full rounded-b-2xl", cfg.bar].join(" ")}
            style={{
              animation: `toast-progress ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ── Toaster container ───────────────────────────── */

export function Toaster() {
  const [toasts, dispatch] = useReducer(reducer, []);

  const dismiss = useCallback((id: string) => {
    dispatch({ type: "START_EXIT", id });
    setTimeout(() => dispatch({ type: "REMOVE", id }), EXIT_DURATION);
  }, []);

  /* Subscribe to the event bus */
  useEffect(() => {
    return toastBus.subscribe((event) => {
      if (event.kind === "add") {
        dispatch({ type: "ADD", toast: event.toast });
      } else {
        dismiss(event.id);
      }
    });
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      aria-label="Notificaciones"
      className="pointer-events-none fixed right-4 top-[72px] z-[9999] flex flex-col gap-2.5"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastCard toast={toast} onDismiss={dismiss} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
