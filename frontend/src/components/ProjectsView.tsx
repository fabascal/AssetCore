import { useEffect, useMemo, useState, useRef } from "react";
import {
  Plus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  FolderKanban,
  Flag,
  AlertCircle,
  Pencil,
  Trash2,
  ArrowLeft,
  ListTodo,
  User,
  Link2,
} from "lucide-react";
import { api } from "../lib/api";
import { notify } from "../lib/toast";
import type {
  Project,
  ProjectTask,
  ProjectStatus,
  GanttTaskStatus,
  DependencyType,
} from "../types";

/* ── Label helpers ──────────────────────────────── */

const projectStatusLabel: Record<ProjectStatus, string> = {
  PLANNING: "Planificación",
  IN_PROGRESS: "En Progreso",
  COMPLETED: "Completado",
  ON_HOLD: "En Pausa",
  CANCELLED: "Cancelado",
};

const projectStatusColor: Record<ProjectStatus, string> = {
  PLANNING: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  ON_HOLD: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  CANCELLED: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};

const taskStatusLabel: Record<GanttTaskStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En Curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const taskStatusDot: Record<GanttTaskStatus, string> = {
  PENDING: "bg-slate-400",
  IN_PROGRESS: "bg-amber-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-red-400",
};

const taskBarColor = (task: ProjectTask) => {
  if (task.isCritical) return "bg-red-500 border-red-400 shadow-red-500/30";
  if (task.status === "COMPLETED") return "bg-emerald-500 border-emerald-400 shadow-emerald-500/20";
  if (task.status === "IN_PROGRESS") return "bg-amber-500 border-amber-400 shadow-amber-500/20";
  if (task.status === "CANCELLED") return "bg-slate-500 border-slate-400 shadow-slate-500/10";
  return "bg-blue-500 border-blue-400 shadow-blue-500/20";
};

const daysBetween = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

const dependencyTypeLabel: Record<DependencyType, string> = {
  FINISH_TO_START: "Fin → Inicio",
  START_TO_START: "Inicio → Inicio",
  FINISH_TO_FINISH: "Fin → Fin",
  START_TO_FINISH: "Inicio → Fin",
};

/* ── Component ──────────────────────────────────── */

