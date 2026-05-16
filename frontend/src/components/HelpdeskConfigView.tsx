import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Plus, Pencil, ChevronDown, ChevronUp, Trash2, Settings2, MapPin } from "lucide-react";
import { api } from "../lib/api";
import { getApiErrorMessage, notify } from "../lib/toast";

type TechUser = {
  id: number;
  fullName: string;
  email: string;
};

type LocationOption = {
  id: number;
  name: string;
  parentId: number | null;
};

type Assignment = {
  id: number;
  locationId: number | null;
  techUserId: number | null;
  location: { id: number; name: string } | null;
  techUser: { id: number; fullName: string } | null;
};

type SupportLevel = {
  id: number;
  levelOrder: number;
  levelName: string;
  escalationTarget: "TECH" | "PROVIDER";
  assignments: Assignment[];
};

type SupportTopic = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  levels: SupportLevel[];
};

type AssignmentForm = {
  locationId: string;
  techUserId: string;
};

type LevelForm = {
  levelOrder: string;
  levelName: string;
  escalationTarget: "TECH" | "PROVIDER";
  assignments: AssignmentForm[];
};

type TopicForm = {
  name: string;
  description: string;
  isActive: boolean;
  levels: LevelForm[];
};

const emptyAssignment = (): AssignmentForm => ({ locationId: "", techUserId: "" });

const emptyLevel = (order = 1): LevelForm => ({
  levelOrder: String(order),
  levelName: "",
  escalationTarget: "TECH",
  assignments: [emptyAssignment()],
});

const emptyTopic: TopicForm = {
  name: "",
  description: "",
  isActive: true,
  levels: [emptyLevel(1)],
};

