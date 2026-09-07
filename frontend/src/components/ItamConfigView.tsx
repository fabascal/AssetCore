import { useEffect, useMemo, useState } from "react";
import {
  Settings2,
  MapPin,
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  Layers,
  FileUp,
  ChevronRight,
  Tag,
} from "lucide-react";
import { AssetImportTab } from "./AssetImportTab";
import {
  btnPrimary,
  btnSecondary,
  CatalogEmptyState,
  CatalogLoading,
  CatalogRow,
  CatalogTable,
  CatalogToolbar,
  IconAction,
  inputCls,
} from "./itam-config/ItamCatalogUi";
import { api } from "../lib/api";
import { buildLocationOptions, collectDescendantIds } from "../lib/locations";
import { formatProcessorLabel } from "../lib/processors";
import { notify } from "../lib/toast";
import { AssetType } from "../types";

/* ─── Types ─── */
type Location = {
  id: number;
  name: string;
  parentId: number | null;
  isActive: boolean;
  parent?: { id: number; name: string } | null;
  children?: Location[];
};
type Brand = { id: number; name: string; isActive: boolean; models: Model[] };
type Model = { id: number; name: string; brandId: number; isActive: boolean; brand?: Brand };
type Processor = { id: number; name: string; generation?: string | null; isActive: boolean };
type RamOption = { id: number; label: string; sizeGb: number; isActive: boolean };
type StorageOption = { id: number; label: string; sizeGb: number; isActive: boolean };
type Tab = "locations" | "brands" | "processors" | "ram" | "storage" | "asset-types" | "import";

const tabs: { key: Tab; label: string; icon: typeof MapPin }[] = [
  { key: "locations", label: "Ubicaciones", icon: MapPin },
  { key: "brands", label: "Marcas / Modelos", icon: Monitor },
  { key: "processors", label: "Procesadores", icon: Cpu },
  { key: "ram", label: "RAM", icon: MemoryStick },
  { key: "storage", label: "Almacenamiento", icon: HardDrive },
  { key: "asset-types", label: "Tipo de Activo", icon: Layers },
  { key: "import", label: "Importar", icon: FileUp },
];

