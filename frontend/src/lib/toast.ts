import { toastBus, ToastVariant } from "./toast-bus";

let counter = 0;
const genId = () => `t-${(++counter).toString(36)}-${Date.now().toString(36)}`;

const DEFAULT_DURATION = 3200;

type ApiError = {
  response?: { data?: { message?: string } };
};

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const typed = error as ApiError;
  return typed.response?.data?.message ?? fallback;
};

const show = (
  variant: ToastVariant,
  title: string,
  description?: string,
  duration = DEFAULT_DURATION,
): string => {
  const id = genId();
  toastBus.add({ id, variant, title, description, duration });
  return id;
};

export const notify = {
  success: (title: string, description?: string) =>
    show("success", title, description),

  error: (title: string, description?: string) =>
    show("error", title, description),

  warning: (title: string, description?: string) =>
    show("warning", title, description),

  info: (title: string, description?: string) =>
    show("info", title, description),

  /** Persistent toast — returns a handle with a `dismiss()` method */
  loading: (title: string, description?: string) => {
    const id = show("loading", title, description, 0);
    return {
      id,
      dismiss: () => toastBus.dismiss(id),
    };
  },

  dismiss: (id: string) => toastBus.dismiss(id),
};
