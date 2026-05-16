export type ToastVariant = "success" | "error" | "warning" | "info" | "loading";

export type ToastData = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  /** milliseconds; 0 = persistent until manually dismissed */
  duration: number;
};

type AddEvent    = { kind: "add";     toast: ToastData };
type DismissEvent = { kind: "dismiss"; id: string };
type BusEvent   = AddEvent | DismissEvent;

type Listener = (event: BusEvent) => void;

const listeners = new Set<Listener>();

export const toastBus = {
  subscribe: (fn: Listener): (() => void) => {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  add:     (toast: ToastData) => listeners.forEach((fn) => fn({ kind: "add", toast })),
  dismiss: (id: string)       => listeners.forEach((fn) => fn({ kind: "dismiss", id })),
};
