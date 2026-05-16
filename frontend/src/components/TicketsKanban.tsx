import { useMemo } from "react";
import { TicketPriority, TicketStatus } from "../types";

type KanbanTicket = {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt?: string;
  assignedTo?: { id: number; fullName: string; email: string } | null;
  asset?: { id: number; assetCode: string; brand: string; model: string } | null;
  supportTopic?: { id: number; name: string } | null;
  _count?: { comments: number; attachments: number };
};

type Props = {
  tickets: KanbanTicket[];
  onTicketClick: (id: number) => void;
};

const COLUMNS: { status: TicketStatus; label: string; color: string; border: string }[] = [
  { status: "OPEN", label: "Abierto", color: "bg-blue-500", border: "border-blue-300 dark:border-blue-700" },
  { status: "IN_PROGRESS", label: "En proceso", color: "bg-amber-500", border: "border-amber-300 dark:border-amber-700" },
  { status: "PROVIDER", label: "Proveedor", color: "bg-purple-500", border: "border-purple-300 dark:border-purple-700" },
  { status: "CLOSED", label: "Cerrado", color: "bg-emerald-500", border: "border-emerald-300 dark:border-emerald-700" },
  { status: "CANCELLED", label: "Cancelado", color: "bg-slate-400", border: "border-slate-300 dark:border-slate-600" },
];

const priorityBadge: Record<TicketPriority, { label: string; cls: string }> = {
  LOW: { label: "Baja", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  MEDIUM: { label: "Media", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  HIGH: { label: "Alta", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  CRITICAL: { label: "Critica", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

export const TicketsKanban = ({ tickets, onTicketClick }: Props) => {
  const grouped = useMemo(() => {
    const map: Record<TicketStatus, KanbanTicket[]> = {
      OPEN: [],
      IN_PROGRESS: [],
      PROVIDER: [],
      CLOSED: [],
      CANCELLED: [],
    };
    for (const t of tickets) {
      map[t.status]?.push(t);
    }
    return map;
  }, [tickets]);

  // Only show today's activity for closed/cancelled (rest show all)
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const getColumnTickets = (status: TicketStatus) => {
    const list = grouped[status] ?? [];
    if (status === "CLOSED" || status === "CANCELLED") {
      return list.filter((t) => t.updatedAt ? new Date(t.updatedAt).getTime() >= todayStart : true);
    }
    return list;
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
      {COLUMNS.map((col) => {
        const colTickets = getColumnTickets(col.status);
        return (
          <div
            key={col.status}
            className={`flex-shrink-0 w-72 rounded-2xl border ${col.border} bg-slate-50/50 dark:bg-surface-dark/50 flex flex-col`}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-light dark:border-border-dark">
              <span className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {col.label}
              </span>
              <span className="ml-auto rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                {colTickets.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
              {colTickets.map((ticket) => {
                const p = priorityBadge[ticket.priority];
                return (
                  <div
                    key={ticket.id}
                    onClick={() => onTicketClick(ticket.id)}
                    className="cursor-pointer rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-3.5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-mono text-slate-400">#{ticket.id}</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${p.cls}`}>
                        {p.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2 group-hover:text-primary transition-colors">
                      {ticket.title}
                    </p>
                    {ticket.asset && (
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {ticket.asset.assetCode} — {ticket.asset.brand} {ticket.asset.model}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        {ticket.assignedTo?.fullName ?? "Sin asignar"}
                      </span>
                      <span>
                        {ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                    </div>
                    {(ticket._count?.comments || ticket._count?.attachments) ? (
                      <div className="mt-1.5 flex gap-3 text-[10px] text-slate-400">
                        {ticket._count?.comments ? (
                          <span>{ticket._count.comments} comentario{ticket._count.comments > 1 ? "s" : ""}</span>
                        ) : null}
                        {ticket._count?.attachments ? (
                          <span>{ticket._count.attachments} adjunto{ticket._count.attachments > 1 ? "s" : ""}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {colTickets.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                  {(col.status === "CLOSED" || col.status === "CANCELLED")
                    ? "Ninguno hoy"
                    : "Sin tickets"}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
