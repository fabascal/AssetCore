import { Bot, TicketPlus } from "lucide-react";

type AiLog = {
  id: number;
  channel: string;
  sender: string | null;
  subject: string | null;
  body: string;
  aiIntent: string | null;
  aiAction: string | null;
  detectedAssetCode: string | null;
  detectedSerialNumber: string | null;
  createdAt: string;
  createdTicket?: {
    id: number;
    status: string;
    level: string;
    priority: string;
    asset: { assetCode: string };
  } | null;
};

type Props = {
  logs: AiLog[];
  onCreateManualTicket: (log: AiLog) => void;
};

export const AiLogsView = ({ logs, onCreateManualTicket }: Props) => {
  return (
    <section className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Logs de IA (Combuito)</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Mensajes entrantes y acciones automatizadas del agente.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-card">
      <div className="overflow-auto">
        <table className="min-w-full divide-y divide-border-light dark:divide-border-dark">
          <thead>
            <tr className="border-b border-border-light dark:border-border-dark bg-slate-50/80 dark:bg-background-dark">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Canal</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Remitente</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Intent</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Deteccion</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Accion IA</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Fecha</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Accion Manual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark">
            {logs.map((log) => (
              <tr key={log.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-surface-lighter/40">
                <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">{log.channel}</td>
                <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">{log.sender ?? "-"}</td>
                <td className="px-4 py-3 text-xs">
                  <span className="rounded bg-primary/15 px-2 py-1 font-semibold text-primary">{log.aiIntent ?? "N/A"}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                  {log.detectedAssetCode ?? log.detectedSerialNumber ?? "-"}
                </td>
                <td className="px-4 py-3 text-xs text-slate-800 dark:text-slate-200">
                  <div>{log.aiAction ?? "-"}</div>
                  {log.createdTicket ? (
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Ticket #{log.createdTicket.id} - {log.createdTicket.status} - {log.createdTicket.asset.assetCode}
                    </div>
                  ) : null}
                  <div className="mt-1 max-w-lg truncate text-[11px] text-slate-500 dark:text-slate-500">{log.subject ?? log.body}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-xs">
                  {!log.createdTicket ? (
                    <button
                      type="button"
                      onClick={() => onCreateManualTicket(log)}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-dark transition"
                    >
                      <TicketPlus size={13} />
                      Crear ticket
                    </button>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-500">Ya procesado</span>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={7}>
                  Sin logs de IA por el momento.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      </div>
    </section>
  );
};
