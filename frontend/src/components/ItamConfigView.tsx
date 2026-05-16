import { useEffect, useState } from "react";
import { Settings2, Plus, Pencil, Trash2, MapPin, Cpu, HardDrive, MemoryStick, Monitor, Layers, FileUp } from "lucide-react";
import { AssetImportTab } from "./AssetImportTab";
import { api } from "../lib/api";
import { notify } from "../lib/toast";
import { AssetType } from "../types";

/* ─── Types ─── */
type Location = { id: number; name: string; parentId: number | null; isActive: boolean; parent?: { id: number; name: string } | null; children?: Location[] };
type Brand = { id: number; name: string; isActive: boolean; models: Model[] };
type Model = { id: number; name: string; brandId: number; isActive: boolean; brand?: Brand };
type Processor = { id: number; name: string; isActive: boolean };
type RamOption = { id: number; label: string; sizeGb: number; isActive: boolean };
type StorageOption = { id: number; label: string; sizeGb: number; isActive: boolean };
type Tab = "locations" | "brands" | "processors" | "ram" | "storage" | "asset-types" | "import";

const tabs: { key: Tab; label: string; icon: typeof MapPin }[] = [
  { key: "locations",   label: "Ubicaciones",      icon: MapPin },
  { key: "brands",      label: "Marcas / Modelos",  icon: Monitor },
  { key: "processors",  label: "Procesadores",      icon: Cpu },
  { key: "ram",         label: "RAM",               icon: MemoryStick },
  { key: "storage",     label: "Almacenamiento",    icon: HardDrive },
  { key: "asset-types", label: "Tipo de Activo",    icon: Layers },
  { key: "import",      label: "Importar",          icon: FileUp },
];

const inputCls = "w-full rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-1 ring-primary";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60 transition";
const btnSecondary = "inline-flex items-center gap-1.5 rounded-xl border border-border-light dark:border-border-dark px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-lighter transition";

