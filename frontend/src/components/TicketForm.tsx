import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Paperclip, Clock, Info, FileText, MessageSquare, UserCheck } from "lucide-react";
import { api } from "../lib/api";
import {
  Asset,
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketPriority,
  TicketStatus,
} from "../types";
import { getApiErrorMessage, notify } from "../lib/toast";

type TicketTopic = {
  id: number;
  name: string;
  description: string | null;
};

type Props = {
  ticketId?: number; // undefined = create mode
  assets: Asset[];
  topics: TicketTopic[];
  onBack: () => void;
  onSaved: () => void;
};

const statusLabel: Record<TicketStatus, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En proceso",
  PROVIDER: "Proveedor",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
};

const statusColor: Record<TicketStatus, string> = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  IN_PROGRESS:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  PROVIDER:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  CLOSED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  CANCELLED:
    "bg-slate-200 text-slate-600 dark:bg-slate-700/40 dark:text-slate-400",
};

const priorityLabel: Record<TicketPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Critica",
};

const priorityColor: Record<TicketPriority, string> = {
  LOW: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const eventActionLabel: Record<string, string> = {
  CREATED: "Ticket creado",
  STATUS_IN_PROGRESS: "Cambio a En proceso",
  STATUS_PROVIDER: "Enviado a Proveedor",
  STATUS_CLOSED: "Ticket cerrado",
  STATUS_CANCELLED: "Ticket cancelado",
  STATUS_REOPENED: "Ticket reabierto",
  AUTO_ESCALATED: "Escalacion automatica",
  REASSIGNED: "Reasignado",
  UPDATED: "Actualizado",
};

type FormFields = {
  title: string;
  description: string;
  priority: TicketPriority;
  assetId: string;
  supportTopicId: string;
};

const emptyForm: FormFields = {
  title: "",
  description: "",
  priority: "MEDIUM",
  assetId: "",
  supportTopicId: "",
};

export const TicketForm = ({
  ticketId,
  assets,
  topics,
  onBack,
  onSaved,
}: Props) => {
  const isCreate = !ticketId;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormFields>({
    ...emptyForm,
    assetId: assets[0] ? String(assets[0].id) : "",
    supportTopicId: topics[0] ? String(topics[0].id) : "",
  });

  // Comments
  const [commentBody, setCommentBody] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Attachments
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reassign
  const [users, setUsers] = useState<{ id: number; fullName: string }[]>([]);
  const [reassigning, setReassigning] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const loadTicket = async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const res = await api.get<{ ticket: Ticket }>(`/tickets/${ticketId}`);
      setTicket(res.data.ticket);
    } catch {
      notify.error("Ticket", "No se pudo cargar el ticket.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.comments?.length]);

  useEffect(() => {
    if (!isCreate) {
      api.get<{ users: { id: number; fullName: string }[] }>("/users")
        .then((res) => setUsers(res.data.users))
        .catch(() => {});
    }
  }, [isCreate]);

  const reassign = async (userId: number | null) => {
    if (!ticketId) return;
    setReassigning(true);
    try {
      await api.put(`/tickets/${ticketId}/reassign`, { assignedToId: userId });
      await loadTicket();
      setShowReassign(false);
      setSelectedUserId("");
      notify.success("Ticket", "Ticket reasignado correctamente.");
    } catch (error) {
      notify.error("Ticket", getApiErrorMessage(error, "No se pudo reasignar el ticket."));
    } finally {
      setReassigning(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.assetId) {
      notify.warning("Ticket", "Completa titulo, descripcion y activo.");
      return;
    }
    if (topics.length > 0 && !form.supportTopicId) {
      notify.warning("Ticket", "Selecciona un tema de soporte.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/tickets", {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        assetId: Number(form.assetId),
        supportTopicId: form.supportTopicId
          ? Number(form.supportTopicId)
          : null,
      });
      notify.success("Ticket", "Ticket creado correctamente.");
      onSaved();
    } catch (error) {
      notify.error(
        "Ticket",
        getApiErrorMessage(error, "No se pudo crear el ticket.")
      );
    } finally {
      setSaving(false);
    }
  };

  const runTransition = async (
    action: "IN_PROGRESS" | "PROVIDER" | "CLOSED" | "CANCELLED" | "REOPEN"
  ) => {
    if (!ticketId) return;
    try {
      await api.put(`/tickets/${ticketId}/transition`, { action });
      await loadTicket();
      notify.success("Ticket", "Estado actualizado.");
    } catch (error) {
      notify.error(
        "Ticket",
        getApiErrorMessage(error, "No se pudo cambiar estado.")
      );
    }
  };

  const sendComment = async () => {
    if (!ticketId || !commentBody.trim()) return;
    setSendingComment(true);
    try {
      await api.post(`/tickets/${ticketId}/comments`, {
        body: commentBody.trim(),
      });
      setCommentBody("");
      await loadTicket();
    } catch (error) {
      notify.error(
        "Ticket",
        getApiErrorMessage(error, "No se pudo enviar comentario.")
      );
    } finally {
      setSendingComment(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!ticketId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/tickets/${ticketId}/attachments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadTicket();
      notify.success("Ticket", "Archivo adjuntado.");
    } catch (error) {
      notify.error(
        "Ticket",
        getApiErrorMessage(error, "No se pudo subir el archivo.")
      );
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ── Create mode ──
  if (isCreate) {
    return (
      <section className="animate-fade-in space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition"
          >
            <ArrowLeft size={14} />
            Volver
          </button>
          <h2 className="text-xl font-bold text-on-surface">
            Nuevo Ticket
          </h2>
        </div>

        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-card"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-xs font-medium text-on-surface-variant md:col-span-2">
              Titulo
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                required
              />
            </label>

            <label className="block text-xs font-medium text-on-surface-variant">
              Activo
              <select
                value={form.assetId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, assetId: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                required
              >
                <option value="">Seleccionar activo...</option>
                {assets.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.assetCode} - {a.brand} {a.model}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-on-surface-variant">
              Prioridad
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    priority: e.target.value as TicketPriority,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Critica</option>
              </select>
            </label>

            <label className="block text-xs font-medium text-on-surface-variant md:col-span-2">
              Tema de soporte
              <select
                value={form.supportTopicId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, supportTopicId: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                required={topics.length > 0}
              >
                <option value="">Seleccionar...</option>
                {topics.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-on-surface-variant md:col-span-2">
              Descripcion
              <textarea
                rows={5}
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                required
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60 transition"
            >
              <Send size={14} />
              {saving ? "Creando..." : "Crear ticket"}
            </button>
          </div>
        </form>
      </section>
    );
  }

  // ── Detail mode ──
  if (loading) {
    return (
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest/90 p-8">
        <span className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Cargando ticket...
        </span>
      </section>
    );
  }

  if (!ticket) {
    return (
      <section className="space-y-4">
        <button
          onClick={onBack}
          className="rounded-md border border-outline-variant px-3 py-2 text-xs text-on-surface-variant"
        >
          ← Volver
        </button>
        <p className="text-sm text-slate-500">Ticket no encontrado.</p>
      </section>
    );
  }

  const comments = ticket.comments ?? [];
  const attachments = ticket.attachments ?? [];
  const events = ticket.events ?? [];

  const isActive =
    ticket.status !== "CLOSED" && ticket.status !== "CANCELLED";

  return (
    <section className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition"
          >
            <ArrowLeft size={14} />
            Volver
          </button>
          <h2 className="text-xl font-bold text-on-surface">
            Ticket #{ticket.id}
          </h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor[ticket.status]}`}
          >
            {statusLabel[ticket.status]}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityColor[ticket.priority]}`}
          >
            {priorityLabel[ticket.priority]}
          </span>
        </div>

        {/* Transition buttons */}
        <div className="flex flex-wrap gap-2">
          {ticket.status === "OPEN" && (
            <button
              type="button"
              onClick={() => runTransition("IN_PROGRESS")}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600"
            >
              En proceso
            </button>
          )}
          {ticket.status === "IN_PROGRESS" && (
            <button
              type="button"
              onClick={() => runTransition("PROVIDER")}
              className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
            >
              Enviar a proveedor
            </button>
          )}
          {isActive && (
            <>
              <button
                type="button"
                onClick={() => runTransition("CLOSED")}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => runTransition("CANCELLED")}
                className="rounded-md border border-outline-variant px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-container-high"
              >
                Cancelar
              </button>
            </>
          )}
          {ticket.status === "CLOSED" && (
            <button
              type="button"
              onClick={() => runTransition("REOPEN")}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Reabrir
            </button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Title + Description */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
            <h3 className="text-lg font-semibold text-on-surface">
              {ticket.title}
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface-variant">
              {ticket.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {ticket.supportTopic && (
                <span className="rounded bg-indigo-100 dark:bg-indigo-900/40 px-2 py-1 text-indigo-700 dark:text-indigo-300">
                  Tema: {ticket.supportTopic.name}
                </span>
              )}
              {ticket.asset && (
                <span className="rounded bg-surface-container-high px-2 py-1 text-on-surface-variant">
                  Activo: {ticket.asset.assetCode} - {ticket.asset.brand}{" "}
                  {ticket.asset.model}
                </span>
              )}
              {ticket.assignedTo && (
                <span className="rounded bg-surface-container-high px-2 py-1 text-on-surface-variant">
                  Asignado: {ticket.assignedTo.fullName}
                </span>
              )}
              <span className="rounded bg-surface-container-high px-2 py-1 text-on-surface-variant">
                Creado: {new Date(ticket.createdAt).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Attachments */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                <Paperclip size={15} className="text-primary" />
                Adjuntos ({attachments.length})
              </h4>
              {isActive && (
                <>
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                  >
                    {uploading ? "Subiendo..." : "Adjuntar archivo"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </>
              )}
            </div>

            {attachments.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {attachments.map((att: TicketAttachment) => (
                  <a
                    key={att.id}
                    href={`/api/tickets/attachments/${att.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-lg border border-outline-variant p-3 hover:bg-surface-container-high transition"
                  >
                    {att.mimeType.startsWith("image/") ? (
                      <img
                        src={`/api/tickets/attachments/${att.id}/download`}
                        alt={att.originalName}
                        className="mb-2 h-28 w-full rounded object-cover"
                      />
                    ) : (
                      <div className="mb-2 flex h-28 items-center justify-center rounded bg-surface-container-low text-slate-400">
                        PDF
                      </div>
                    )}
                    <p className="truncate text-xs font-medium text-on-surface-variant group-hover:text-primary">
                      {att.originalName}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {formatBytes(att.sizeBytes)} &middot;{" "}
                      {att.uploadedBy?.fullName ?? "Sistema"} &middot;{" "}
                      {new Date(att.createdAt).toLocaleDateString()}
                    </p>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-on-surface-variant">
                Sin archivos adjuntos.
              </p>
            )}
          </div>

          {/* Comments / Conversation */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <MessageSquare size={15} className="text-primary" />
              Conversacion ({comments.length})
            </h4>

            <div className="mt-3 max-h-96 space-y-3 overflow-y-auto pr-1">
              {comments.map((c: TicketComment) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-outline-variant bg-surface-container-low p-3"
                >
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span className="font-medium text-on-surface-variant">
                      {c.author?.fullName ?? "Sistema"}
                    </span>
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-on-surface-variant">
                    {c.body}
                  </p>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-xs text-on-surface-variant">
                  Sin comentarios aun. Las conversaciones futuras via WhatsApp
                  con IA apareceran aqui.
                </p>
              )}
              <div ref={commentsEndRef} />
            </div>

            {isActive && (
              <div className="mt-3 flex gap-2">
                <input
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendComment();
                    }
                  }}
                  placeholder="Escribe un comentario..."
                  className="flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  disabled={sendingComment || !commentBody.trim()}
                  onClick={sendComment}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60 transition"
                >
                  <Send size={14} />
                  {sendingComment ? "..." : "Enviar"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar - Timeline */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <Clock size={15} className="text-primary" />
              Linea de tiempo
            </h4>
            <ol className="mt-3 space-y-3 border-l-2 border-slate-200 dark:border-slate-700 pl-4">
              {events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white dark:ring-surface-dark" />
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    {eventActionLabel[event.action] ?? event.action}
                  </p>
                  <p className="text-[11px] text-on-surface-variant">
                    {event.actor?.fullName ?? "Sistema"} &middot;{" "}
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
              {events.length === 0 && (
                <li className="text-xs text-slate-500">Sin eventos.</li>
              )}
            </ol>
          </div>

          {/* Quick info */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 shadow-card space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <Info size={15} className="text-primary" />
              Informacion
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Estado</span>
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${statusColor[ticket.status]}`}
                >
                  {statusLabel[ticket.status]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Prioridad</span>
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${priorityColor[ticket.priority]}`}
                >
                  {priorityLabel[ticket.priority]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tema</span>
                <span className="text-on-surface-variant">
                  {ticket.supportTopic?.name ?? "Sin tema"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Activo</span>
                <span className="text-on-surface-variant">
                  {ticket.asset?.assetCode ?? "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Asignado</span>
                <span className="text-on-surface-variant">
                  {ticket.assignedTo?.fullName ?? "Sin asignar"}
                </span>
              </div>
              {isActive && (
                <div className="pt-1">
                  {!showReassign ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserId(ticket.assignedTo ? String(ticket.assignedTo.id) : "");
                        setShowReassign(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <UserCheck size={12} />
                      Reasignar
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      >
                        <option value="">Sin asignar</option>
                        {users.map((u) => (
                          <option key={u.id} value={String(u.id)}>
                            {u.fullName}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={reassigning}
                          onClick={() => reassign(selectedUserId ? Number(selectedUserId) : null)}
                          className="flex-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                        >
                          {reassigning ? "..." : "Guardar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowReassign(false)}
                          className="flex-1 rounded-md border border-outline-variant px-2 py-1 text-[11px] text-on-surface-variant hover:bg-surface-container-high"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Creado</span>
                <span className="text-on-surface-variant">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