const tabMeta: Record<Exclude<Tab, "import">, { title: string; description: string; searchPlaceholder: string; emptyTitle: string; emptyDescription: string; actionLabel: string; countLabel: string }> = {
  locations: {
    title: "Ubicaciones",
    description: "Estructura jerárquica de sitios, edificios y áreas.",
    searchPlaceholder: "Buscar ubicación…",
    emptyTitle: "Sin ubicaciones",
    emptyDescription: "Define la estructura física donde se encuentran los activos.",
    actionLabel: "Nueva ubicación",
    countLabel: "ubicaciones",
  },
  brands: {
    title: "Marcas y modelos",
    description: "Catálogo de fabricantes y sus modelos de equipo.",
    searchPlaceholder: "Buscar marca o modelo…",
    emptyTitle: "Sin marcas",
    emptyDescription: "Agrega marcas y sus modelos para estandarizar el inventario.",
    actionLabel: "Nueva marca",
    countLabel: "marcas",
  },
  processors: {
    title: "Procesadores",
    description: "Familia o modelo de CPU con generación (ej. Intel Core i7, Gen 13).",
    searchPlaceholder: "Buscar procesador…",
    emptyTitle: "Sin procesadores",
    emptyDescription: "Crea las opciones de procesador que usarás en el inventario.",
    actionLabel: "Nuevo procesador",
    countLabel: "procesadores",
  },
  ram: {
    title: "Memoria RAM",
    description: "Capacidades de RAM con etiqueta legible y tamaño en GB.",
    searchPlaceholder: "Buscar por etiqueta o GB…",
    emptyTitle: "Sin opciones de RAM",
    emptyDescription: "Define las capacidades de memoria disponibles.",
    actionLabel: "Nueva opción",
    countLabel: "opciones",
  },
  storage: {
    title: "Almacenamiento",
    description: "Discos y capacidades de almacenamiento en GB.",
    searchPlaceholder: "Buscar por etiqueta o GB…",
    emptyTitle: "Sin opciones de almacenamiento",
    emptyDescription: "Define las capacidades de disco disponibles.",
    actionLabel: "Nueva opción",
    countLabel: "opciones",
  },
  "asset-types": {
    title: "Tipos de activo",
    description: "Clasificación de activos y vida útil para depreciación.",
    searchPlaceholder: "Buscar tipo…",
    emptyTitle: "Sin tipos de activo",
    emptyDescription: "Define categorías como Laptop, Monitor o Servidor.",
    actionLabel: "Nuevo tipo",
    countLabel: "tipos",
  },
};

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function visibleLocationIds(locations: Location[], query: string): Set<number> | null {
  const q = normalizeSearch(query);
  if (!q) return null;

  const byId = new Map(locations.map((l) => [l.id, l]));
  const matching = locations.filter((l) => l.name.toLowerCase().includes(q));
  const visible = new Set<number>();

  for (const loc of matching) {
    visible.add(loc.id);
    let parentId = loc.parentId;
    while (parentId) {
      visible.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
  }

  return visible;
}

function formatGb(sizeGb: number) {
  if (sizeGb >= 1024) return `${(sizeGb / 1024).toFixed(sizeGb % 1024 === 0 ? 0 : 1)} TB`;
  return `${sizeGb} GB`;
}

export const ItamConfigView = ({
  canWrite = false,
  onImportComplete,
}: {
  canWrite?: boolean;
  onImportComplete?: () => void | Promise<void>;
}) => {
  const [tab, setTab] = useState<Tab>("locations");
  const [search, setSearch] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [processors, setProcessors] = useState<Processor[]>([]);
  const [ramOptions, setRamOptions] = useState<RamOption[]>([]);
  const [storageOptions, setStorageOptions] = useState<StorageOption[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState<{ type: string; item?: Record<string, unknown> } | null>(null);
  const [formName, setFormName] = useState("");
  const [formParentId, setFormParentId] = useState<number | "">("");
  const [formBrandId, setFormBrandId] = useState<number | "">("");
  const [formSizeGb, setFormSizeGb] = useState<number | "">("");
  const [formYears, setFormYears] = useState<number | "">("");
  const [formGeneration, setFormGeneration] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [loc, br, pr, ra, st] = await Promise.all([
        api.get<{ locations: Location[] }>("/itam-config/locations"),
        api.get<{ brands: Brand[] }>("/itam-config/brands"),
        api.get<{ processors: Processor[] }>("/itam-config/processors"),
        api.get<{ ram: RamOption[] }>("/itam-config/ram"),
        api.get<{ storage: StorageOption[] }>("/itam-config/storage"),
      ]);
      setLocations(loc.data.locations);
      setBrands(br.data.brands);
      setProcessors(pr.data.processors);
      setRamOptions(ra.data.ram);
      setStorageOptions(st.data.storage);
    } catch {
      notify.error("Config ITAM", "No se pudieron cargar los catálogos.");
    } finally {
      setLoading(false);
    }
  };

  const loadAssetTypes = async () => {
    try {
      const res = await api.get<{ assetTypes: AssetType[] }>("/itam-config/asset-types");
      setAssetTypes(res.data.assetTypes);
    } catch {
      notify.error("Tipos de Activo", "No se pudieron cargar los tipos.");
    }
  };

  useEffect(() => {
    load();
    loadAssetTypes();
  }, []);

  const visibleTabs = useMemo(
    () => tabs.filter((item) => item.key !== "import" || canWrite),
    [canWrite],
  );

  useEffect(() => {
    if (!canWrite && tab === "import") {
      setTab("locations");
    }
  }, [canWrite, tab]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setSearch("");
  };

  const openModal = (type: string, item?: Record<string, unknown>) => {
    setFormName((item?.name as string) ?? (item?.label as string) ?? "");
    setFormParentId((item?.parentId as number) ?? "");
    setFormBrandId((item?.brandId as number) ?? "");
    setFormSizeGb((item?.sizeGb as number) ?? "");
    setFormYears((item?.usefulLifeYears as number) ?? "");
    setFormGeneration((item?.generation as string) ?? "");
    setModal({ type, item });
  };

  const closeModal = () => {
    setModal(null);
    setSaving(false);
  };

  const saveItem = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      const isEdit = !!modal.item?.id;
      const id = modal.item?.id;

      switch (modal.type) {
        case "location": {
          const body = { name: formName, parentId: formParentId || null };
          if (isEdit) await api.put(`/itam-config/locations/${id}`, body);
          else await api.post("/itam-config/locations", body);
          break;
        }
        case "brand": {
          const body = { name: formName };
          if (isEdit) await api.put(`/itam-config/brands/${id}`, body);
          else await api.post("/itam-config/brands", body);
          break;
        }
        case "model": {
          const body = { name: formName, brandId: Number(formBrandId) };
          if (isEdit) await api.put(`/itam-config/models/${id}`, body);
          else await api.post("/itam-config/models", body);
          break;
        }
        case "processor": {
          const body = { name: formName, generation: formGeneration.trim() || null };
          if (isEdit) await api.put(`/itam-config/processors/${id}`, body);
          else await api.post("/itam-config/processors", body);
          break;
        }
        case "ram": {
          const body = { label: formName, sizeGb: Number(formSizeGb) };
          if (isEdit) await api.put(`/itam-config/ram/${id}`, body);
          else await api.post("/itam-config/ram", body);
          break;
        }
        case "storage": {
          const body = { label: formName, sizeGb: Number(formSizeGb) };
          if (isEdit) await api.put(`/itam-config/storage/${id}`, body);
          else await api.post("/itam-config/storage", body);
          break;
        }
        case "asset-type": {
          const existingRate =
            typeof modal.item?.depreciationRate === "number" ? modal.item.depreciationRate : 0.3;
          const body = {
            name: formName,
            usefulLifeYears: Number(formYears) || 5,
            depreciationRate: existingRate,
          };
          if (isEdit) await api.put(`/itam-config/asset-types/${id}`, body);
          else await api.post("/itam-config/asset-types", body);
          await loadAssetTypes();
          break;
        }
      }
      notify.success("Config ITAM", isEdit ? "Actualizado correctamente." : "Creado correctamente.");
      closeModal();
      await load();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Error al guardar";
      notify.error("Config ITAM", msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (type: string, id: number) => {
    if (!confirm("¿Eliminar este elemento?")) return;
    try {
      await api.delete(`/itam-config/${type}/${id}`);
      notify.success("Config ITAM", "Eliminado correctamente.");
      if (type === "asset-types") await loadAssetTypes();
      else await load();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "No se pudo eliminar";
      notify.error("Config ITAM", msg);
    }
  };

  const locationVisibility = useMemo(() => visibleLocationIds(locations, search), [locations, search]);

  const filteredBrands = useMemo(() => {
    const q = normalizeSearch(search);
    if (!q) return brands;
    return brands.filter(
      (b) => b.name.toLowerCase().includes(q) || b.models.some((m) => m.name.toLowerCase().includes(q)),
    );
  }, [brands, search]);

  const filteredProcessors = useMemo(() => {
    const q = normalizeSearch(search);
    if (!q) return processors;
    return processors.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.generation?.toLowerCase().includes(q) ?? false) ||
        formatProcessorLabel(p).toLowerCase().includes(q),
    );
  }, [processors, search]);

  const filteredRam = useMemo(() => {
    const q = normalizeSearch(search);
    const sorted = [...ramOptions].sort((a, b) => a.sizeGb - b.sizeGb);
    if (!q) return sorted;
    return sorted.filter(
      (r) => r.label.toLowerCase().includes(q) || String(r.sizeGb).includes(q) || formatGb(r.sizeGb).toLowerCase().includes(q),
    );
  }, [ramOptions, search]);

  const filteredStorage = useMemo(() => {
    const q = normalizeSearch(search);
    const sorted = [...storageOptions].sort((a, b) => a.sizeGb - b.sizeGb);
    if (!q) return sorted;
    return sorted.filter(
      (s) => s.label.toLowerCase().includes(q) || String(s.sizeGb).includes(q) || formatGb(s.sizeGb).toLowerCase().includes(q),
    );
  }, [storageOptions, search]);

  const filteredAssetTypes = useMemo(() => {
    const q = normalizeSearch(search);
    if (!q) return assetTypes;
    return assetTypes.filter((t) => t.name.toLowerCase().includes(q));
  }, [assetTypes, search]);

  const renderLocationNode = (loc: Location, depth = 0): JSX.Element | null => {
    if (locationVisibility && !locationVisibility.has(loc.id)) return null;

    const children = locations
      .filter((item) => item.parentId === loc.id)
      .map((child) => renderLocationNode(child, depth + 1))
      .filter(Boolean);

    const hasVisibleChildren = children.length > 0;
    const isMatch = normalizeSearch(search) && loc.name.toLowerCase().includes(normalizeSearch(search));

    return (
      <div key={loc.id} className={depth === 0 ? "space-y-1" : ""}>
        <div
          className={`group flex items-center gap-2 rounded-xl border border-outline-variant px-3 py-2.5 transition-colors duration-200 hover:bg-surface-container-low ${
            isMatch ? "border-primary/40 bg-primary-container/30" : "bg-surface-container-lowest"
          }`}
          style={{ marginLeft: depth * 20 }}
        >
          {depth > 0 ? (
            <ChevronRight size={14} className="shrink-0 text-on-surface-variant/50" />
          ) : (
            <MapPin size={15} className="shrink-0 text-primary" />
          )}
          <span className={`min-w-0 flex-1 truncate ${depth === 0 ? "font-medium text-on-surface" : "text-sm text-on-surface"}`}>
            {loc.name}
          </span>
          {canWrite ? (
          <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
            <IconAction
              label="Editar ubicación"
              icon="edit"
              size="sm"
              onClick={() => openModal("location", { id: loc.id, name: loc.name, parentId: loc.parentId })}
            />
            <IconAction label="Agregar sub-ubicación" icon="add" size="sm" onClick={() => openModal("location", { parentId: loc.id })} />
            <IconAction label="Eliminar ubicación" icon="delete" size="sm" onClick={() => deleteItem("locations", loc.id)} />
          </div>
          ) : null}
        </div>
        {hasVisibleChildren ? <div className="mt-1 space-y-1">{children}</div> : null}
      </div>
    );
  };

  const renderLocations = () => {
    const meta = tabMeta.locations;
    const roots = locations.filter((l) => !l.parentId);
    const visibleRoots = roots
      .map((loc) => renderLocationNode(loc))
      .filter(Boolean);

    return (
      <div className="space-y-5">
        <CatalogToolbar
          title={meta.title}
          description={meta.description}
          count={locations.length}
          countLabel={meta.countLabel}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={meta.searchPlaceholder}
          actionLabel={canWrite ? meta.actionLabel : undefined}
          onAction={canWrite ? () => openModal("location") : undefined}
        />
        {loading ? (
          <CatalogLoading />
        ) : visibleRoots.length > 0 ? (
          <div className="space-y-2">{visibleRoots}</div>
        ) : (
          <CatalogEmptyState
            icon={MapPin}
            title={search ? "Sin resultados" : meta.emptyTitle}
            description={search ? "Prueba con otro término de búsqueda." : meta.emptyDescription}
            actionLabel={canWrite ? meta.actionLabel : undefined}
            onAction={canWrite ? () => openModal("location") : undefined}
          />
        )}
      </div>
    );
  };

  const renderBrands = () => {
    const meta = tabMeta.brands;
    const q = normalizeSearch(search);

    return (
      <div className="space-y-5">
        <CatalogToolbar
          title={meta.title}
          description={meta.description}
          count={brands.length}
          countLabel={meta.countLabel}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={meta.searchPlaceholder}
          actionLabel={canWrite ? meta.actionLabel : undefined}
          onAction={canWrite ? () => openModal("brand") : undefined}
        />
        {loading ? (
          <CatalogLoading />
        ) : filteredBrands.length > 0 ? (
          <div className="space-y-3">
            {filteredBrands.map((brand) => {
              const models = q
                ? brand.models.filter((m) => m.name.toLowerCase().includes(q) || brand.name.toLowerCase().includes(q))
                : brand.models;

              return (
                <article
                  key={brand.id}
                  className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-outline-variant bg-surface-container-low px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
                        <Monitor size={16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate font-semibold text-on-surface">{brand.name}</h4>
                        <p className="text-xs text-on-surface-variant">
                          {brand.models.length} modelo{brand.models.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    {canWrite ? (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <IconAction label="Editar marca" icon="edit" onClick={() => openModal("brand", { id: brand.id, name: brand.name })} />
                      <IconAction label="Agregar modelo" icon="add" onClick={() => openModal("model", { brandId: brand.id })} />
                      <IconAction label="Eliminar marca" icon="delete" onClick={() => deleteItem("brands", brand.id)} />
                    </div>
                    ) : null}
                  </div>
                  {models.length > 0 ? (
                    <div className="flex flex-wrap gap-2 p-4">
                      {models.map((m) => (
                        <div
                          key={m.id}
                          className="group inline-flex max-w-full items-center gap-1 rounded-full border border-outline-variant bg-surface-container-low pl-3 pr-1 py-1 text-sm text-on-surface transition-colors duration-200 hover:border-primary/30 hover:bg-primary-container/20"
                        >
                          <Tag size={12} className="shrink-0 text-on-surface-variant" />
                          <span className="truncate">{m.name}</span>
                          {canWrite ? (
                            <>
                          <IconAction
                            label={`Editar ${m.name}`}
                            icon="edit"
                            size="sm"
                            onClick={() => openModal("model", { id: m.id, name: m.name, brandId: m.brandId })}
                          />
                          <IconAction label={`Eliminar ${m.name}`} icon="delete" size="sm" onClick={() => deleteItem("models", m.id)} />
                            </>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-sm text-on-surface-variant">Sin modelos. Agrega el primero.</p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <CatalogEmptyState
            icon={Monitor}
            title={search ? "Sin resultados" : meta.emptyTitle}
            description={search ? "Prueba con otro término de búsqueda." : meta.emptyDescription}
            actionLabel={canWrite ? meta.actionLabel : undefined}
            onAction={canWrite ? () => openModal("brand") : undefined}
          />
        )}
      </div>
    );
  };

  const renderProcessors = () => {
    const meta = tabMeta.processors;

    return (
      <div className="space-y-5">
        <CatalogToolbar
          title={meta.title}
          description={meta.description}
          count={processors.length}
          countLabel={meta.countLabel}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={meta.searchPlaceholder}
          actionLabel={canWrite ? meta.actionLabel : undefined}
          onAction={canWrite ? () => openModal("processor") : undefined}
        />
        {loading ? (
          <CatalogLoading />
        ) : filteredProcessors.length > 0 ? (
          <CatalogTable columns={[{ key: "name", label: "Procesador" }, { key: "generation", label: "Generación" }, ...(canWrite ? [{ key: "actions", label: "Acciones", align: "right" as const, className: "w-28" }] : [])]}>
            {filteredProcessors.map((item) => (
              <CatalogRow key={item.id}>
                <td className="px-4 py-3 font-medium text-on-surface">{item.name}</td>
                <td className="px-4 py-3 text-on-surface-variant">{item.generation ? `Gen ${item.generation}` : "—"}</td>
                {canWrite ? (
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-0.5">
                    <IconAction
                      label="Editar procesador"
                      icon="edit"
                      onClick={() => openModal("processor", { id: item.id, name: item.name, generation: item.generation })}
                    />
                    <IconAction label="Eliminar procesador" icon="delete" onClick={() => deleteItem("processors", item.id)} />
                  </div>
                </td>
                ) : null}
              </CatalogRow>
            ))}
          </CatalogTable>
        ) : (
          <CatalogEmptyState
            icon={Cpu}
            title={search ? "Sin resultados" : meta.emptyTitle}
            description={search ? "Prueba con otro término de búsqueda." : meta.emptyDescription}
            actionLabel={canWrite ? meta.actionLabel : undefined}
            onAction={canWrite ? () => openModal("processor") : undefined}
          />
        )}
      </div>
    );
  };

  const renderRamStorage = (items: Array<{ id: number; label: string; sizeGb: number }>, type: "ram" | "storage") => {
    const meta = tabMeta[type];
    const Icon = type === "ram" ? MemoryStick : HardDrive;

    return (
      <div className="space-y-5">
        <CatalogToolbar
          title={meta.title}
          description={meta.description}
          count={type === "ram" ? ramOptions.length : storageOptions.length}
          countLabel={meta.countLabel}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={meta.searchPlaceholder}
          actionLabel={canWrite ? meta.actionLabel : undefined}
          onAction={canWrite ? () => openModal(type) : undefined}
        />
        {loading ? (
          <CatalogLoading />
        ) : items.length > 0 ? (
          <CatalogTable
            columns={[
              { key: "label", label: "Etiqueta" },
              { key: "size", label: "Capacidad", align: "center", className: "w-32" },
              ...(canWrite ? [{ key: "actions", label: "Acciones", align: "right" as const, className: "w-28" }] : []),
            ]}
          >
            {items.map((item) => (
              <CatalogRow key={item.id}>
                <td className="px-4 py-3 font-medium text-on-surface">{item.label}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex rounded-full bg-tertiary-container px-2.5 py-0.5 text-xs font-semibold text-on-tertiary-container">
                    {formatGb(item.sizeGb)}
                  </span>
                </td>
                {canWrite ? (
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-0.5">
                    <IconAction
                      label="Editar opción"
                      icon="edit"
                      onClick={() => openModal(type, { id: item.id, label: item.label, sizeGb: item.sizeGb })}
                    />
                    <IconAction label="Eliminar opción" icon="delete" onClick={() => deleteItem(type, item.id)} />
                  </div>
                </td>
                ) : null}
              </CatalogRow>
            ))}
          </CatalogTable>
        ) : (
          <CatalogEmptyState
            icon={Icon}
            title={search ? "Sin resultados" : meta.emptyTitle}
            description={search ? "Prueba con otro término de búsqueda." : meta.emptyDescription}
            actionLabel={canWrite ? meta.actionLabel : undefined}
            onAction={canWrite ? () => openModal(type) : undefined}
          />
        )}
      </div>
    );
  };

  const renderAssetTypes = () => {
    const meta = tabMeta["asset-types"];

    return (
      <div className="space-y-5">
        <CatalogToolbar
          title={meta.title}
          description={meta.description}
          count={assetTypes.length}
          countLabel={meta.countLabel}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={meta.searchPlaceholder}
          actionLabel={canWrite ? meta.actionLabel : undefined}
          onAction={canWrite ? () => openModal("asset-type") : undefined}
        />
        {loading ? (
          <CatalogLoading />
        ) : filteredAssetTypes.length > 0 ? (
          <CatalogTable
            columns={[
              { key: "name", label: "Tipo" },
              { key: "years", label: "Vida útil", align: "center", className: "w-28" },
              ...(canWrite ? [{ key: "actions", label: "Acciones", align: "right" as const, className: "w-28" }] : []),
            ]}
          >
            {filteredAssetTypes.map((at) => (
              <CatalogRow key={at.id}>
                <td className="px-4 py-3 font-medium text-on-surface">{at.name}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex rounded-full bg-primary-container px-2.5 py-0.5 text-xs font-semibold text-on-primary-container">
                    {at.usefulLifeYears} años
                  </span>
                </td>
                {canWrite ? (
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-0.5">
                    <IconAction
                      label="Editar tipo"
                      icon="edit"
                      onClick={() =>
                        openModal("asset-type", {
                          id: at.id,
                          name: at.name,
                          usefulLifeYears: at.usefulLifeYears,
                          depreciationRate: at.depreciationRate ?? 0.3,
                        })
                      }
                    />
                    <IconAction label="Eliminar tipo" icon="delete" onClick={() => deleteItem("asset-types", at.id)} />
                  </div>
                </td>
                ) : null}
              </CatalogRow>
            ))}
          </CatalogTable>
        ) : (
          <CatalogEmptyState
            icon={Layers}
            title={search ? "Sin resultados" : meta.emptyTitle}
            description={search ? "Prueba con otro término de búsqueda." : meta.emptyDescription}
            actionLabel={canWrite ? meta.actionLabel : undefined}
            onAction={canWrite ? () => openModal("asset-type") : undefined}
          />
        )}
      </div>
    );
  };

  const modalTitle = () => {
    const isEdit = !!modal?.item?.id;
    const labels: Record<string, string> = {
      location: "Ubicación",
      brand: "Marca",
      model: "Modelo",
      processor: "Procesador",
      ram: "RAM",
      storage: "Almacenamiento",
      "asset-type": "Tipo de Activo",
    };
    return `${isEdit ? "Editar" : "Nuevo"} ${labels[modal?.type ?? ""] ?? ""}`;
  };

  const needsSize = modal?.type === "ram" || modal?.type === "storage";
  const needsYears = modal?.type === "asset-type";
  const needsGeneration = modal?.type === "processor";
  const needsParent = modal?.type === "location";
  const needsBrand = modal?.type === "model";
  const editingLocationId = typeof modal?.item?.id === "number" ? modal.item.id : null;
  const blockedParentIds = editingLocationId ? collectDescendantIds(editingLocationId, locations) : new Set<number>();
  const parentOptions = buildLocationOptions(locations).filter((option) => !blockedParentIds.has(option.id));

  return (
    <section className="animate-fade-in space-y-5">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
          <Settings2 size={22} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Configuración ITAM</h2>
          <p className="text-sm text-on-surface-variant">
            Catálogos de ubicaciones, marcas, hardware y tipos de activo.
          </p>
        </div>
      </header>

      <nav
        className="flex gap-1 overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-low p-1.5"
        aria-label="Secciones de configuración ITAM"
      >
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
              tab === key
                ? "bg-primary-container text-on-primary-container shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 md:p-6">
        {tab === "import" ? (
          <AssetImportTab onImportComplete={onImportComplete} />
        ) : (
          <>
            {tab === "locations" && renderLocations()}
            {tab === "brands" && renderBrands()}
            {tab === "processors" && renderProcessors()}
            {tab === "ram" && renderRamStorage(filteredRam, "ram")}
            {tab === "storage" && renderRamStorage(filteredStorage, "storage")}
            {tab === "asset-types" && renderAssetTypes()}
          </>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-4 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-xl animate-scale-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="itam-modal-title"
          >
            <h3 id="itam-modal-title" className="mb-1 text-lg font-bold text-on-surface">
              {modalTitle()}
            </h3>
            <p className="mb-5 text-sm text-on-surface-variant">Completa los campos y guarda los cambios.</p>

            <div className="space-y-4">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-on-surface">{needsSize ? "Etiqueta" : "Nombre"}</span>
                <input className={inputCls} value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus />
              </label>

              {needsGeneration && (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-on-surface">Generación (opcional)</span>
                  <input
                    className={inputCls}
                    value={formGeneration}
                    onChange={(e) => setFormGeneration(e.target.value)}
                    placeholder="13, 14, Ryzen 7000…"
                  />
                </label>
              )}

              {needsParent && (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-on-surface">Ubicación padre (opcional)</span>
                  <select
                    className={inputCls}
                    value={formParentId}
                    onChange={(e) => setFormParentId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">— Raíz —</option>
                    {parentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {needsBrand && (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-on-surface">Marca</span>
                  <select
                    className={inputCls}
                    value={formBrandId}
                    onChange={(e) => setFormBrandId(Number(e.target.value))}
                    required
                  >
                    <option value="">Seleccionar marca</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {needsSize && (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-on-surface">Tamaño (GB)</span>
                  <input
                    type="number"
                    className={inputCls}
                    value={formSizeGb}
                    onChange={(e) => setFormSizeGb(e.target.value ? Number(e.target.value) : "")}
                    min={1}
                  />
                </label>
              )}

              {needsYears && (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-on-surface">Vida útil (años)</span>
                  <input
                    type="number"
                    className={inputCls}
                    value={formYears}
                    onChange={(e) => setFormYears(e.target.value ? Number(e.target.value) : "")}
                    min={1}
                    max={100}
                    placeholder="5"
                  />
                </label>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={closeModal} className={btnSecondary}>
                Cancelar
              </button>
              <button type="button" onClick={saveItem} disabled={saving || !formName.trim()} className={btnPrimary}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