export const ProjectsView = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [showDepForm, setShowDepForm] = useState(false);

  /* ── Data fetching ──────────────────────────────── */

  const loadProjects = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ projects: Project[] }>("/projects");
      setProjects(data.projects);
    } catch {
      notify.error("Proyectos", "No se pudieron cargar los proyectos.");
    } finally {
      setLoading(false);
    }
  };

  const loadProjectDetail = async (id: number) => {
    try {
      const { data } = await api.get<{ project: Project }>(`/projects/${id}`);
      setActiveProject(data.project);
    } catch {
      notify.error("Proyectos", "No se pudo cargar el detalle del proyecto.");
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  /* ── Project CRUD ───────────────────────────────── */

  const saveProject = async (payload: {
    name: string;
    description?: string;
    status: ProjectStatus;
    startDate?: string;
    endDate?: string;
  }) => {
    try {
      if (editingProject) {
        await api.put(`/projects/${editingProject.id}`, payload);
        notify.success("Proyectos", "Proyecto actualizado.");
      } else {
        await api.post("/projects", payload);
        notify.success("Proyectos", "Proyecto creado.");
      }
      setShowProjectForm(false);
      setEditingProject(null);
      await loadProjects();
      if (activeProject) await loadProjectDetail(activeProject.id);
    } catch {
      notify.error("Proyectos", "No se pudo guardar el proyecto.");
    }
  };

  const deleteProject = async (id: number) => {
    if (!confirm("¿Eliminar este proyecto y todas sus tareas?")) return;
    try {
      await api.delete(`/projects/${id}`);
      notify.success("Proyectos", "Proyecto eliminado.");
      if (activeProject?.id === id) setActiveProject(null);
      await loadProjects();
    } catch {
      notify.error("Proyectos", "No se pudo eliminar el proyecto.");
    }
  };

  /* ── Task CRUD ──────────────────────────────────── */

  const saveTask = async (payload: {
    name: string;
    description?: string;
    status: GanttTaskStatus;
    startDate?: string;
    endDate?: string;
    progress: number;
    isCritical: boolean;
    isMilestone: boolean;
    sortOrder: number;
    parentTaskId?: number | null;
    assignedToId?: number | null;
    assetId?: number | null;
  }) => {
    if (!activeProject) return;
    try {
      if (editingTask) {
        await api.put(`/projects/${activeProject.id}/tasks/${editingTask.id}`, payload);
        notify.success("Tareas", "Tarea actualizada.");
      } else {
        await api.post(`/projects/${activeProject.id}/tasks`, payload);
        notify.success("Tareas", "Tarea creada.");
      }
      setShowTaskForm(false);
      setEditingTask(null);
      await loadProjectDetail(activeProject.id);
    } catch {
      notify.error("Tareas", "No se pudo guardar la tarea.");
    }
  };

  const deleteTask = async (taskId: number) => {
    if (!activeProject) return;
    if (!confirm("¿Eliminar esta tarea?")) return;
    try {
      await api.delete(`/projects/${activeProject.id}/tasks/${taskId}`);
      notify.success("Tareas", "Tarea eliminada.");
      await loadProjectDetail(activeProject.id);
    } catch {
      notify.error("Tareas", "No se pudo eliminar la tarea.");
    }
  };

  /* ── Dependency CRUD ────────────────────────────── */

  const addDependency = async (predecessorId: number, successorId: number, type: DependencyType) => {
    if (!activeProject) return;
    try {
      await api.post(`/projects/${activeProject.id}/dependencies`, { predecessorId, successorId, type });
      notify.success("Dependencias", "Dependencia creada.");
      await loadProjectDetail(activeProject.id);
    } catch {
      notify.error("Dependencias", "No se pudo crear la dependencia.");
    }
  };

  const removeDependency = async (depId: number) => {
    if (!activeProject) return;
    try {
      await api.delete(`/projects/${activeProject.id}/dependencies/${depId}`);
      notify.success("Dependencias", "Dependencia eliminada.");
      await loadProjectDetail(activeProject.id);
    } catch {
      notify.error("Dependencias", "No se pudo eliminar la dependencia.");
    }
  };

  /* ── Task tree helpers ──────────────────────────── */

  const tasks = activeProject?.tasks ?? [];

  const rootTasks = useMemo(() => {
    const groups = tasks.filter((t) => t.parentTaskId === null);
    return groups.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  }, [tasks]);

  const childrenOf = (parentId: number) =>
    tasks
      .filter((t) => t.parentTaskId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  const flatTasks = useMemo(() => {
    const result: { task: ProjectTask; depth: number }[] = [];
    const walk = (parentId: number | null, depth: number) => {
      const items = parentId === null ? rootTasks : childrenOf(parentId);
      for (const t of items) {
        if (showCriticalOnly && !t.isCritical && t.parentTaskId === null) continue;
        result.push({ task: t, depth });
        if (t.parentTaskId === null && expandedGroups.has(t.id)) {
          walk(t.id, depth + 1);
        }
      }
    };
    walk(null, 0);
    return result;
  }, [rootTasks, tasks, expandedGroups, showCriticalOnly]);

  /* ── Gantt timeline computation ────────────────── */

  const { timelineStart, timelineDays, dayWidth } = useMemo(() => {
    const datesWithTasks = tasks.filter((t) => t.startDate && t.endDate);
    if (datesWithTasks.length === 0) {
      const now = new Date();
      return { timelineStart: now, timelineDays: 14, dayWidth: 48 };
    }
    const starts = datesWithTasks.map((t) => new Date(t.startDate!).getTime());
    const ends = datesWithTasks.map((t) => new Date(t.endDate!).getTime());
    const min = new Date(Math.min(...starts));
    const max = new Date(Math.max(...ends));
    min.setDate(min.getDate() - 1);
    max.setDate(max.getDate() + 2);
    const days = Math.max(daysBetween(min, max), 7);
    return { timelineStart: min, timelineDays: days, dayWidth: 48 };
  }, [tasks]);

  const timelineDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < timelineDays; i++) {
      const d = new Date(timelineStart);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [timelineStart, timelineDays]);

  const todayOffset = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const off = daysBetween(timelineStart, now);
    if (off < 0 || off > timelineDays) return null;
    return off * dayWidth;
  }, [timelineStart, timelineDays, dayWidth]);

  const getBarStyle = (task: ProjectTask) => {
    if (!task.startDate || !task.endDate) return null;
    const start = new Date(task.startDate);
    const end = new Date(task.endDate);
    const left = daysBetween(timelineStart, start) * dayWidth;
    const width = Math.max(daysBetween(start, end) + 1, 1) * dayWidth;
    return { left, width };
  };

  const ganttScrollRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);

  const syncScroll = (source: "gantt" | "list") => {
    const gantt = ganttScrollRef.current;
    const list = taskListRef.current;
    if (!gantt || !list) return;
    if (source === "gantt") list.scrollTop = gantt.scrollTop;
    else gantt.scrollTop = list.scrollTop;
  };

  const toggleGroup = (id: number) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const dayLabels = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];

  /* ═══════════════ RENDER ═══════════════ */

  /* ── Project List ──────────────────────── */
  if (!activeProject) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <FolderKanban className="text-primary" size={26} />
              Proyectos
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {projects.length} proyecto{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadProjects}
              className="inline-flex items-center gap-2 rounded-xl border border-border-light dark:border-border-dark px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-lighter transition"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
            <button
              onClick={() => {
                setEditingProject(null);
                setShowProjectForm(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-dark transition"
            >
              <Plus size={15} />
              Nuevo Proyecto
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-6 text-sm text-slate-500 shadow-card">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Cargando proyectos...
          </div>
        )}

        {/* Table */}
        {!loading && projects.length === 0 && (
          <div className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-12 text-center shadow-card">
            <FolderKanban className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={48} />
            <p className="text-slate-500 dark:text-slate-400">No hay proyectos aún. Crea el primero.</p>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-light dark:border-border-dark bg-slate-50 dark:bg-surface-lighter text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Nombre</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3 hidden sm:table-cell">Inicio</th>
                  <th className="px-5 py-3 hidden sm:table-cell">Fin</th>
                  <th className="px-5 py-3 text-center">Tareas</th>
                  <th className="px-5 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => loadProjectDetail(p.id)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-surface-lighter transition"
                  >
                    <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">{p.name}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-medium ${projectStatusColor[p.status]}`}>
                        {projectStatusLabel[p.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell text-slate-500 dark:text-slate-400">
                      {formatDate(p.startDate)}
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell text-slate-500 dark:text-slate-400">
                      {formatDate(p.endDate)}
                    </td>
                    <td className="px-5 py-3.5 text-center text-slate-500 dark:text-slate-400">
                      {p._count?.tasks ?? 0}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProject(p);
                            setShowProjectForm(true);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary dark:hover:bg-surface-lighter transition"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(p.id);
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Project Form Modal */}
        {showProjectForm && (
          <ProjectFormModal
            project={editingProject}
            onSave={saveProject}
            onClose={() => {
              setShowProjectForm(false);
              setEditingProject(null);
            }}
          />
        )}
      </div>
    );
  }

  /* ── Gantt View ────────────────────────── */
  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col gap-0 animate-fade-in -m-4 sm:-m-6 lg:-m-8">
      {/* Top bar */}
      <div className="flex-none flex items-center justify-between border-b border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveProject(null);
              loadProjects();
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-lighter hover:text-primary transition"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              {activeProject.name}
              <span className={`inline-block rounded-lg px-2 py-0.5 text-[10px] font-medium ${projectStatusColor[activeProject.status]}`}>
                {projectStatusLabel[activeProject.status]}
              </span>
            </h2>
            {activeProject.description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{activeProject.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Critical path toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-500 transition select-none">
            <input
              type="checkbox"
              checked={showCriticalOnly}
              onChange={(e) => setShowCriticalOnly(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative w-8 h-[18px] bg-slate-200 dark:bg-slate-700 rounded-full peer-checked:bg-red-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[14px] after:w-[14px] after:transition-all peer-checked:after:translate-x-[14px]" />
            <span className="hidden sm:inline">Ruta Crítica</span>
          </label>

          <div className="h-5 w-px bg-border-light dark:bg-border-dark mx-1 hidden sm:block" />

          <button
            onClick={() => setShowDepForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-light dark:border-border-dark px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-lighter transition"
          >
            <Link2 size={13} />
            <span className="hidden sm:inline">Dependencia</span>
          </button>

          <button
            onClick={() => {
              setEditingTask(null);
              setShowTaskForm(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-dark transition"
          >
            <Plus size={13} />
            Nueva Tarea
          </button>
        </div>
      </div>

      {/* Main split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Task list */}
        <div className="w-[360px] flex-none flex flex-col border-r border-border-light dark:border-border-dark bg-white dark:bg-surface-dark">
          {/* Column headers */}
          <div className="flex-none h-10 border-b border-border-light dark:border-border-dark flex items-center px-4 bg-slate-50 dark:bg-surface-lighter text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <div className="flex-1 pl-5">Tarea</div>
            <div className="w-16 text-center">Estado</div>
            <div className="w-12 text-right pr-1">Días</div>
            <div className="w-14 text-right">Acc.</div>
          </div>
          {/* Task rows */}
          <div
            ref={taskListRef}
            onScroll={() => syncScroll("list")}
            className="flex-1 overflow-y-auto"
          >
            {flatTasks.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-400">
                <ListTodo className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={32} />
                Sin tareas aún
              </div>
            )}
            {flatTasks.map(({ task, depth }) => {
              const isGroup = task.parentTaskId === null && childrenOf(task.id).length > 0;
              const isExpanded = expandedGroups.has(task.id);
              const dur =
                task.startDate && task.endDate
                  ? daysBetween(new Date(task.startDate), new Date(task.endDate)) + 1
                  : null;

              return (
                <div
                  key={task.id}
                  className={`flex items-center h-10 px-4 border-b border-slate-100 dark:border-border-dark/50 text-xs hover:bg-slate-50 dark:hover:bg-surface-lighter/50 transition ${
                    depth === 0 && isGroup ? "font-medium" : ""
                  }`}
                  style={{ paddingLeft: `${depth * 16 + 16}px` }}
                >
                  {/* Expand/collapse or dot */}
                  <div className="w-5 flex-none flex items-center justify-center">
                    {isGroup ? (
                      <button onClick={() => toggleGroup(task.id)} className="text-slate-400 hover:text-primary">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    ) : task.isMilestone ? (
                      <Flag size={11} className="text-primary" />
                    ) : (
                      <div className={`w-2 h-2 rounded-full ${taskStatusDot[task.status]}`} />
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 truncate ml-1 text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <span className="truncate">{task.name}</span>
                    {task.isCritical && <AlertCircle size={10} className="text-red-500 flex-none" />}
                  </div>

                  {/* Status */}
                  <div className="w-16 text-center">
                    <div className={`w-2 h-2 rounded-full inline-block ${taskStatusDot[task.status]}`} title={taskStatusLabel[task.status]} />
                  </div>

                  {/* Duration */}
                  <div className="w-12 text-right text-slate-400 pr-1">
                    {dur ? `${dur}d` : "—"}
                  </div>

                  {/* Actions */}
                  <div className="w-14 flex items-center justify-end gap-0.5">
                    <button
                      onClick={() => {
                        setEditingTask(task);
                        setShowTaskForm(true);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-surface-lighter transition"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer stats */}
          <div className="flex-none border-t border-border-light dark:border-border-dark px-4 py-2 text-[10px] text-slate-500 dark:text-slate-400 flex justify-between">
            <span>Total: {tasks.length} tareas</span>
            <span className="text-red-500 font-medium">
              Críticas: {tasks.filter((t) => t.isCritical).length}
            </span>
          </div>
        </div>

        {/* Right: Gantt chart */}
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-background-dark overflow-hidden">
          {/* Timeline header */}
          <div className="flex-none h-10 bg-slate-50 dark:bg-surface-lighter border-b border-border-light dark:border-border-dark overflow-hidden">
            <div
              className="flex h-full"
              style={{ width: `${timelineDays * dayWidth}px` }}
            >
              {timelineDates.map((d, i) => {
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isToday =
                  d.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={i}
                    className={`flex-none flex flex-col items-center justify-center text-[9px] border-r border-border-light dark:border-border-dark ${
                      isToday
                        ? "bg-primary/10 text-primary font-bold"
                        : isWeekend
                        ? "bg-slate-100 dark:bg-surface-dark/50 text-slate-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                    style={{ width: `${dayWidth}px` }}
                  >
                    <span className="font-bold leading-none">{dayLabels[d.getDay()]}</span>
                    <span className="leading-none mt-0.5">
                      {d.getDate().toString().padStart(2, "0")}{" "}
                      {d.toLocaleDateString("es-MX", { month: "short" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gantt bars body */}
          <div
            ref={ganttScrollRef}
            onScroll={() => syncScroll("gantt")}
            className="flex-1 overflow-auto relative"
          >
            {/* Grid background */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(to right, transparent, transparent ${dayWidth - 1}px, var(--tw-border-opacity, rgba(0,0,0,0.06)) ${dayWidth - 1}px, var(--tw-border-opacity, rgba(0,0,0,0.06)) ${dayWidth}px)`,
                width: `${timelineDays * dayWidth}px`,
              }}
            />

            {/* Today marker */}
            {todayOffset !== null && (
              <div
                className="absolute top-0 bottom-0 w-px bg-primary/60 z-10"
                style={{ left: `${todayOffset + dayWidth / 2}px` }}
              >
                <div className="bg-primary text-white text-[8px] px-1.5 py-0.5 rounded-b -translate-x-1/2 font-bold">
                  HOY
                </div>
              </div>
            )}

            {/* Rows */}
            <div style={{ width: `${timelineDays * dayWidth}px`, minHeight: "100%" }}>
              {flatTasks.map(({ task }) => {
                const bar = getBarStyle(task);
                return (
                  <div
                    key={task.id}
                    className="h-10 relative border-b border-slate-100 dark:border-border-dark/30"
                  >
                    {bar && !task.isMilestone && (
                      <div
                        className={`absolute top-2 h-6 rounded border shadow-lg flex items-center px-2 cursor-default group ${taskBarColor(task)}`}
                        style={{
                          left: `${bar.left}px`,
                          width: `${bar.width}px`,
                        }}
                      >
                        {/* Progress fill */}
                        {task.progress > 0 && task.progress < 100 && (
                          <div
                            className="absolute left-0 top-0 bottom-0 rounded-l bg-white/20"
                            style={{ width: `${task.progress}%` }}
                          />
                        )}
                        <span className="relative text-[10px] text-white font-medium truncate w-full">
                          {task.name}
                        </span>

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-surface-dark border border-border-dark rounded-xl shadow-xl p-3 hidden group-hover:block z-50 text-[11px]">
                          <div className="font-semibold text-white mb-1">{task.name}</div>
                          <div className="text-slate-400">Estado: {taskStatusLabel[task.status]}</div>
                          <div className="text-slate-400">Progreso: {task.progress}%</div>
                          {task.assignedTo && (
                            <div className="text-slate-400 flex items-center gap-1 mt-0.5">
                              <User size={9} /> {task.assignedTo.fullName}
                            </div>
                          )}
                          {task.asset && (
                            <div className="text-primary mt-0.5">{task.asset.assetCode} — {task.asset.brand} {task.asset.model}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Milestone diamond */}
                    {task.isMilestone && bar && (
                      <div
                        className="absolute top-2.5 w-5 h-5 bg-primary rotate-45 border-2 border-white dark:border-surface-dark shadow-lg z-10"
                        style={{ left: `${bar.left + bar.width / 2 - 10}px` }}
                      >
                        <Flag size={8} className="text-white -rotate-45 mx-auto mt-0.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showProjectForm && (
        <ProjectFormModal
          project={editingProject}
          onSave={saveProject}
          onClose={() => {
            setShowProjectForm(false);
            setEditingProject(null);
          }}
        />
      )}

      {showTaskForm && (
        <TaskFormModal
          task={editingTask}
          parentTasks={rootTasks}
          onSave={saveTask}
          onClose={() => {
            setShowTaskForm(false);
            setEditingTask(null);
          }}
        />
      )}

      {showDepForm && (
        <DependencyFormModal
          tasks={tasks}
          onSave={addDependency}
          onRemove={removeDependency}
          onClose={() => setShowDepForm(false)}
        />
      )}
    </div>
  );
};

/* ═══════════════ SUB-COMPONENTS / MODALS ═══════════════ */

/* ── Project Form Modal ──────────────────────────── */

const ProjectFormModal = ({
  project,
  onSave,
  onClose,
}: {
  project: Project | null;
  onSave: (p: { name: string; description?: string; status: ProjectStatus; startDate?: string; endDate?: string }) => Promise<void>;
  onClose: () => void;
}) => {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "PLANNING");
  const [startDate, setStartDate] = useState(project?.startDate?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(project?.endDate?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name,
      description: description || undefined,
      status,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-6 shadow-xl animate-scale-in"
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {project ? "Editar Proyecto" : "Nuevo Proyecto"}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nombre *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            >
              {(Object.keys(projectStatusLabel) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>{projectStatusLabel[s]}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fecha inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fecha fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border-light dark:border-border-dark px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-lighter transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60 transition"
          >
            {saving ? "Guardando..." : project ? "Guardar cambios" : "Crear proyecto"}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ── Task Form Modal ─────────────────────────────── */

const TaskFormModal = ({
  task,
  parentTasks,
  onSave,
  onClose,
}: {
  task: ProjectTask | null;
  parentTasks: ProjectTask[];
  onSave: (p: {
    name: string;
    description?: string;
    status: GanttTaskStatus;
    startDate?: string;
    endDate?: string;
    progress: number;
    isCritical: boolean;
    isMilestone: boolean;
    sortOrder: number;
    parentTaskId?: number | null;
    assignedToId?: number | null;
    assetId?: number | null;
  }) => Promise<void>;
  onClose: () => void;
}) => {
  const [name, setName] = useState(task?.name ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<GanttTaskStatus>(task?.status ?? "PENDING");
  const [startDate, setStartDate] = useState(task?.startDate?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(task?.endDate?.slice(0, 10) ?? "");
  const [progress, setProgress] = useState(task?.progress ?? 0);
  const [isCritical, setIsCritical] = useState(task?.isCritical ?? false);
  const [isMilestone, setIsMilestone] = useState(task?.isMilestone ?? false);
  const [sortOrder, setSortOrder] = useState(task?.sortOrder ?? 0);
  const [parentTaskId, setParentTaskId] = useState<number | "">(task?.parentTaskId ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name,
      description: description || undefined,
      status,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      progress,
      isCritical,
      isMilestone,
      sortOrder,
      parentTaskId: parentTaskId === "" ? null : parentTaskId,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-6 shadow-xl animate-scale-in"
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {task ? "Editar Tarea" : "Nueva Tarea"}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nombre *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as GanttTaskStatus)}
                className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              >
                {(Object.keys(taskStatusLabel) as GanttTaskStatus[]).map((s) => (
                  <option key={s} value={s}>{taskStatusLabel[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Grupo padre</label>
              <select
                value={parentTaskId}
                onChange={(e) => setParentTaskId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              >
                <option value="">— Raíz (grupo) —</option>
                {parentTasks
                  .filter((p) => p.id !== task?.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fecha inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fecha fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Progreso: {progress}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Orden</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer self-end pb-2.5">
              <input
                type="checkbox"
                checked={isCritical}
                onChange={(e) => setIsCritical(e.target.checked)}
                className="rounded border-slate-300 text-red-500 focus:ring-red-500/30"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">Ruta Crítica</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer self-end pb-2.5">
              <input
                type="checkbox"
                checked={isMilestone}
                onChange={(e) => setIsMilestone(e.target.checked)}
                className="rounded border-slate-300 text-primary focus:ring-primary/30"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">Hito</span>
            </label>
          </div>
        </div>

        <div className="mt-5 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border-light dark:border-border-dark px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-lighter transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60 transition"
          >
            {saving ? "Guardando..." : task ? "Guardar cambios" : "Crear tarea"}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ── Dependency Form Modal ───────────────────────── */

const DependencyFormModal = ({
  tasks,
  onSave,
  onRemove,
  onClose,
}: {
  tasks: ProjectTask[];
  onSave: (predecessorId: number, successorId: number, type: DependencyType) => Promise<void>;
  onRemove: (depId: number) => Promise<void>;
  onClose: () => void;
}) => {
  const [predecessorId, setPredecessorId] = useState<number | "">("");
  const [successorId, setSuccessorId] = useState<number | "">("");
  const [type, setType] = useState<DependencyType>("FINISH_TO_START");
  const [saving, setSaving] = useState(false);

  const existing = tasks.flatMap((t) =>
    t.dependenciesAsPredecessor.map((d) => ({
      ...d,
      predecessorName: t.name,
      successorName: tasks.find((x) => x.id === d.successorId)?.name ?? `#${d.successorId}`,
    }))
  );

  const handleAdd = async () => {
    if (predecessorId === "" || successorId === "") return;
    setSaving(true);
    await onSave(predecessorId, successorId, type);
    setPredecessorId("");
    setSuccessorId("");
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-6 shadow-xl animate-scale-in">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Link2 size={18} className="text-primary" />
          Dependencias
        </h3>

        {/* Existing */}
        {existing.length > 0 && (
          <div className="mb-4 space-y-1">
            {existing.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center justify-between rounded-lg border border-border-light dark:border-border-dark px-3 py-2 text-xs"
              >
                <span className="text-slate-700 dark:text-slate-300">
                  {dep.predecessorName} → {dep.successorName}{" "}
                  <span className="text-slate-400">({dependencyTypeLabel[dep.type]})</span>
                </span>
                <button
                  onClick={() => onRemove(dep.id)}
                  className="text-red-400 hover:text-red-600 p-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Predecesora</label>
              <select
                value={predecessorId}
                onChange={(e) => setPredecessorId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              >
                <option value="">Seleccionar…</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Sucesora</label>
              <select
                value={successorId}
                onChange={(e) => setSuccessorId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              >
                <option value="">Seleccionar…</option>
                {tasks.filter((t) => t.id !== predecessorId).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DependencyType)}
              className="w-full rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            >
              {(Object.keys(dependencyTypeLabel) as DependencyType[]).map((dt) => (
                <option key={dt} value={dt}>{dependencyTypeLabel[dt]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border-light dark:border-border-dark px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-lighter transition"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || predecessorId === "" || successorId === ""}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60 transition"
          >
            {saving ? "Guardando..." : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
};