export const ItamConfigView = () => {
  const [tab, setTab] = useState<Tab>("locations");
  const [locations, setLocations] = useState<Location[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [processors, setProcessors] = useState<Processor[]>([]);
  const [ramOptions, setRamOptions] = useState<RamOption[]>([]);
  const [storageOptions, setStorageOptions] = useState<StorageOption[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [loading, setLoading] = useState(false);

  /* modal state */
  const [modal, setModal] = useState<{ type: string; item?: Record<string, unknown> } | null>(null);
  const [formName, setFormName] = useState("");
  const [formParentId, setFormParentId] = useState<number | "">("");
  const [formBrandId, setFormBrandId] = useState<number | "">("");
  const [formSizeGb, setFormSizeGb] = useState<number | "">("");
  const [formYears, setFormYears] = useState<number | "">("");
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

  useEffect(() => { load(); loadAssetTypes(); }, []);


  const openModal = (type: string, item?: Record<string, unknown>) => {
    setFormName((item?.name as string) ?? (item?.label as string) ?? "");
    setFormParentId((item?.parentId as number) ?? "");
    setFormBrandId((item?.brandId as number) ?? "");
    setFormSizeGb((item?.sizeGb as number) ?? "");
    setFormYears((item?.usefulLifeYears as number) ?? "");
    setModal({ type, item });
  };

  const closeModal = () => { setModal(null); setSaving(false); };

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
          const body = { name: formName };
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
          const body = { name: formName, usefulLifeYears: Number(formYears) || 5 };
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
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Error al guardar";
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
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "No se pudo eliminar";
      notify.error("Config ITAM", msg);
    }
  };

  /* ─── Render Helpers ─── */

  const renderLocations = () => {
    const roots = locations.filter((l) => !l.parentId);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">{locations.length} ubicacion(es)</p>
          <button className={btnPrimary} onClick={() => openModal("location")}><Plus size={15} /> Nueva Ubicación</button>
        </div>
        {roots.map((loc) => (
          <div key={loc.id} className="rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2"><MapPin size={14} className="text-primary" /> {loc.name}</span>
              <div className="flex gap-1">
                <button onClick={() => openModal("location", { id: loc.id, name: loc.name, parentId: loc.parentId })} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-primary transition"><Pencil size={14} /></button>
                <button onClick={() => openModal("location", { parentId: loc.id })} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-emerald-500 transition" title="Agregar sub-ubicación"><Plus size={14} /></button>
                <button onClick={() => deleteItem("locations", loc.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
              </div>
            </div>
            {loc.children && loc.children.length > 0 && (
              <div className="ml-6 mt-2 space-y-1 border-l-2 border-primary/20 pl-3">
                {loc.children.map((child) => (
                  <div key={child.id} className="flex items-center justify-between py-1">
                    <span className="text-sm text-slate-700 dark:text-slate-300">{child.name}</span>
                    <div className="flex gap-1">
                      <button onClick={() => openModal("location", { id: child.id, name: child.name, parentId: child.parentId })} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-primary transition"><Pencil size={12} /></button>
                      <button onClick={() => deleteItem("locations", child.id)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-red-500 transition"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {roots.length === 0 && !loading && <p className="py-8 text-center text-sm text-slate-400">No hay ubicaciones. Crea la primera.</p>}
      </div>
    );
  };

  const renderBrands = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{brands.length} marca(s)</p>
        <button className={btnPrimary} onClick={() => openModal("brand")}><Plus size={15} /> Nueva Marca</button>
      </div>
      {brands.map((brand) => (
        <div key={brand.id} className="rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-900 dark:text-white">{brand.name}</span>
            <div className="flex gap-1">
              <button onClick={() => openModal("brand", { id: brand.id, name: brand.name })} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-primary transition"><Pencil size={14} /></button>
              <button onClick={() => openModal("model", { brandId: brand.id })} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-emerald-500 transition" title="Agregar modelo"><Plus size={14} /></button>
              <button onClick={() => deleteItem("brands", brand.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
            </div>
          </div>
          {brand.models.length > 0 && (
            <div className="ml-6 mt-2 space-y-1 border-l-2 border-primary/20 pl-3">
              {brand.models.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-1">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{m.name}</span>
                  <div className="flex gap-1">
                    <button onClick={() => openModal("model", { id: m.id, name: m.name, brandId: m.brandId })} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-primary transition"><Pencil size={12} /></button>
                    <button onClick={() => deleteItem("models", m.id)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-red-500 transition"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {brands.length === 0 && !loading && <p className="py-8 text-center text-sm text-slate-400">No hay marcas. Crea la primera.</p>}
    </div>
  );

  const renderSimpleList = (items: Array<{ id: number; name?: string; label?: string }>, type: string, singular: string) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{items.length} {singular}(s)</p>
        <button className={btnPrimary} onClick={() => openModal(type)}><Plus size={15} /> Nuevo</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-4 py-3">
            <span className="text-sm text-slate-900 dark:text-white">{item.name ?? item.label}</span>
            <div className="flex gap-1">
              <button onClick={() => openModal(type, { id: item.id, name: item.name, label: item.label, ...(item as Record<string, unknown>) })} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-primary transition"><Pencil size={14} /></button>
              <button onClick={() => deleteItem(`${type}s` === "processorss" ? "processors" : `${type}s` === "rams" ? "ram" : `${type}s` === "storages" ? "storage" : `${type}s`, item.id)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 && !loading && <p className="py-8 text-center text-sm text-slate-400">No hay {singular}s. Crea el primero.</p>}
    </div>
  );

  const renderRamStorage = (items: Array<{ id: number; label: string; sizeGb: number }>, type: "ram" | "storage", singular: string) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{items.length} opcion(es)</p>
        <button className={btnPrimary} onClick={() => openModal(type)}><Plus size={15} /> Nuevo</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-4 py-3">
            <div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</span>
              <span className="ml-2 text-xs text-slate-400">{item.sizeGb} GB</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openModal(type, { id: item.id, label: item.label, sizeGb: item.sizeGb })} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-primary transition"><Pencil size={14} /></button>
              <button onClick={() => deleteItem(type, item.id)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 && !loading && <p className="py-8 text-center text-sm text-slate-400">No hay opciones de {singular}. Crea la primera.</p>}
    </div>
  );

  const renderAssetTypes = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{assetTypes.length} tipo(s) de activo</p>
        <button className={btnPrimary} onClick={() => openModal("asset-type")}><Plus size={15} /> Nuevo Tipo</button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-light dark:border-border-dark text-left">
            <th className="pb-2 font-medium text-slate-500 dark:text-slate-400">Nombre</th>
            <th className="pb-2 font-medium text-slate-500 dark:text-slate-400 text-center">Vida Útil (años)</th>
            <th className="pb-2 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light dark:divide-border-dark">
          {assetTypes.map((at) => (
            <tr key={at.id} className="hover:bg-slate-50 dark:hover:bg-surface-lighter transition">
              <td className="py-3 font-medium text-slate-900 dark:text-white">{at.name}</td>
              <td className="py-3 text-center">
                <span className="inline-flex items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-sm px-3 py-0.5">
                  {at.usefulLifeYears} años
                </span>
              </td>
              <td className="py-3">
                <div className="flex gap-1 justify-end">
                  <button onClick={() => openModal("asset-type", { id: at.id, name: at.name, usefulLifeYears: at.usefulLifeYears })} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-primary transition"><Pencil size={14} /></button>
                  <button onClick={() => deleteItem("asset-types", at.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-lighter text-slate-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {assetTypes.length === 0 && !loading && <p className="py-8 text-center text-sm text-slate-400">No hay tipos de activo. Crea el primero.</p>}
    </div>
  );

  const modalTitle = () => {
    const isEdit = !!modal?.item?.id;
    const labels: Record<string, string> = { location: "Ubicación", brand: "Marca", model: "Modelo", processor: "Procesador", ram: "RAM", storage: "Almacenamiento", "asset-type": "Tipo de Activo" };
    return `${isEdit ? "Editar" : "Nuevo"} ${labels[modal?.type ?? ""] ?? ""}`;
  };

  const needsSize   = modal?.type === "ram" || modal?.type === "storage";
  const needsYears  = modal?.type === "asset-type";
  const needsParent = modal?.type === "location";
  const needsBrand  = modal?.type === "model";

  return (
    <section className="animate-fade-in space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Settings2 size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Configuración ITAM</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Catálogos de ubicaciones, marcas, modelos, procesadores, RAM y almacenamiento.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-1.5 shadow-card overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${
              tab === key
                ? "bg-primary text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-lighter"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-5 shadow-card">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
            Cargando catálogos...
          </div>
        ) : (
          <>
            {tab === "locations"   && renderLocations()}
            {tab === "brands"      && renderBrands()}
            {tab === "processors"  && renderSimpleList(processors, "processor", "procesador")}
            {tab === "ram"         && renderRamStorage(ramOptions, "ram", "RAM")}
            {tab === "storage"     && renderRamStorage(storageOptions, "storage", "almacenamiento")}
            {tab === "asset-types" && renderAssetTypes()}
            {tab === "import"      && <AssetImportTab />}
          </>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-6 shadow-xl animate-scale-in">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{modalTitle()}</h3>

            <div className="space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-700 dark:text-slate-300">{needsSize ? "Etiqueta" : "Nombre"}</span>
                <input className={inputCls} value={formName} onChange={(e) => setFormName(e.target.value)} autoFocus />
              </label>

              {needsParent && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">Ubicación padre (opcional)</span>
                  <select className={inputCls} value={formParentId} onChange={(e) => setFormParentId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">— Raíz —</option>
                    {locations.filter((l) => !l.parentId && l.id !== modal.item?.id).map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </label>
              )}

              {needsBrand && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">Marca</span>
                  <select className={inputCls} value={formBrandId} onChange={(e) => setFormBrandId(Number(e.target.value))} required>
                    <option value="">Seleccionar marca</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </label>
              )}

              {needsSize && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">Tamaño (GB)</span>
                  <input type="number" className={inputCls} value={formSizeGb} onChange={(e) => setFormSizeGb(e.target.value ? Number(e.target.value) : "")} min={1} />
                </label>
              )}

              {needsYears && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">Vida útil (años)</span>
                  <input type="number" className={inputCls} value={formYears} onChange={(e) => setFormYears(e.target.value ? Number(e.target.value) : "")} min={1} max={100} placeholder="5" />
                </label>
              )}
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={closeModal} className={btnSecondary}>Cancelar</button>
              <button onClick={saveItem} disabled={saving || !formName.trim()} className={btnPrimary}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
