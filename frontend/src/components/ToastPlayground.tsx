import { notify } from "../lib/toast";

const runPromiseToast = () => {
  const handle = notify.loading("Procesando", "Ejecutando una operación de prueba...");

  const mockRequest = new Promise<string>((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() > 0.35) resolve("El proceso terminó correctamente.");
      else reject(new Error("Error simulado para probar estado fallido."));
    }, 1800);
  });

  mockRequest
    .then((result) => {
      handle.dismiss();
      notify.success("Operación completada", result);
    })
    .catch(() => {
      handle.dismiss();
      notify.error("Operación fallida", "La operación de prueba terminó con error.");
    });
};

export const ToastPlayground = () => (
  <section className="rounded-xl border border-border-light dark:border-border-dark bg-white/90 dark:bg-surface-dark p-6 shadow-sm transition-colors">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          Playground de Toasts
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Prueba visual de notificaciones para validar variantes, color y comportamiento.
        </p>
      </div>
    </div>

    <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <button
        type="button"
        onClick={() => notify.success("Guardado", "Los cambios se aplicaron correctamente.")}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
      >
        Toast Success
      </button>

      <button
        type="button"
        onClick={() => notify.error("Error", "No fue posible completar la acción.")}
        className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition"
      >
        Toast Error
      </button>

      <button
        type="button"
        onClick={() => notify.warning("Atención", "Revisa los campos obligatorios antes de continuar.")}
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-600 transition"
      >
        Toast Warning
      </button>

      <button
        type="button"
        onClick={() => notify.info("Información", "Este es un mensaje informativo para el usuario.")}
        className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 transition"
      >
        Toast Info
      </button>

      <button
        type="button"
        onClick={runPromiseToast}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
      >
        Toast Loading → Result
      </button>

      <button
        type="button"
        onClick={() => notify.loading("Cargando...", "Esta notificación persiste hasta que la descartes.")}
        className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-surface-lighter transition"
      >
        Toast Loading (persistente)
      </button>
    </div>
  </section>
);
