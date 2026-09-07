import { useEffect, useState } from "react";
import { LogIn, Sun, Moon, Eye, EyeOff } from "lucide-react";
import { api } from "./lib/api";
import { useTheme } from "./contexts/ThemeContext";
import { Sidebar, MenuItem } from "./components/Sidebar";
import { AssetsTable } from "./components/AssetsTable";
import { AssetDetail } from "./components/AssetDetail";
import { AssetForm } from "./components/AssetForm";
import { DashboardCards, Summary } from "./components/DashboardCards";
import { AiLogsView } from "./components/AiLogsView";
import { UserPreferences } from "./components/UserPreferences";
import { UsersManagement } from "./components/UsersManagement";
import { HelpdeskConfigView } from "./components/HelpdeskConfigView";
import { TicketsView } from "./components/TicketsView";
import { ProjectsView } from "./components/ProjectsView";
import { ItamConfigView } from "./components/ItamConfigView";
import { CompanyConfigView } from "./components/CompanyConfigView";
import { LifecycleReport } from "./components/LifecycleReport";
import { ReportsView } from "./components/ReportsView";
import { VehiclesTable, VehicleDetail } from "./components/VehiclesView";
import { VehicleForm } from "./components/VehicleForm";
import { Asset, AssetStatus, StorageType, TicketPriority, Vehicle } from "./types";
import { notify } from "./lib/toast";

type LoginResult = {
  user: {
    id: number;
    fullName: string;
    email: string;
    role: { id: number; name: string };
  };
  permissions?: string[];
};

const SESSION_STORAGE_KEY = "assetcore:session";
const PREFERENCES_MODAL_KEY = "assetcore:preferences-open";

