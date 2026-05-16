import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Plus, Filter, LayoutList, Columns3 } from "lucide-react";
import { api } from "../lib/api";
import { Asset, Ticket, TicketPriority, TicketStatus } from "../types";
import { notify } from "../lib/toast";
import { TicketForm } from "./TicketForm";
import { TicketsKanban } from "./TicketsKanban";

type TicketWithAsset = Ticket & {
  asset?: {
    id: number;
    assetCode: string;
    brand: string;
    model: string;
  };
};

type TicketTopic = {
  id: number;
  name: string;
  description: string | null;
};

const statusLabel: Record<TicketStatus, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En proceso",
  PROVIDER: "Proveedor",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

const statusColor: Record<TicketStatus, string> = {
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  PROVIDER: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400",
  CLOSED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  CANCELLED: "bg-slate-100 text-slate-500 dark:bg-slate-500/10 dark:text-slate-400",
};

const priorityColor: Record<TicketPriority, string> = {
  LOW: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

const priorityLabel: Record<TicketPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Critica",
};

export const TicketsView = () => {
  const [tickets, setTickets] = useState<TicketWithAsset[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<TicketTopic[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TicketStatus>("ALL");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  // View mode: "list", "create", or detail ticketId
  const [view, setView] = useState<"list" | "create" | number>("list");

  const loadData = async () => {
    setLoading(true);
    try {
      const [ticketsResponse, assetsResponse, topicsResponse] = await Promise.all([
        api.get<{ tickets: TicketWithAsset[] }>("/tickets"),
        api.get<{ assets: Asset[] }>("/assets"),
        api.get<{ topics: TicketTopic[] }>("/tickets/topics"),
      ]);

      setTickets(ticketsResponse.data.tickets);
      setAssets(assetsResponse.data.assets);
      setTopics(topicsResponse.data.topics);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData().catch(() => notify.error("Mesa de ayuda", "No fue posible cargar tickets."));
  }, []);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === "ALL" || ticket.status === statusFilter;

      const searchableText = [
        ticket.title,
        ticket.description,
        ticket.asset?.assetCode,
        ticket.asset?.brand,
        ticket.asset?.model,
        ticket.assignedTo?.fullName,
        ticket.supportTopic?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [tickets, search, statusFilter]);

  // Show full-screen create/detail
  if (view === "create") {
    return (
      <TicketForm
        assets={assets}
        topics={topics}
        onBack={() => setView("list")}
        onSaved={() => {
          setView("list");
          loadData().catch(() => {});
        }}
      />
    );
  }

  if (typeof view === "number") {
    return (
      <TicketForm
        ticketId={view}
        assets={assets}
        topics={topics}
        onBack={() => setView("list")}
        onSaved={() => {
          setView("list");
          loadData().catch(() => {});
        }}
      />
    );
  }

  // List view
  return (
    <section className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Mesa de Ayuda</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Gestiona tickets de soporte. Haz clic en un ticket para ver su detalle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-medium transition ${viewMode === "list" ? "bg-primary text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-lighter"}`}
            >
              <LayoutList size={14} />
              Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-medium transition ${viewMode === "kanban" ? "bg-primary text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-lighter"}`}
            >
              <Columns3 size={14} />
              Kanban
            </button>
          </div>
          <button
            type="button"
            onClick={() =>
              loadData()
                .then(() => notify.success("Mesa de ayuda", "Listado actualizado."))
                .catch(() => notify.error("Mesa de ayuda", "No fue posible refrescar tickets."))
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-light dark:border-border-dark px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-lighter transition"
          >
            <RefreshCw size={14} />
            Refrescar
          </button>
          <button
            type="button"
            onClick={() => setView("create")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-dark transition"
          >
            <Plus size={14} />
            Nuevo ticket
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por titulo, activo, tema o asignado..."
            className="w-full rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition"
          />
        </div>

        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | TicketStatus)}
            className="appearance-none rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark pl-8 pr-8 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition"
          >
            <option value="ALL">Todos los estados</option>
            <option value="OPEN">Abierto</option>
            <option value="IN_PROGRESS">En proceso</option>
            <option value="PROVIDER">Proveedor</option>
            <option value="CLOSED">Cerrado</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === "kanban" ? (
        <TicketsKanban
          tickets={filteredTickets}
          onTicketClick={(id) => setView(id)}
        />
      ) : (
      /* Table */
      <div className="overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-card">
        <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-border-light dark:border-border-dark bg-slate-50/80 dark:bg-background-dark">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">#</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ticket</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Activo</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tema</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Estado</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Prioridad</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Asignado</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark">
            {loading ? (
              <tr>
                <td className="px-4 py-12 text-center text-sm text-slate-400" colSpan={8}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Cargando tickets...
                  </span>
                </td>
              </tr>
            ) : null}

            {!loading &&
              filteredTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => setView(ticket.id)}
                  className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-surface-lighter/40"
                >
                  <td className="px-4 py-3.5 text-xs font-mono text-slate-400">
                    {ticket.id}
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{ticket.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{ticket.description}</p>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                    {ticket.asset ? `${ticket.asset.assetCode}` : `#${ticket.assetId}`}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">{ticket.supportTopic?.name ?? "-"}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold ${statusColor[ticket.status]}`}>
                      {statusLabel[ticket.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold ${priorityColor[ticket.priority]}`}>
                      {priorityLabel[ticket.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">{ticket.assignedTo?.fullName ?? "-"}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-400">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}

            {!loading && filteredTickets.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center text-sm text-slate-400" colSpan={8}>
                  No hay tickets para mostrar con esos filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </div>
      )}
    </section>
  );
};
