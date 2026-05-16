import { useEffect, useMemo, useState } from "react";
import { Search, Filter, RefreshCw, UserPlus, ShieldPlus, Pencil, Trash2, Eye, Menu as MenuIcon, X } from "lucide-react";
import { api } from "../lib/api";
import { getApiErrorMessage, notify } from "../lib/toast";

type RoleItem = {
  id: number;
  name: string;
  description: string | null;
};

type RoleMenuItem = {
  id: number;
  label: string;
  path: string;
  parentId: number | null;
  displayOrder: number;
};

type RoleFormState = {
  name: string;
  description: string;
};

type UserSummary = {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  role: {
    id: number;
    name: string;
  };
};

type UserDetail = UserSummary & {
  updatedAt: string;
};

type UserFormState = {
  fullName: string;
  email: string;
  roleId: string;
  isActive: boolean;
  password: string;
};

const emptyForm: UserFormState = {
  fullName: "",
  email: "",
  roleId: "",
  isActive: true,
  password: "",
};

const emptyRoleForm: RoleFormState = {
  name: "",
  description: "",
};

type UsersManagementProps = {
  section?: "users" | "roles";
};

export const UsersManagement = ({ section = "users" }: UsersManagementProps) => {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [roleFilter, setRoleFilter] = useState<"ALL" | string>("ALL");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [formState, setFormState] = useState<UserFormState>(emptyForm);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [roleFormState, setRoleFormState] = useState<RoleFormState>(emptyRoleForm);
  const [savingRole, setSavingRole] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);
  const [isRoleMenusModalOpen, setIsRoleMenusModalOpen] = useState(false);
  const [roleMenusLoading, setRoleMenusLoading] = useState(false);
  const [savingRoleMenus, setSavingRoleMenus] = useState(false);
  const [editingRoleMenusFor, setEditingRoleMenusFor] = useState<RoleItem | null>(null);
  const [roleMenusCatalog, setRoleMenusCatalog] = useState<RoleMenuItem[]>([]);
  const [selectedRoleMenuIds, setSelectedRoleMenuIds] = useState<number[]>([]);

  const loadUsersAndRoles = async () => {
    setLoadingUsers(true);
    try {
      const [usersResponse, rolesResponse] = await Promise.all([
        api.get<{ users: UserSummary[] }>("/users"),
        api.get<{ roles: RoleItem[] }>("/users/roles"),
      ]);

      setUsers(usersResponse.data.users);
      setRoles(rolesResponse.data.roles);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadUserDetail = async (userId: number) => {
    setLoadingDetail(true);
    try {
      const response = await api.get<{ user: UserDetail }>(`/users/${userId}`);
      setSelectedUser(response.data.user);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadUsersAndRoles().catch(() => notify.error("Usuarios", "No fue posible cargar usuarios."));
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.fullName.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "ALL" || (statusFilter === "ACTIVE" ? user.isActive : !user.isActive);

      const matchesRole = roleFilter === "ALL" || String(user.role.id) === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [users, search, statusFilter, roleFilter]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormState({
      ...emptyForm,
      roleId: roles[0] ? String(roles[0].id) : "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserSummary) => {
    setEditingUser(user);
    setFormState({
      fullName: user.fullName,
      email: user.email,
      roleId: String(user.role.id),
      isActive: user.isActive,
      password: "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormState(emptyForm);
  };

  const openCreateRoleModal = () => {
    setEditingRole(null);
    setRoleFormState(emptyRoleForm);
    setIsRoleModalOpen(true);
  };

  const openEditRoleModal = (role: RoleItem) => {
    setEditingRole(role);
    setRoleFormState({
      name: role.name,
      description: role.description ?? "",
    });
    setIsRoleModalOpen(true);
  };

  const closeRoleModal = () => {
    setEditingRole(null);
    setRoleFormState(emptyRoleForm);
    setIsRoleModalOpen(false);
  };

  const submitRole = async () => {
    if (!roleFormState.name.trim()) {
      notify.warning("Roles", "El nombre del rol es obligatorio.");
      return;
    }

    setSavingRole(true);

    try {
      const payload = {
        name: roleFormState.name.trim(),
        description: roleFormState.description.trim() || null,
      };

      if (editingRole) {
        await api.put(`/users/roles/${editingRole.id}`, payload);
      } else {
        await api.post("/users/roles", payload);
      }

      await loadUsersAndRoles();
      closeRoleModal();
      notify.success("Roles", editingRole ? "Rol actualizado correctamente." : "Rol creado correctamente.");
    } catch (error) {
      notify.error("Roles", getApiErrorMessage(error, "No fue posible guardar el rol."));
    } finally {
      setSavingRole(false);
    }
  };

  const removeRole = async (role: RoleItem) => {
    const confirmed = window.confirm(`¿Eliminar el rol \"${role.name}\"?`);
    if (!confirmed) return;

    setDeletingRoleId(role.id);
    try {
      await api.delete(`/users/roles/${role.id}`);
      await loadUsersAndRoles();
      notify.success("Roles", "Rol eliminado correctamente.");
    } catch (error) {
      notify.error("Roles", getApiErrorMessage(error, "No fue posible eliminar el rol."));
    } finally {
      setDeletingRoleId(null);
    }
  };

  const collectDescendantIds = (menuId: number) => {
    const result: number[] = [];
    const stack = [menuId];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      result.push(current);
      for (const item of roleMenusCatalog) {
        if (item.parentId === current) {
          stack.push(item.id);
        }
      }
    }

    return result;
  };

  const openRoleMenusModal = async (role: RoleItem) => {
    setEditingRoleMenusFor(role);
    setRoleMenusLoading(true);
    setIsRoleMenusModalOpen(true);

    try {
      const response = await api.get<{
        role: RoleItem;
        menus: RoleMenuItem[];
        assignedMenuIds: number[];
      }>(`/users/roles/${role.id}/menus`);

      setRoleMenusCatalog(response.data.menus);
      setSelectedRoleMenuIds(response.data.assignedMenuIds);
    } catch (error) {
      notify.error("Roles", getApiErrorMessage(error, "No fue posible cargar menús del rol."));
      setIsRoleMenusModalOpen(false);
    } finally {
      setRoleMenusLoading(false);
    }
  };

  const closeRoleMenusModal = () => {
    setIsRoleMenusModalOpen(false);
    setEditingRoleMenusFor(null);
    setRoleMenusCatalog([]);
    setSelectedRoleMenuIds([]);
  };

  const toggleRoleMenu = (menuId: number, checked: boolean) => {
    const descendants = collectDescendantIds(menuId);
    if (checked) {
      setSelectedRoleMenuIds((prev) => Array.from(new Set([...prev, ...descendants])));
      return;
    }

    setSelectedRoleMenuIds((prev) => prev.filter((id) => !descendants.includes(id)));
  };

  const saveRoleMenus = async () => {
    if (!editingRoleMenusFor) return;

    setSavingRoleMenus(true);
    try {
      await api.put(`/users/roles/${editingRoleMenusFor.id}/menus`, {
        menuIds: selectedRoleMenuIds,
      });
      closeRoleMenusModal();
      notify.success("Roles", "Menús del rol actualizados.");
    } catch (error) {
      notify.error("Roles", getApiErrorMessage(error, "No fue posible guardar menús del rol."));
    } finally {
      setSavingRoleMenus(false);
    }
  };

  const submitUser = async () => {
    if (!formState.fullName.trim() || !formState.email.trim() || !formState.roleId) {
      notify.warning("Usuarios", "Completa nombre, correo y rol.");
      return;
    }

    if (!editingUser && formState.password.length < 8) {
      notify.warning("Usuarios", "La contraseña inicial debe tener al menos 8 caracteres.");
      return;
    }

    setSavingUser(true);

    try {
      const payload: {
        fullName: string;
        email: string;
        roleId: number;
        isActive: boolean;
        password?: string;
      } = {
        fullName: formState.fullName.trim(),
        email: formState.email.trim().toLowerCase(),
        roleId: Number(formState.roleId),
        isActive: formState.isActive,
      };

      if (formState.password.trim()) {
        payload.password = formState.password.trim();
      }

      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload);
      } else {
        await api.post("/users", payload);
      }

      await loadUsersAndRoles();

      if (selectedUser) {
        await loadUserDetail(selectedUser.id);
      }

      closeModal();
      notify.success("Usuarios", editingUser ? "Usuario actualizado correctamente." : "Usuario creado correctamente.");
    } catch (error) {
      notify.error("Usuarios", getApiErrorMessage(error, "No fue posible guardar el usuario."));
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <section className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {section === "roles" ? "Administracion de Roles" : "Administracion de Usuarios"}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {section === "roles"
              ? "Consulta los roles disponibles para asignacion de permisos."
              : "Gestiona cuentas, roles y estado activo por usuario."}
          </p>
        </div>
        {section === "users" ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-dark transition"
          >
            <UserPlus size={14} />
            Nuevo usuario
          </button>
        ) : (
          <button
            type="button"
            onClick={openCreateRoleModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-dark transition"
          >
            <ShieldPlus size={14} />
            Nuevo rol
          </button>
        )}
      </div>

      {section === "roles" ? (
        <div className="overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-card">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-border-light dark:border-border-dark bg-slate-50/80 dark:bg-background-dark">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">ID</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Rol</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Descripcion</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {roles.map((role) => (
                <tr key={role.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-surface-lighter/40">
                  <td className="px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400">{role.id}</td>
                  <td className="px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-slate-100">{role.name}</td>
                  <td className="px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400">{role.description ?? "Sin descripcion"}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditRoleModal(role)}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition"
                      >
                        <Pencil size={13} />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openRoleMenusModal(role)
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-border-light dark:border-border-dark px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-lighter transition"
                      >
                        <MenuIcon size={13} />
                        Menus
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRole(role)}
                        disabled={deletingRoleId === role.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/50 px-3 py-1.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-60 transition"
                      >
                        <Trash2 size={13} />
                        {deletingRoleId === role.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {roles.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-sm text-slate-400" colSpan={4}>
                    No hay roles para mostrar.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {section !== "roles" ? (
        <>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition"
          />
        </div>

        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
          className="appearance-none rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark pl-8 pr-8 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition"
        >
          <option value="ALL">Todos los estados</option>
          <option value="ACTIVE">Activos</option>
          <option value="INACTIVE">Inactivos</option>
        </select>
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition"
        >
          <option value="ALL">Todos los roles</option>
          {roles.map((role) => (
            <option key={role.id} value={String(role.id)}>
              {role.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() =>
            loadUsersAndRoles()
              .then(() => notify.success("Usuarios", "Listado de usuarios actualizado."))
              .catch(() => notify.error("Usuarios", "No fue posible refrescar usuarios."))
          }
          className="inline-flex items-center gap-1.5 rounded-xl border border-border-light dark:border-border-dark px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-lighter transition"
        >
          <RefreshCw size={14} />
          Refrescar
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-card">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-border-light dark:border-border-dark bg-slate-50/80 dark:bg-background-dark">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Nombre</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Correo</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Rol</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Estado</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {loadingUsers ? (
                <tr>
                  <td className="px-4 py-12 text-center text-sm text-slate-400" colSpan={5}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Cargando usuarios...
                    </span>
                  </td>
                </tr>
              ) : null}

              {!loadingUsers &&
                filteredUsers.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-surface-lighter/40">
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-slate-100">{user.fullName}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-500 dark:text-slate-400">{user.email}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">{user.role.name}</td>
                    <td className="px-4 py-3.5 text-sm">
                      <span
                        className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold ${
                          user.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
                        }`}
                      >
                        {user.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => loadUserDetail(user.id).catch(() => notify.error("Usuarios", "No fue posible cargar el detalle."))}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-light dark:border-border-dark px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-lighter transition"
                        >
                          <Eye size={13} />
                          Ver
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition"
                        >
                          <Pencil size={13} />
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loadingUsers && filteredUsers.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-sm text-slate-400" colSpan={5}>
                    No hay usuarios para mostrar con esos filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <aside className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-5 shadow-card">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Detalle de usuario</h3>
          {loadingDetail ? (
            <p className="mt-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Cargando detalle...
              </span>
            </p>
          ) : null}

          {!loadingDetail && !selectedUser ? (
            <p className="mt-3 text-xs text-slate-400">Selecciona un usuario para ver sus datos.</p>
          ) : null}

          {!loadingDetail && selectedUser ? (
            <div className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-3 pb-3 border-b border-border-light dark:border-border-dark">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {selectedUser.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedUser.fullName}</p>
                  <p className="text-[11px] text-slate-400">{selectedUser.email}</p>
                </div>
              </div>
              <p>
                <span className="font-semibold text-slate-500 dark:text-slate-400">Rol:</span> {selectedUser.role.name}
              </p>
              <p>
                <span className="font-semibold text-slate-500 dark:text-slate-400">Estado:</span>{" "}
                <span className={selectedUser.isActive ? "text-emerald-600" : "text-rose-500"}>{selectedUser.isActive ? "Activo" : "Inactivo"}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500 dark:text-slate-400">Creado:</span> {new Date(selectedUser.createdAt).toLocaleString()}
              </p>
              <p>
                <span className="font-semibold text-slate-500 dark:text-slate-400">Actualizado:</span> {new Date(selectedUser.updatedAt).toLocaleString()}
              </p>
            </div>
          ) : null}
        </aside>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editingUser ? "Editar usuario" : "Crear usuario"}
            </h3>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block text-xs text-slate-700 dark:text-slate-300">
                Nombre completo
                <input
                  value={formState.fullName}
                  onChange={(e) => setFormState((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block text-xs text-slate-700 dark:text-slate-300">
                Correo
                <input
                  type="email"
                  value={formState.email}
                  onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block text-xs text-slate-700 dark:text-slate-300">
                Rol
                <select
                  value={formState.roleId}
                  onChange={(e) => setFormState((prev) => ({ ...prev, roleId: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Selecciona un rol...</option>
                  {roles.map((role) => (
                    <option key={role.id} value={String(role.id)}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-end gap-2 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(e) => setFormState((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                Usuario activo
              </label>
            </div>

            <label className="mt-3 block text-xs text-slate-700 dark:text-slate-300">
              {editingUser ? "Nueva contraseña (opcional)" : "Contraseña inicial"}
              <input
                type="password"
                value={formState.password}
                onChange={(e) => setFormState((prev) => ({ ...prev, password: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-border-light dark:border-border-dark px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-lighter"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingUser}
                onClick={submitUser}
                className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {savingUser ? "Guardando..." : editingUser ? "Guardar cambios" : "Crear usuario"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

        </>
      ) : null}

      {isRoleModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editingRole ? "Editar rol" : "Crear rol"}
            </h3>

            <div className="mt-4 grid gap-3">
              <label className="block text-xs text-slate-700 dark:text-slate-300">
                Nombre del rol
                <input
                  value={roleFormState.name}
                  onChange={(e) => setRoleFormState((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block text-xs text-slate-700 dark:text-slate-300">
                Descripción
                <textarea
                  value={roleFormState.description}
                  onChange={(e) => setRoleFormState((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeRoleModal}
                className="rounded-md border border-border-light dark:border-border-dark px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-lighter"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingRole}
                onClick={submitRole}
                className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {savingRole ? "Guardando..." : editingRole ? "Guardar cambios" : "Crear rol"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isRoleMenusModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Asignar menus a rol: {editingRoleMenusFor?.name}
            </h3>

            {roleMenusLoading ? (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Cargando menus...</p>
            ) : (
              <div className="mt-4 max-h-[55vh] overflow-auto rounded-lg border border-border-light dark:border-border-dark p-3">
                <div className="space-y-2">
                  {roleMenusCatalog
                    .filter((item) => item.parentId === null)
                    .map((parent) => {
                      const children = roleMenusCatalog
                        .filter((item) => item.parentId === parent.id)
                        .sort((a, b) => a.displayOrder - b.displayOrder);

                      return (
                        <div key={parent.id} className="rounded-md border border-border-light dark:border-border-dark p-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                            <input
                              type="checkbox"
                              checked={selectedRoleMenuIds.includes(parent.id)}
                              onChange={(e) => toggleRoleMenu(parent.id, e.target.checked)}
                            />
                            <span>{parent.label}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{parent.path}</span>
                          </label>

                          {children.length > 0 ? (
                            <div className="mt-2 pl-6 space-y-1">
                              {children.map((child) => (
                                <label key={child.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                                  <input
                                    type="checkbox"
                                    checked={selectedRoleMenuIds.includes(child.id)}
                                    onChange={(e) => toggleRoleMenu(child.id, e.target.checked)}
                                  />
                                  <span>{child.label}</span>
                                  <span className="text-xs text-slate-500 dark:text-slate-400">{child.path}</span>
                                </label>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeRoleMenusModal}
                className="rounded-md border border-border-light dark:border-border-dark px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-lighter"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingRoleMenus || roleMenusLoading}
                onClick={saveRoleMenus}
                className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {savingRoleMenus ? "Guardando..." : "Guardar menus"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
