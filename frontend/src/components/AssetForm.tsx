import { FormEvent, useEffect, useState } from "react";
import { Save, XCircle, PackagePlus, CalendarDays, AlertTriangle } from "lucide-react";
import { Asset, AssetStatus, AssetType, StorageType } from "../types";
import { api } from "../lib/api";

type CatalogBrand = { id: number; name: string; models: { id: number; name: string }[] };
type CatalogProcessor = { id: number; name: string };
type CatalogRam = { id: number; label: string; sizeGb: number };
type CatalogStorage = { id: number; label: string; sizeGb: number };
type Location = { id: number; name: string; parentId: number | null; children?: Location[] };

const storageTypeLabels: Record<StorageType, string> = {
  SSD: "SSD", HDD: "HDD", NVME: "NVMe",
};

type SubmitPayload = {
  brand: string;
  model: string;
  serialNumber: string;
  equipmentValue?: number | null;
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
};

type Props = {
  initialAsset?: Asset | null;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  onCancel: () => void;
};

const inputCls = "rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none ring-primary focus:ring-1";

export const AssetForm = ({ initialAsset, onSubmit, onCancel }: Props) => {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [status, setStatus] = useState<AssetStatus>("AVAILABLE");
  const [equipmentValue, setEquipmentValue] = useState<number | "">("");
  const [assetTypeId, setAssetTypeId] = useState<number | "">("");
  const [processor, setProcessor] = useState("");
  const [ramGb, setRamGb] = useState<number | "">("");
  const [storageGb, setStorageGb] = useState<number | "">("");
  const [storageType, setStorageType] = useState<StorageType | "">("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyEnd, setWarrantyEnd] = useState("");
  const [usefulLifeYears, setUsefulLifeYears] = useState<number | "">("");
  const [locationRootId, setLocationRootId] = useState<number | "">("");
  const [locationId, setLocationId] = useState<number | "">("");
  const [assignedToName, setAssignedToName] = useState("");
  const [assignedToDate, setAssignedToDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /* Catalogs */
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [processors, setProcessors] = useState<CatalogProcessor[]>([]);
  const [ramOptions, setRamOptions] = useState<CatalogRam[]>([]);
  const [storageOptions, setStorageOptions] = useState<CatalogStorage[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);

  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [br, pr, ra, st, loc, at] = await Promise.all([
          api.get<{ brands: CatalogBrand[] }>("/itam-config/brands"),
          api.get<{ processors: CatalogProcessor[] }>("/itam-config/processors"),
          api.get<{ ram: CatalogRam[] }>("/itam-config/ram"),
          api.get<{ storage: CatalogStorage[] }>("/itam-config/storage"),
          api.get<{ locations: Location[] }>("/itam-config/locations"),
          api.get<{ assetTypes: AssetType[] }>("/itam-config/asset-types"),
        ]);
        setBrands(br.data.brands);
        setProcessors(pr.data.processors);
        setRamOptions(ra.data.ram);
        setStorageOptions(st.data.storage);
        setLocations(loc.data.locations);
        setAssetTypes(at.data.assetTypes);
      } catch { /* ignore */ }
    };
    loadCatalogs();
  }, []);

  useEffect(() => {
    if (initialAsset) {
      setBrand(initialAsset.brand);
      setModel(initialAsset.model);
      setSerialNumber(initialAsset.serialNumber);
      setEquipmentValue(initialAsset.equipmentValue ?? "");
      setStatus(initialAsset.status);
      setAssetTypeId(initialAsset.assetTypeId ?? "");
      setProcessor(initialAsset.processor ?? "");
      setRamGb(initialAsset.ramGb ?? "");
      setStorageGb(initialAsset.storageGb ?? "");
      setStorageType(initialAsset.storageType ?? "");
      setPurchaseDate(initialAsset.purchaseDate ? initialAsset.purchaseDate.split("T")[0] : "");
      setWarrantyEnd(initialAsset.warrantyEnd ? initialAsset.warrantyEnd.split("T")[0] : "");
      setUsefulLifeYears(initialAsset.usefulLifeYears ?? "");
      setLocationRootId(initialAsset.location?.parentId ?? "");
      setLocationId(initialAsset.locationId ?? "");
      setAssignedToName(initialAsset.assignedToName ?? "");
      setAssignedToDate(initialAsset.assignedToDate ? initialAsset.assignedToDate.split("T")[0] : "");
    } else {
      setBrand("");
      setModel("");
      setSerialNumber("");
      setEquipmentValue("");
      setStatus("AVAILABLE");
      setAssetTypeId("");
      setProcessor("");
      setRamGb("");
      setStorageGb("");
      setStorageType("");
      setPurchaseDate("");
      setWarrantyEnd("");
      setUsefulLifeYears("");
      setLocationRootId("");
      setLocationId("");
      setAssignedToName("");
      setAssignedToDate("");
    }
  }, [initialAsset]);

  /* Useful life comes directly from the selected asset type (read-only) */
  const selectedAssetType = assetTypes.find((at) => at.id === Number(assetTypeId));
  const effectiveUsefulLife = selectedAssetType?.usefulLifeYears ?? (usefulLifeYears || 5);

  const computedEndOfLife = purchaseDate
    ? (() => {
        const d = new Date(purchaseDate);
        d.setFullYear(d.getFullYear() + effectiveUsefulLife);
        return d;
      })()
    : null;

  const isExpiringSoon = computedEndOfLife && computedEndOfLife <= new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  /* Models filtered by selected brand */
  const selectedBrandObj = brands.find((b) => b.name === brand);
  const filteredModels = selectedBrandObj?.models ?? [];

  /* Location cascade — root locations for grouping, children are assignable */
  const rootLocations = locations.filter((l) => !l.parentId);
  const selectedRoot = rootLocations.find((r) => r.id === Number(locationRootId));
  const childLocations = selectedRoot?.children ?? [];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        brand, model, serialNumber, status,
        assetTypeId: assetTypeId || null,
        equipmentValue: equipmentValue || null,
        processor: processor || null,
        ramGb: ramGb || null,
        storageGb: storageGb || null,
        storageType: storageType || null,
        purchaseDate: purchaseDate || null,
        warrantyEnd: warrantyEnd || null,
        usefulLifeYears: effectiveUsefulLife || null,
        locationId: locationId || null,
        assignedToName: assignedToName || null,
        assignedToDate: assignedToDate || null,
        specifications: {},
      });
    } catch (_error) {
      setError("Revisa los campos. Si usas Specs JSON, debe ser un objeto válido.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-6 shadow-card transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <PackagePlus size={20} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{initialAsset ? "Editar Activo" : "Alta de Activo"}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Formulario ITAM con campos estructurados.</p>
        </div>
      </div>

      {/* ── Section: Identificación ── */}
      <h3 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Identificación</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Tipo de activo</span>
          <select className={inputCls} value={assetTypeId} onChange={(e) => { setAssetTypeId(e.target.value ? Number(e.target.value) : ""); setUsefulLifeYears(""); }}>
            <option value="">— Sin tipo —</option>
            {assetTypes.map((at) => <option key={at.id} value={at.id}>{at.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Marca</span>
          {brands.length > 0 ? (
            <select className={inputCls} value={brand} onChange={(e) => { setBrand(e.target.value); setModel(""); }} required>
              <option value="">Seleccionar</option>
              {brands.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
          ) : (
            <input className={inputCls} value={brand} onChange={(e) => setBrand(e.target.value)} required placeholder="Ej: Dell" />
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Modelo</span>
          {filteredModels.length > 0 ? (
            <select className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} required>
              <option value="">Seleccionar</option>
              {filteredModels.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          ) : (
            <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} required placeholder="Ej: Latitude 5540" />
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Número de Serie</span>
          <input className={inputCls} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Valor del equipo (MXN)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className={inputCls}
            value={equipmentValue}
            onChange={(e) => setEquipmentValue(e.target.value ? Number(e.target.value) : "")}
            placeholder="Ej: 18500.00"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Estado</span>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as AssetStatus)}>
            <option value="AVAILABLE">Disponible</option>
            <option value="ASSIGNED">Asignado</option>
            <option value="MAINTENANCE">Mantenimiento</option>
            <option value="SCRAP">Scrap</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Zona / Área</span>
          <select
            className={inputCls}
            value={locationRootId}
            onChange={(e) => {
              setLocationRootId(e.target.value ? Number(e.target.value) : "");
              setLocationId("");
            }}
          >
            <option value="">— Sin zona —</option>
            {rootLocations.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Ubicación</span>
          <select
            className={inputCls}
            value={locationId}
            onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : "")}
            disabled={!locationRootId}
          >
            <option value="">— Seleccionar ubicación —</option>
            {childLocations.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {locationRootId && childLocations.length === 0 && (
            <span className="text-[11px] text-slate-400">Esta zona no tiene sub-ubicaciones.</span>
          )}
        </label>
      </div>

      {/* ── Section: Responsable / Asignación ── */}
      <h3 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Responsable</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Nombre del responsable</span>
          <input className={inputCls} value={assignedToName} onChange={(e) => setAssignedToName(e.target.value)} placeholder="Ej: Juan Pérez García" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Fecha de asignación</span>
          <input type="date" className={inputCls} value={assignedToDate} onChange={(e) => setAssignedToDate(e.target.value)} />
        </label>
      </div>

      {/* ── Section: Especificaciones técnicas ── */}
      <h3 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Especificaciones técnicas</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Procesador</span>
          {processors.length > 0 ? (
            <select className={inputCls} value={processor} onChange={(e) => setProcessor(e.target.value)}>
              <option value="">Seleccionar</option>
              {processors.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          ) : (
            <input className={inputCls} value={processor} onChange={(e) => setProcessor(e.target.value)} placeholder="Ej: Intel Core i7-1365U" />
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">RAM (GB)</span>
          {ramOptions.length > 0 ? (
            <select className={inputCls} value={ramGb} onChange={(e) => setRamGb(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Seleccionar</option>
              {ramOptions.map((r) => <option key={r.id} value={r.sizeGb}>{r.label}</option>)}
            </select>
          ) : (
            <input type="number" className={inputCls} value={ramGb} onChange={(e) => setRamGb(e.target.value ? Number(e.target.value) : "")} min={1} placeholder="16" />
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Almacenamiento (GB)</span>
          {storageOptions.length > 0 ? (
            <select className={inputCls} value={storageGb} onChange={(e) => setStorageGb(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Seleccionar</option>
              {storageOptions.map((s) => <option key={s.id} value={s.sizeGb}>{s.label}</option>)}
            </select>
          ) : (
            <input type="number" className={inputCls} value={storageGb} onChange={(e) => setStorageGb(e.target.value ? Number(e.target.value) : "")} min={1} placeholder="512" />
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Tipo almacenamiento</span>
          <select className={inputCls} value={storageType} onChange={(e) => setStorageType(e.target.value as StorageType | "")}>
            <option value="">— N/A —</option>
            {(Object.keys(storageTypeLabels) as StorageType[]).map((st) => (
              <option key={st} value={st}>{storageTypeLabels[st]}</option>
            ))}
          </select>
        </label>
      </div>

      {/* ── Section: Ciclo de vida ── */}
      <h3 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Ciclo de vida</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Fecha de compra</span>
          <div className="relative">
            <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input type="date" className={`${inputCls} pl-9`} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Fin de garantía</span>
          <input type="date" className={inputCls} value={warrantyEnd} onChange={(e) => setWarrantyEnd(e.target.value)} />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Vida útil (años)</span>
          <div className="flex items-center gap-2 rounded-lg border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark px-3 py-2">
            <span className="text-slate-900 dark:text-slate-100 font-semibold tabular-nums">
              {effectiveUsefulLife}
            </span>
            <span className="text-xs text-slate-400">años</span>
            {!assetTypeId && (
              <span className="ml-auto text-[10px] text-slate-400 italic">Selecciona un tipo de activo</span>
            )}
          </div>
          {selectedAssetType && (
            <span className="text-[10px] text-slate-400">Según tipo "{selectedAssetType.name}"</span>
          )}
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-slate-700 dark:text-slate-300">Fin de vida estimado</span>
          <div className={`rounded-lg border px-3 py-2 text-sm ${
            isExpiringSoon
              ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
              : "border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark text-slate-600 dark:text-slate-300"
          }`}>
            {computedEndOfLife ? (
              <span className="flex items-center gap-1.5">
                {isExpiringSoon && <AlertTriangle size={14} />}
                {computedEndOfLife.toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" })}
              </span>
            ) : (
              <span className="text-slate-400">Sin fecha de compra</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60 transition">
          <Save size={15} />
          {saving ? "Guardando..." : initialAsset ? "Actualizar Activo" : "Crear Activo"}
        </button>
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-xl border border-border-light dark:border-border-dark px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-lighter transition">
          <XCircle size={15} />
          Cancelar
        </button>
      </div>
      {error ? <p className="mt-3 text-xs text-red-600 dark:text-red-300">{error}</p> : null}
    </form>
  );
};