export const HelpdeskConfigView = () => {
  const [topics, setTopics] = useState<SupportTopic[]>([]);
  const [techUsers, setTechUsers] = useState<TechUser[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<SupportTopic | null>(null);
  const [form, setForm] = useState<TopicForm>(emptyTopic);
  const [expandedLevelIndex, setExpandedLevelIndex] = useState<number>(0);

  const parentLocations = useMemo(() => locations.filter((l) => l.parentId === null), [locations]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [topicsRes, techRes, locRes] = await Promise.all([
        api.get<{ topics: SupportTopic[] }>("/helpdesk-config/topics"),
        api.get<{ users: TechUser[] }>("/helpdesk-config/tech-users"),
        api.get<{ locations: LocationOption[] }>("/helpdesk-config/locations"),
      ]);
      setTopics(topicsRes.data.topics);
      setTechUsers(techRes.data.users);
      setLocations(locRes.data.locations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData().catch(() => notify.error("Mesa de ayuda", "No fue posible cargar la configuración."));
  }, []);

  const openCreateModal = () => {
    setEditingTopic(null);
    setForm(emptyTopic);
    setExpandedLevelIndex(0);
    setIsModalOpen(true);
  };

  const openEditModal = (topic: SupportTopic) => {
    setEditingTopic(topic);
    setForm({
      name: topic.name,
      description: topic.description ?? "",
      isActive: topic.isActive,
      levels: topic.levels
        .slice()
        .sort((a, b) => a.levelOrder - b.levelOrder)
        .map((level) => ({
          levelOrder: String(level.levelOrder),
          levelName: level.levelName,
          escalationTarget: level.escalationTarget,
          assignments:
            level.escalationTarget === "TECH" && level.assignments.length > 0
              ? level.assignments.map((a) => ({
                  locationId: a.locationId ? String(a.locationId) : "",
                  techUserId: a.techUserId ? String(a.techUserId) : "",
                }))
              : [emptyAssignment()],
        })),
    });
    setExpandedLevelIndex(0);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTopic(null);
    setForm(emptyTopic);
    setExpandedLevelIndex(0);
  };

  const addLevel = () => {
    setForm((prev) => ({
      ...prev,
      levels: [...prev.levels, emptyLevel(prev.levels.length + 1)],
    }));
    setExpandedLevelIndex(form.levels.length);
  };

  const removeLevel = (index: number) => {
    setForm((prev) => {
      const next = prev.levels.filter((_, idx) => idx !== index);
      setExpandedLevelIndex((current) => {
        const len = next.length || 1;
        if (current === index) return Math.max(0, index - 1);
        if (current > index) return current - 1;
        return Math.min(current, len - 1);
      });
      return { ...prev, levels: next.length > 0 ? next : [emptyLevel(1)] };
    });
  };

  const updateLevel = (index: number, patch: Partial<LevelForm>) => {
    setForm((prev) => ({
      ...prev,
      levels: prev.levels.map((level, idx) => (idx === index ? { ...level, ...patch } : level)),
    }));
  };

  const addAssignment = (levelIdx: number) => {
    setForm((prev) => ({
      ...prev,
      levels: prev.levels.map((level, idx) =>
        idx === levelIdx ? { ...level, assignments: [...level.assignments, emptyAssignment()] } : level
      ),
    }));
  };

  const removeAssignment = (levelIdx: number, assignIdx: number) => {
    setForm((prev) => ({
      ...prev,
      levels: prev.levels.map((level, idx) => {
        if (idx !== levelIdx) return level;
        const next = level.assignments.filter((_, ai) => ai !== assignIdx);
        return { ...level, assignments: next.length > 0 ? next : [emptyAssignment()] };
      }),
    }));
  };

  const updateAssignment = (levelIdx: number, assignIdx: number, patch: Partial<AssignmentForm>) => {
    setForm((prev) => ({
      ...prev,
      levels: prev.levels.map((level, idx) => {
        if (idx !== levelIdx) return level;
        return {
          ...level,
          assignments: level.assignments.map((a, ai) => (ai === assignIdx ? { ...a, ...patch } : a)),
        };
      }),
    }));
  };

  const submit = async () => {
    if (!form.name.trim()) {
      notify.warning("Mesa de ayuda", "El tema de soporte es obligatorio.");
      return;
    }
    if (form.levels.length === 0) {
      notify.warning("Mesa de ayuda", "Debes capturar al menos un nivel.");
      return;
    }

    const parsedLevels = form.levels.map((level) => {
      const assignments =
        level.escalationTarget === "TECH"
          ? level.assignments.map((a) => ({
              locationId: a.locationId ? Number(a.locationId) : null,
              techUserId: a.techUserId ? Number(a.techUserId) : null,
            }))
          : [];

      return {
        levelOrder: Number(level.levelOrder),
        levelName: level.levelName.trim(),
        escalationTarget: level.escalationTarget,
        assignments,
      };
    });

    const hasInvalidLevel = parsedLevels.some((l) => !l.levelName || !Number.isInteger(l.levelOrder) || l.levelOrder < 1);
    if (hasInvalidLevel) {
      notify.warning("Mesa de ayuda", "Cada nivel necesita nombre y orden válido.");
      return;
    }

    const seenOrders = new Set<number>();
    for (const l of parsedLevels) {
      if (seenOrders.has(l.levelOrder)) {
        notify.warning("Mesa de ayuda", "No se permiten números de nivel repetidos.");
        return;
      }
      seenOrders.add(l.levelOrder);
    }

    for (const l of parsedLevels) {
      if (l.escalationTarget === "TECH") {
        if (l.assignments.length === 0) {
          notify.warning("Mesa de ayuda", `El nivel "${l.levelName}" necesita al menos una asignación.`);
          return;
        }
        for (const a of l.assignments) {
          if (!a.techUserId) {
            notify.warning("Mesa de ayuda", `Cada asignación TECH del nivel "${l.levelName}" necesita un usuario.`);
            return;
          }
        }
      }
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      isActive: form.isActive,
      levels: parsedLevels,
    };

    setSaving(true);
    try {
      if (editingTopic) {
        await api.put(`/helpdesk-config/topics/${editingTopic.id}`, payload);
      } else {
        await api.post("/helpdesk-config/topics", payload);
      }
      await loadData();
      closeModal();
      notify.success("Mesa de ayuda", editingTopic ? "Tema actualizado correctamente." : "Tema creado correctamente.");
    } catch (error) {
      notify.error("Mesa de ayuda", getApiErrorMessage(error, "No fue posible guardar el tema de soporte."));
    } finally {
      setSaving(false);
    }
  };

  const renderLevelSummary = (level: SupportLevel) => {
    if (level.escalationTarget === "PROVIDER") {
      return <span className="text-amber-600 dark:text-amber-400">Proveedor (general)</span>;
    }
    if (level.assignments.length === 0) {
      return <span className="text-slate-400">Sin asignaciones</span>;
    }
    return (
      <div className="space-y-0.5">
        {level.assignments.map((a, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            {a.location ? (
              <span className="inline-flex items-center gap-1 rounded bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 text-blue-700 dark:text-blue-400">
                <MapPin size={10} /> {a.location.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-500/10 px-1.5 py-0.5 text-slate-500 dark:text-slate-400">
                General
              </span>
            )}
            <span className="text-slate-600 dark:text-slate-300">{a.techUser?.fullName ?? "Sin usuario"}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración de Mesa de Ayuda</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Define temas de soporte con múltiples niveles y asignación por ubicación.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData().then(() => notify.success("Mesa de ayuda", "Configuración actualizada.")).catch(() => notify.error("Mesa de ayuda", "No fue posible refrescar configuración."))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-light dark:border-border-dark px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-lighter transition"
          >
            <RefreshCw size={14} /> Refrescar
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-dark transition"
          >
            <Plus size={14} /> Nuevo tema
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-card">
        <table className="min-w-full divide-y divide-border-light dark:divide-border-dark">
          <thead className="bg-slate-50/80 dark:bg-background-dark">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tema</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Descripción</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Niveles</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Estado</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark bg-white dark:bg-surface-dark">
            {loading ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-300" colSpan={5}>
                  Cargando temas de soporte...
                </td>
              </tr>
            ) : null}

            {!loading &&
              topics.map((topic) => (
                <tr key={topic.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-surface-lighter/40">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{topic.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{topic.description ?? "Sin descripción"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                    <div className="space-y-2">
                      {topic.levels
                        .slice()
                        .sort((a, b) => a.levelOrder - b.levelOrder)
                        .map((level) => (
                          <div key={level.id}>
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                              Nivel {level.levelOrder}: {level.levelName}
                            </p>
                            {renderLevelSummary(level)}
                          </div>
                        ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold ${
                        topic.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-500/10 dark:text-slate-400"
                      }`}
                    >
                      {topic.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEditModal(topic)}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition"
                    >
                      <Pencil size={13} /> Editar
                    </button>
                  </td>
                </tr>
              ))}

            {!loading && topics.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-300" colSpan={5}>
                  No hay temas de soporte configurados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-xl">
            <div className="overflow-y-auto p-5 sm:p-6 lg:p-7">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingTopic ? "Editar tema de soporte" : "Crear tema de soporte"}
              </h3>

              <div className="mt-4 grid gap-3 md:grid-cols-12">
                <label className="block text-xs text-slate-700 dark:text-slate-300 md:col-span-8">
                  Nombre del tema
                  <input
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej. Falla de internet"
                    className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="flex items-end gap-2 text-xs text-slate-700 dark:text-slate-300 md:col-span-4 md:justify-end md:pb-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Tema activo
                </label>
              </div>

              <label className="mt-3 block text-xs text-slate-700 dark:text-slate-300">
                Descripción
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>

              <div className="mt-4 rounded-lg border border-border-light dark:border-border-dark p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Niveles de atención</h4>
                  <button
                    type="button"
                    onClick={addLevel}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-light dark:border-border-dark px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-lighter transition"
                  >
                    <Plus size={13} /> Agregar nivel
                  </button>
                </div>

                <div className="space-y-3">
                  {form.levels.map((level, index) => (
                    <div key={`${index}-${level.levelOrder}`} className="rounded-md border border-border-light dark:border-border-dark">
                      <button
                        type="button"
                        onClick={() => setExpandedLevelIndex((c) => (c === index ? -1 : index))}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-surface-lighter/40"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Nivel {level.levelOrder || index + 1}</p>
                          <p className="truncate text-xs text-slate-600 dark:text-slate-400">
                            {level.levelName?.trim() || "Sin nombre"} — {level.escalationTarget === "PROVIDER" ? "Proveedor" : `${level.assignments.length} asignación(es)`}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {expandedLevelIndex === index ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </span>
                      </button>

                      {expandedLevelIndex === index ? (
                        <div className="border-t border-border-light dark:border-border-dark p-3 space-y-3">
                          {/* Level header fields */}
                          <div className="grid gap-3 md:grid-cols-12">
                            <label className="text-xs text-slate-700 dark:text-slate-300 md:col-span-1">
                              Nivel
                              <input
                                type="number"
                                min={1}
                                value={level.levelOrder}
                                onChange={(e) => updateLevel(index, { levelOrder: e.target.value })}
                                className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-2 py-2 text-sm"
                              />
                            </label>
                            <label className="text-xs text-slate-700 dark:text-slate-300 md:col-span-5">
                              Nombre del nivel
                              <input
                                value={level.levelName}
                                onChange={(e) => updateLevel(index, { levelName: e.target.value })}
                                placeholder="Ej. Soporte Interno"
                                className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-2 py-2 text-sm"
                              />
                            </label>
                            <label className="text-xs text-slate-700 dark:text-slate-300 md:col-span-3">
                              Destino
                              <select
                                value={level.escalationTarget}
                                onChange={(e) => updateLevel(index, {
                                  escalationTarget: e.target.value as "TECH" | "PROVIDER",
                                  assignments: e.target.value === "PROVIDER" ? [] : level.assignments.length > 0 ? level.assignments : [emptyAssignment()],
                                })}
                                className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-2 py-2 text-sm"
                              >
                                <option value="TECH">Usuario Tech</option>
                                <option value="PROVIDER">Proveedor</option>
                              </select>
                            </label>
                            <div className="flex items-end md:col-span-3">
                              <button
                                type="button"
                                onClick={() => removeLevel(index)}
                                className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30 transition"
                              >
                                <Trash2 size={13} /> Quitar nivel
                              </button>
                            </div>
                          </div>

                          {/* Assignments (only for TECH) */}
                          {level.escalationTarget === "TECH" && (
                            <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-background-dark/50">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                  Asignaciones por ubicación
                                  <span className="font-normal text-slate-400 ml-1">(dejar ubicación vacía = general)</span>
                                </p>
                                <button
                                  type="button"
                                  onClick={() => addAssignment(index)}
                                  className="inline-flex items-center gap-1 rounded border border-border-light dark:border-border-dark px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-surface-lighter transition"
                                >
                                  <Plus size={11} /> Agregar
                                </button>
                              </div>
                              <div className="space-y-2">
                                {level.assignments.map((assign, aIdx) => (
                                  <div key={aIdx} className="grid gap-2 grid-cols-[1fr_1fr_auto] items-end">
                                    <label className="text-[11px] text-slate-600 dark:text-slate-400">
                                      Ubicación
                                      <select
                                        value={assign.locationId}
                                        onChange={(e) => updateAssignment(index, aIdx, { locationId: e.target.value })}
                                        className="mt-0.5 w-full rounded border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-2 py-1.5 text-xs"
                                      >
                                        <option value="">General (todas)</option>
                                        {parentLocations.map((loc) => (
                                          <option key={loc.id} value={String(loc.id)}>{loc.name}</option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="text-[11px] text-slate-600 dark:text-slate-400">
                                      Usuario Tech
                                      <select
                                        value={assign.techUserId}
                                        onChange={(e) => updateAssignment(index, aIdx, { techUserId: e.target.value })}
                                        className="mt-0.5 w-full rounded border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-2 py-1.5 text-xs"
                                      >
                                        <option value="">Seleccionar...</option>
                                        {techUsers.map((u) => (
                                          <option key={u.id} value={String(u.id)}>{u.fullName}</option>
                                        ))}
                                      </select>
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => removeAssignment(index, aIdx)}
                                      className="rounded p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                                      title="Quitar asignación"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {level.escalationTarget === "PROVIDER" && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                              Este nivel se escala directamente a proveedor externo — aplica para todas las ubicaciones.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border-light dark:border-border-dark px-5 py-4 sm:px-6 lg:px-7">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-border-light dark:border-border-dark px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-lighter"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {saving ? "Guardando..." : editingTopic ? "Guardar cambios" : "Crear tema"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