function App() {
  const [session, setSession] = useState<LoginResult | null>(null);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [currentRoute, setCurrentRoute] = useState("/dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ticketTopics, setTicketTopics] = useState<Array<{ id: number; name: string }>>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryUpdatedAt, setSummaryUpdatedAt] = useState<Date | null>(null);
  const [aiLogs, setAiLogs] = useState<
    Array<{
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
    }>
  >([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [manualTicketLog, setManualTicketLog] = useState<{
    id: number;
    subject: string | null;
    body: string;
  } | null>(null);
  const [manualTicketAssetId, setManualTicketAssetId] = useState<number | "">("");
  const [manualTicketTopicId, setManualTicketTopicId] = useState<number | "">("");
  const [manualTicketPriority, setManualTicketPriority] = useState<TicketPriority>("MEDIUM");
  const [creatingManualTicket, setCreatingManualTicket] = useState(false);
  const [error, setError] = useState<string>("");
  const [loadingPrivateData, setLoadingPrivateData] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const { theme, setTheme } = useTheme();

  const getAvatarStorageKey = (userId: number) => `assetcore:avatar:${userId}`;

  const loadAvatarFromStorage = (userId: number) => {
    const savedAvatar = localStorage.getItem(getAvatarStorageKey(userId)) ?? "";
    setAvatarUrl(savedAvatar);
  };

  const saveAvatarToStorage = (userId: number, newAvatarUrl: string) => {
    if (newAvatarUrl) {
      localStorage.setItem(getAvatarStorageKey(userId), newAvatarUrl);
    } else {
      localStorage.removeItem(getAvatarStorageKey(userId));
    }
    setAvatarUrl(newAvatarUrl);
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Best-effort — clear local state regardless
    }
    setSession(null);
    setShowPreferencesModal(false);
    setAvatarUrl("");
    setMenus([]);
    setPermissions([]);
    setAssets([]);
    setTicketTopics([]);
    setCurrentRoute("/dashboard");
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(PREFERENCES_MODAL_KEY);
  };

  const openPreferencesModal = () => {
    setShowPreferencesModal(true);
    localStorage.setItem(PREFERENCES_MODAL_KEY, "1");
  };

  const closePreferencesModal = () => {
    setShowPreferencesModal(false);
    localStorage.removeItem(PREFERENCES_MODAL_KEY);
  };

  const saveMyProfile = async (payload: { fullName: string; email: string }) => {
    const response = await api.put<{ user: LoginResult["user"] }>("/auth/me", payload);

    if (!session) return;

    setSession({
      ...session,
      user: response.data.user,
    });
  };

  const changeMyPassword = async (payload: { currentPassword: string; newPassword: string }) => {
    await api.put("/auth/me/password", payload);
  };

  const loadAssets = async () => {
    setLoadingAssets(true);
    try {
      const assetsResponse = await api.get<{ assets: Asset[] }>("/assets");
      setAssets(assetsResponse.data.assets);
    } finally {
      setLoadingAssets(false);
    }
  };

  const loadVehicles = async () => {
    setLoadingVehicles(true);
    try {
      const res = await api.get<{ vehicles: Vehicle[] }>("/vehicles");
      setVehicles(res.data.vehicles);
    } finally {
      setLoadingVehicles(false);
    }
  };

  const refreshInventory = async () => {
    await loadAssets();
    setLoadingSummary(true);
    try {
      const summaryResponse = await api.get<{ summary: Summary }>("/dashboard/summary");
      setSummary(summaryResponse.data.summary);
      setSummaryUpdatedAt(new Date());
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadPrivateData = async () => {
    setLoadingPrivateData(true);
    setLoadingAssets(true);
    setLoadingSummary(true);
    try {
      const [menusResponse, assetsResponse, summaryResponse] = await Promise.all([
        api.get<{ menus: MenuItem[]; permissions: string[] }>("/menus/me"),
        api.get<{ assets: Asset[] }>("/assets"),
        api.get<{ summary: Summary }>(
          "/dashboard/summary"
        ),
      ]);

      setMenus(menusResponse.data.menus);
      setPermissions(menusResponse.data.permissions ?? []);
      setAssets(assetsResponse.data.assets);
      setSummary(summaryResponse.data.summary);
      setSummaryUpdatedAt(new Date());

      const canReadTickets = menusResponse.data.menus.some((menu) => {
        if (menu.path === "/tickets") return true;
        return menu.children?.some((child) => child.path.startsWith("/tickets"));
      });

      if (canReadTickets) {
        try {
          const topicsResponse = await api.get<{ topics: Array<{ id: number; name: string }> }>("/tickets/topics");
          setTicketTopics(topicsResponse.data.topics.map((topic) => ({ id: topic.id, name: topic.name })));
        } catch {
          setTicketTopics([]);
        }
      } else {
        setTicketTopics([]);
      }

      const canReadAiLogs = menusResponse.data.menus.some((menu) => {
        if (menu.path === "/ai-logs") return true;
        return menu.children?.some((child) => child.path === "/ai-logs");
      });

      if (canReadAiLogs) {
        try {
          const logsResponse = await api.get<{ logs: typeof aiLogs }>("/ai-logs");
          setAiLogs(logsResponse.data.logs);
        } catch {
          setAiLogs([]);
        }
      } else {
        setAiLogs([]);
      }
    } finally {
      setLoadingPrivateData(false);
      setLoadingAssets(false);
      setLoadingSummary(false);
    }
  };

  const login = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      notify.warning("Autenticación", "Ingresa correo y contraseña.");
      return;
    }

    setError("");
    setLoggingIn(true);
    try {
      const response = await api.post<{ user: LoginResult["user"]; menus: MenuItem[]; permissions: string[] }>("/auth/login", {
        email: loginEmail.trim(),
        password: loginPassword,
      });

      // Cookies set automatically by browser (HttpOnly)
      const loginData: LoginResult = {
        user: response.data.user,
        permissions: response.data.permissions ?? [],
      };
      setSession(loginData);
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(loginData));

      if (response.data.menus) {
        setMenus(response.data.menus);
      }
      if (response.data.permissions) {
        setPermissions(response.data.permissions);
      }

      try {
        await loadPrivateData();
      } catch {
        notify.warning("Sesión", "Sesión iniciada, pero hubo un problema temporal cargando datos.");
      }
    } catch (err) {
      setSession(null);
      setMenus([]);
      setPermissions([]);
      setAssets([]);
      notify.error("Autenticación", "No fue posible autenticar. Verifica correo/contraseña o backend.");
    } finally {
      setLoggingIn(false);
    }
  };

  useEffect(() => {
    const restoreSession = async () => {
      const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!rawSession) return;

      try {
        const parsed = JSON.parse(rawSession) as LoginResult;
        if (!parsed?.user) return;

        // Restore from localStorage immediately to avoid flash
        setSession(parsed);

        // Validate with the server (cookie sent automatically)
        const meResponse = await api.get<{ user: LoginResult["user"] }>("/auth/me");
        const restoredSession: LoginResult = {
          user: meResponse.data.user,
        };

        setSession(restoredSession);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(restoredSession));
        if (localStorage.getItem(PREFERENCES_MODAL_KEY) === "1") {
          setShowPreferencesModal(true);
        }

        try {
          await loadPrivateData();
        } catch {
          notify.warning("Sesión", "No se pudieron cargar datos iniciales, pero tu sesión sigue activa.");
        }
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;

        if (status === 401) {
          // Try refresh
          try {
            const refreshRes = await api.post<{ user: LoginResult["user"] }>("/auth/refresh");
            const refreshedSession: LoginResult = { user: refreshRes.data.user };
            setSession(refreshedSession);
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(refreshedSession));

            try {
              await loadPrivateData();
            } catch {
              notify.warning("Sesión", "Sesión renovada, pero hubo un problema temporal cargando datos.");
            }
            return;
          } catch {
            // Refresh also failed — clear session
            localStorage.removeItem(SESSION_STORAGE_KEY);
            localStorage.removeItem(PREFERENCES_MODAL_KEY);
            setSession(null);
            return;
          }
        }

        if (status === 403) {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          localStorage.removeItem(PREFERENCES_MODAL_KEY);
          setSession(null);
          return;
        }

        // Transient network errors — keep local session
        notify.error("Sesión", "No fue posible validar sesión por un problema temporal de conexión.");
      }
    };

    restoreSession();
  }, []);

  const openAssetDetail = async (assetId: number) => {
    try {
      setCurrentRoute("/assets");
      setError("");
      window.scrollTo({ top: 0 });
      const [assetResponse, qrResponse] = await Promise.all([
        api.get<{ asset: Asset }>(`/assets/${assetId}`),
        api.get<Blob>(`/assets/${assetId}/qr`, { responseType: "blob" }),
      ]);

      /* Convert QR blob → data URL so it works in any window/origin (print dialog, blob windows) */
      const qrDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(qrResponse.data);
      });

      if (qrImageUrl) {
        URL.revokeObjectURL(qrImageUrl);
      }

      setSelectedAsset(assetResponse.data.asset);
      setQrImageUrl(qrDataUrl);
      setShowAssetForm(false);
      setEditingAsset(null);
    } catch (_error) {
      notify.error("Activos", "No se pudo cargar el detalle del activo.");
    }
  };

  const openCreateForm = () => {
    setCurrentRoute("/assets/new");
    setSelectedAsset(null);
    setEditingAsset(null);
    setShowAssetForm(true);
  };

  const openEditForm = (asset: Asset) => {
    setCurrentRoute("/assets/edit");
    setSelectedAsset(null);
    setEditingAsset(asset);
    setShowAssetForm(true);
  };

  const submitAsset = async (payload: {
    brand: string;
    model: string;
    serialNumber: string;
    equipmentValue?: number | null;
    purchasePrice?: number | null;
    salvageValue?: number | null;
    status: AssetStatus;
    assetTypeId?: number | null;
    processor?: string | null;
    ramGb?: number | null;
    storageGb?: number | null;
    storageType?: StorageType | null;
    purchaseDate?: string | null;
    warrantyEnd?: string | null;
    usefulLifeYears?: number | null;
    locationId?: number | null;
    assignedToName?: string | null;
    assignedToDate?: string | null;
    specifications: Record<string, string>;
  }) => {
    try {
      if (editingAsset) {
        await api.put(`/assets/${editingAsset.id}`, payload);
      } else {
        await api.post("/assets", payload);
      }

      setShowAssetForm(false);
      setEditingAsset(null);
      await refreshInventory();
    } catch (_error) {
      notify.error("Activos", "No se pudo guardar el activo.");
    }
  };

  /* ─── Vehicles ─── */

  const openVehicleDetail = async (vehicleId: number) => {
    try {
      setCurrentRoute("/vehicles");
      setError("");
      window.scrollTo({ top: 0 });
      const res = await api.get<{ vehicle: Vehicle }>(`/vehicles/${vehicleId}`);
      setSelectedVehicle(res.data.vehicle);
      setShowVehicleForm(false);
      setEditingVehicle(null);
    } catch (_error) {
      notify.error("Vehiculos", "No se pudo cargar el detalle del vehiculo.");
    }
  };

  const openCreateVehicleForm = () => {
    setCurrentRoute("/vehicles/new");
    setSelectedVehicle(null);
    setEditingVehicle(null);
    setShowVehicleForm(true);
  };

  const openEditVehicleForm = (vehicle: Vehicle) => {
    setCurrentRoute("/vehicles/edit");
    setSelectedVehicle(null);
    setEditingVehicle(vehicle);
    setShowVehicleForm(true);
  };

  const submitVehicle = async (payload: Record<string, unknown>) => {
    try {
      if (editingVehicle) {
        await api.put(`/vehicles/${editingVehicle.id}`, payload);
      } else {
        await api.post("/vehicles", payload);
      }
      setShowVehicleForm(false);
      setEditingVehicle(null);
      await loadVehicles();
    } catch (_error) {
      notify.error("Vehiculos", "No se pudo guardar el vehiculo.");
    }
  };

  const createTicket = async (payload: {
    title: string;
    description: string;
    priority: TicketPriority;
    assetId: number;
    supportTopicId: number | null;
  }) => {
    await api.post("/tickets", payload);
    await openAssetDetail(payload.assetId);
    setLoadingSummary(true);
    const summaryResponse = await api.get<{
      summary: Summary;
    }>("/dashboard/summary");
    setSummary(summaryResponse.data.summary);
    setSummaryUpdatedAt(new Date());
    setLoadingSummary(false);
  };

  const transitionTicket = async (ticketId: number, action: "IN_PROGRESS" | "PROVIDER" | "CLOSED" | "CANCELLED" | "REOPEN") => {
    if (!selectedAsset) return;
    await api.put(`/tickets/${ticketId}/transition`, { action });
    await openAssetDetail(selectedAsset.id);
    setLoadingSummary(true);
    const summaryResponse = await api.get<{
      summary: Summary;
    }>("/dashboard/summary");
    setSummary(summaryResponse.data.summary);
    setSummaryUpdatedAt(new Date());
    setLoadingSummary(false);
  };

  const createManualTicketFromLog = async () => {
    if (!manualTicketLog || manualTicketAssetId === "") return;
    if (ticketTopics.length > 0 && manualTicketTopicId === "") {
      notify.warning("Tickets", "Selecciona un tema para el ticket manual.");
      return;
    }

    setCreatingManualTicket(true);
    try {
      await api.post("/tickets", {
        title: `Manual: ${manualTicketLog.subject || "Mensaje entrante sin match"}`,
        description: manualTicketLog.body,
        priority: manualTicketPriority,
        assetId: Number(manualTicketAssetId),
        supportTopicId: manualTicketTopicId === "" ? null : Number(manualTicketTopicId),
      });

      setManualTicketLog(null);
      setManualTicketAssetId("");
      setManualTicketTopicId("");
      setManualTicketPriority("MEDIUM");

      const [logsResponse, summaryResponse] = await Promise.all([
        api.get<{ logs: typeof aiLogs }>("/ai-logs"),
        api.get<{
          summary: Summary;
        }>("/dashboard/summary"),
      ]);
      setAiLogs(logsResponse.data.logs);
      setSummary(summaryResponse.data.summary);
      setSummaryUpdatedAt(new Date());
    } catch (_error) {
      notify.error("Tickets", "No se pudo crear ticket manual desde el mensaje.");
    } finally {
      setCreatingManualTicket(false);
    }
  };

  /* qrImageUrl is now a data: URL — no revocation needed */

  useEffect(() => {
    if (session) {
      loadAvatarFromStorage(session.user.id);
    }
  }, [session]);

  useEffect(() => {
    setSelectedAsset(null);
    setSelectedVehicle(null);
    if (qrImageUrl) {
      URL.revokeObjectURL(qrImageUrl);
      setQrImageUrl(null);
    }
    if (currentRoute !== "/assets/new" && currentRoute !== "/assets/edit") {
      setShowAssetForm(false);
      setEditingAsset(null);
    }
    if (currentRoute !== "/vehicles/new" && currentRoute !== "/vehicles/edit") {
      setShowVehicleForm(false);
      setEditingVehicle(null);
    }
    if (currentRoute.startsWith("/ai-logs") && session) {
      api
        .get<{ logs: typeof aiLogs }>("/ai-logs")
        .then((response) => setAiLogs(response.data.logs))
        .catch(() => undefined);
    }
    const isAssetsListRoute =
      currentRoute === "/assets" ||
      currentRoute === "/assets/list" ||
      currentRoute.startsWith("/assets/list/");
    if (
      session &&
      isAssetsListRoute &&
      currentRoute !== "/assets/new" &&
      currentRoute !== "/assets/edit"
    ) {
      void loadAssets();
    }
    const isVehiclesRoute =
      currentRoute === "/vehicles" ||
      currentRoute === "/vehicles/list" ||
      currentRoute.startsWith("/vehicles/list/");
    if (
      session &&
      isVehiclesRoute &&
      currentRoute !== "/vehicles/new" &&
      currentRoute !== "/vehicles/edit"
    ) {
      void loadVehicles();
    }
  }, [currentRoute]);

  const usersSection = currentRoute.startsWith("/users/roles") ? "roles" : "users";

  // Mostrar solo pantalla de login si no hay sesión
  if (!session) {
    return (
      <div className={`${theme === "dark" ? "dark" : ""} flex min-h-screen items-center justify-center bg-background p-4 transition-colors`}>
        {/* Background decoration */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="relative w-full max-w-md animate-scale-in">
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-xl p-2.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition focus-ring"
              title={`Cambiar a tema ${theme === "dark" ? "claro" : "oscuro"}`}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 shadow-elevation-3">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-glow">
                <LogIn size={24} />
              </div>
              <h1 className="font-display text-2xl font-bold text-on-surface">Bienvenido</h1>
              <p className="mt-1.5 text-sm text-on-surface-variant">Ingresa a AssetCore ITAM</p>
            </div>

            {error ? (
              <div className="mb-6 rounded-xl border border-error-container bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</div>
            ) : null}

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                login();
              }}
            >
              <div>
                <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">Correo electronico</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition focus-ring"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">Contrasena</label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-outline-variant bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 px-4 py-3 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition focus-ring"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface focus-ring"
                  >
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary shadow-elevation-2 transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus-ring disabled:opacity-60 disabled:pointer-events-none"
              >
                {loggingIn ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Ingresando...
                  </span>
                ) : (
                  "Iniciar sesion"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${theme === "dark" ? "dark" : ""} min-h-screen bg-background text-on-background transition-colors`}>
      <UserPreferences
        isOpen={showPreferencesModal}
          onClose={closePreferencesModal}
        user={{ fullName: session.user.fullName, email: session.user.email, roleName: session.user.role.name }}
        avatarUrl={avatarUrl}
        theme={theme}
        onSetTheme={setTheme}
        onSaveProfile={saveMyProfile}
        onChangePassword={changeMyPassword}
        onChangeAvatar={(newAvatar) => saveAvatarToStorage(session.user.id, newAvatar)}
      />

      {manualTicketLog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-elevation-3 animate-scale-in transition-colors">
            <h3 className="text-lg font-semibold text-on-surface">Crear Ticket Manual desde Webhook</h3>
            <p className="mt-1 text-xs text-on-surface-variant">Mensaje #{manualTicketLog.id}</p>
            <div className="mt-3 rounded-xl border border-outline-variant bg-surface-container-low p-3 text-xs text-on-surface transition-colors">
              {manualTicketLog.body}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <select
                value={manualTicketAssetId}
                onChange={(e) => setManualTicketAssetId(e.target.value ? Number(e.target.value) : "")}
                className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors focus-ring"
              >
                <option value="">Seleccionar activo...</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.assetCode} - {asset.brand} {asset.model}
                  </option>
                ))}
              </select>
              <select
                value={manualTicketTopicId}
                onChange={(e) => setManualTicketTopicId(e.target.value ? Number(e.target.value) : "")}
                className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors focus-ring"
              >
                <option value="">Seleccionar tema...</option>
                {ticketTopics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
              <select
                value={manualTicketPriority}
                onChange={(e) => setManualTicketPriority(e.target.value as TicketPriority)}
                className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors focus-ring"
              >
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Critica</option>
              </select>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={manualTicketAssetId === "" || creatingManualTicket || (ticketTopics.length > 0 && manualTicketTopicId === "")}
                onClick={createManualTicketFromLog}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:brightness-110 disabled:opacity-60 transition focus-ring"
              >
                {creatingManualTicket ? "Creando..." : "Crear ticket"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setManualTicketLog(null);
                  setManualTicketAssetId("");
                  setManualTicketTopicId("");
                  setManualTicketPriority("MEDIUM");
                }}
                className="rounded-xl border border-outline-variant px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high transition focus-ring"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Sidebar
        menus={menus}
        currentRoute={currentRoute}
        onNavigate={setCurrentRoute}
        onOpenPreferences={openPreferencesModal}
        user={{ fullName: session.user.fullName, email: session.user.email, roleName: session.user.role.name }}
        avatarUrl={avatarUrl}
        onLogout={logout}
        onCollapsedChange={setSidebarCollapsed}
      />

      <main className={`transition-all duration-300 min-h-screen ${sidebarCollapsed ? "lg:pl-[68px]" : "lg:pl-64"}`}>
        <div className={`mx-auto w-full p-4 sm:p-6 lg:p-8 animate-fade-in transition-all duration-300 ${sidebarCollapsed ? "max-w-[1600px]" : "max-w-[1400px]"}`}>
          {error ? (
            <div className="mb-6 rounded-xl border border-error-container bg-error-container px-4 py-3 text-sm text-on-error-container transition-colors">
              {error}
            </div>
          ) : null}

          {loadingPrivateData ? (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-sm text-on-surface-variant shadow-card transition-colors">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Cargando datos iniciales...
            </div>
          ) : null}

          {currentRoute.startsWith("/dashboard") ? (
            <DashboardCards
              summary={summary}
              loading={loadingSummary}
              lastUpdatedAt={summaryUpdatedAt}
              showTickets={menus.some((m) => m.path === "/tickets" || m.children?.some((c) => c.path.startsWith("/tickets")))}
              onViewAsset={openAssetDetail}
              onNavigate={setCurrentRoute}
            />
          ) : currentRoute.startsWith("/settings/company") ? (
            <CompanyConfigView />
          ) : currentRoute.startsWith("/users") ? (
            <UsersManagement section={usersSection} />
          ) : currentRoute.startsWith("/tickets/configuration") ? (
            <HelpdeskConfigView />
          ) : currentRoute.startsWith("/tickets") ? (
            <TicketsView />
          ) : currentRoute.startsWith("/projects") ? (
            <ProjectsView />
          ) : currentRoute.startsWith("/itam-config") ? (
            <ItamConfigView
              canWrite={permissions.includes("itam.config.write")}
              onImportComplete={refreshInventory}
            />
          ) : currentRoute.startsWith("/vehicles") ? (
            selectedVehicle ? (
              <VehicleDetail
                vehicle={selectedVehicle}
                canWrite={permissions.includes("vehicles.write")}
                onBack={() => { setSelectedVehicle(null); setCurrentRoute("/vehicles"); }}
                onRefresh={() => openVehicleDetail(selectedVehicle.id)}
                onDecommissioned={async () => { setSelectedVehicle(null); await loadVehicles(); }}
              />
            ) : showVehicleForm ? (
              <VehicleForm
                initialVehicle={editingVehicle}
                onSubmit={submitVehicle}
                onCancel={() => { setShowVehicleForm(false); setEditingVehicle(null); setCurrentRoute("/vehicles"); }}
              />
            ) : (
              <VehiclesTable
                vehicles={vehicles}
                loading={loadingVehicles}
                canWrite={permissions.includes("vehicles.write")}
                onView={openVehicleDetail}
                onEdit={openEditVehicleForm}
                onNew={openCreateVehicleForm}
              />
            )
          ) : currentRoute.startsWith("/reports") ? (
            <ReportsView currentRoute={currentRoute} onViewAsset={openAssetDetail} />
          ) : currentRoute.startsWith("/lifecycle-report") ? (
            <LifecycleReport />
          ) : currentRoute.startsWith("/ai-logs") ? (
            <AiLogsView
              logs={aiLogs}
              onCreateManualTicket={(log) => {
                setManualTicketLog({ id: log.id, subject: log.subject, body: log.body });
                setManualTicketAssetId("");
                setManualTicketTopicId(ticketTopics[0]?.id ?? "");
                setManualTicketPriority("MEDIUM");
              }}
            />
          ) : selectedAsset ? (
            <AssetDetail
              asset={selectedAsset}
              qrImageUrl={qrImageUrl}
              ticketTopics={ticketTopics}
              onCreateTicket={createTicket}
              onTransitionTicket={transitionTicket}
              onRefreshAsset={() => openAssetDetail(selectedAsset.id)}
              onDecommissioned={async () => {
                setSelectedAsset(null);
                setQrImageUrl(null);
                await loadAssets();
              }}
              onBack={() => {
                setSelectedAsset(null);
                setQrImageUrl(null);
              }}
            />
          ) : showAssetForm ? (
            <AssetForm initialAsset={editingAsset} onSubmit={submitAsset} onCancel={() => setShowAssetForm(false)} />
          ) : (
            <AssetsTable assets={assets} loading={loadingAssets} onView={openAssetDetail} onEdit={openEditForm} onNew={openCreateForm} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
