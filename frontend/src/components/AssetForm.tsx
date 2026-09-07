import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Save, XCircle, PackagePlus, CalendarDays, AlertTriangle,
  DollarSign, Tag, UserCheck, Cpu, Layers, Activity,
} from "lucide-react";
import { Asset, AssetStatus, AssetType, StorageType } from "../types";
import { api } from "../lib/api";
import { buildLocationOptions } from "../lib/locations";
import { formatProcessorLabel } from "../lib/processors";
import {
  AssetPanel,
  AssetPageHeader,
  AssetSection,
  AssetStatusBadge,
  FormActions,
  FormField,
  ReadonlyMetric,
  btnPrimary,
  btnSecondary,
  inputCls,
  formatDateMx,
} from "./assets/AssetUi";

type CatalogBrand = { id: number; name: string; models: { id: number; name: string }[] };
type CatalogProcessor = { id: number; name: string; generation?: string | null };
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
};

type Props = {
  initialAsset?: Asset | null;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  onCancel: () => void;
};

export const AssetForm = ({ initialAsset, onSubmit, onCancel }: Props) => {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [status, setStatus] = useState<AssetStatus>("AVAILABLE");
  const [purchasePrice, setPurchasePrice] = useState<number | "">("");
  const [salvageValue, setSalvageValue] = useState<number | "">("");
  const [assetTypeId, setAssetTypeId] = useState<number | "">("");
  const [processor, setProcessor] = useState("");
  const [ramGb, setRamGb] = useState<number | "">("");
  const [storageGb, setStorageGb] = useState<number | "">("");
  const [storageType, setStorageType] = useState<StorageType | "">("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyEnd, setWarrantyEnd] = useState("");
  const [usefulLifeYears, setUsefulLifeYears] = useState<number | "">("");
  const [locationId, setLocationId] = useState<number | "">("");
  const [assignedToName, setAssignedToName] = useState("");
  const [assignedToDate, setAssignedToDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [processors, setProcessors] = useState<CatalogProcessor[]>([]);
  const [ramOptions, setRamOptions] = useState<CatalogRam[]>([]);
  const [storageOptions, setStorageOptions] = useState<CatalogStorage[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);

  useEffect(() => {
    const loadCatalogs = async () => {
      setCatalogLoading(true);
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
      } catch {
        /* ignore */
      } finally {
        setCatalogLoading(false);
      }
    };
    loadCatalogs();
  }, []);

  useEffect(() => {
    if (initialAsset) {
      setBrand(initialAsset.brand);
      setModel(initialAsset.model);
      setSerialNumber(initialAsset.serialNumber);
      setPurchasePrice(initialAsset.purchasePrice ?? initialAsset.equipmentValue ?? "");
      setSalvageValue(initialAsset.salvageValue ?? "");
      setStatus(initialAsset.status);
      setAssetTypeId(initialAsset.assetTypeId ?? "");
      setProcessor(initialAsset.processor ?? "");
      setRamGb(initialAsset.ramGb ?? "");
      setStorageGb(initialAsset.storageGb ?? "");
      setStorageType(initialAsset.storageType ?? "");
      setPurchaseDate(initialAsset.purchaseDate ? initialAsset.purchaseDate.split("T")[0] : "");
      setWarrantyEnd(initialAsset.warrantyEnd ? initialAsset.warrantyEnd.split("T")[0] : "");
      setUsefulLifeYears(initialAsset.usefulLifeYears ?? "");
      setLocationId(initialAsset.locationId ?? "");
      setAssignedToName(initialAsset.assignedToName ?? "");
      setAssignedToDate(initialAsset.assignedToDate ? initialAsset.assignedToDate.split("T")[0] : "");
    } else {
      setBrand("");
      setModel("");
      setSerialNumber("");
      setPurchasePrice("");
      setSalvageValue("");
      setStatus("AVAILABLE");
      setAssetTypeId("");
      setProcessor("");
      setRamGb("");
      setStorageGb("");
      setStorageType("");
      setPurchaseDate("");
      setWarrantyEnd("");
      setUsefulLifeYears("");
      setLocationId("");
      setAssignedToName("");
      setAssignedToDate("");
    }
  }, [initialAsset]);

  const selectedAssetType = assetTypes.find((at) => at.id === Number(assetTypeId));
  const effectiveUsefulLife = selectedAssetType?.usefulLifeYears ?? (usefulLifeYears || 5);

  const computedEndOfLife = purchaseDate
    ? (() => {
        const d = new Date(purchaseDate);
        d.setFullYear(d.getFullYear() + effectiveUsefulLife);
        return d;
      })()
    : null;

  const isExpiringSoon =
    computedEndOfLife && computedEndOfLife <= new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const selectedBrandObj = brands.find((b) => b.name === brand);
  const catalogModels = selectedBrandObj?.models ?? [];
  const modelOptions = useMemo(() => {
    if (!model) return catalogModels;
    if (catalogModels.some((m) => m.name === model)) return catalogModels;
    return [{ id: -1, name: model }, ...catalogModels];
  }, [catalogModels, model]);
  const locationOptions = buildLocationOptions(locations);
  const useBrandCatalog = brands.length > 0;
  const canPickModel = useBrandCatalog && Boolean(brand);
  const brandHasModels = catalogModels.length > 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (useBrandCatalog && brand && !brandHasModels) {
      setError("La marca seleccionada no tiene modelos. Agrégalos en Configuración ITAM → Marcas / Modelos.");
      return;
    }
    if (useBrandCatalog && brand && !model) {
      setError("Selecciona un modelo de la marca elegida.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        brand,
        model,
        serialNumber,
        status,
        assetTypeId: assetTypeId || null,
        purchasePrice: purchasePrice || null,
        salvageValue: salvageValue !== "" ? salvageValue : 0,
        equipmentValue: purchasePrice || null,
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
    } catch {
      setError("No se pudo guardar el activo. Revisa los campos e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const isEdit = Boolean(initialAsset);

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in">
      <AssetPanel>
        <AssetPageHeader
          icon={PackagePlus}
          title={isEdit ? "Editar activo" : "Alta de activo"}
          subtitle={isEdit ? initialAsset?.assetCode : "Registra un nuevo equipo en el inventario ITAM"}
          badge={isEdit ? <AssetStatusBadge status={status} /> : undefined}
        />

        <div className="space-y-8">
          <AssetSection
            title="Identificación"
            description="Datos principales del equipo y su ubicación física."
            icon={Tag}
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormField label="Tipo de activo">
                <select
                  className={inputCls}
                  value={assetTypeId}
                  disabled={catalogLoading}
                  onChange={(e) => {
                    setAssetTypeId(e.target.value ? Number(e.target.value) : "");
                    setUsefulLifeYears("");
                  }}
                >
                  <option value="">— Sin tipo —</option>
                  {assetTypes.map((at) => (
                    <option key={at.id} value={at.id}>
                      {at.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Marca" required hint={useBrandCatalog ? "Catálogo ITAM — el modelo se filtra según la marca." : undefined}>
                {useBrandCatalog ? (
                  <select
                    className={inputCls}
                    value={brand}
                    disabled={catalogLoading}
                    onChange={(e) => {
                      setBrand(e.target.value);
                      setModel("");
                    }}
                    required
                  >
                    <option value="">Seleccionar marca</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className={inputCls} value={brand} onChange={(e) => setBrand(e.target.value)} required placeholder="Ej: Dell" />
                )}
              </FormField>

              <FormField
                label="Modelo"
                required
                hint={
                  !useBrandCatalog
                    ? undefined
                    : !brand
                      ? "Selecciona una marca primero."
                      : !brandHasModels
                        ? "Sin modelos en catálogo para esta marca."
                        : `${modelOptions.length} modelo(s) disponible(s).`
                }
              >
                {useBrandCatalog ? (
                  <select
                    className={inputCls}
                    value={model}
                    disabled={catalogLoading || !canPickModel || !brandHasModels}
                    onChange={(e) => setModel(e.target.value)}
                    required={canPickModel && brandHasModels}
                  >
                    <option value="">
                      {!brand
                        ? "— Elige marca —"
                        : !brandHasModels
                          ? "— Sin modelos registrados —"
                          : "Seleccionar modelo"}
                    </option>
                    {modelOptions.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                        {m.id === -1 ? " (actual)" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} required placeholder="Ej: Latitude 5540" />
                )}
              </FormField>

              <FormField label="Número de serie" required>
                <input className={`${inputCls} font-mono`} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} required />
              </FormField>

              <FormField label="Estado">
                <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as AssetStatus)}>
                  <option value="AVAILABLE">Disponible</option>
                  <option value="ASSIGNED">Asignado</option>
                  <option value="MAINTENANCE">Mantenimiento</option>
                </select>
              </FormField>

              <FormField label="Ubicación" className="md:col-span-2 lg:col-span-3" hint="Ruta completa con todos los niveles configurados.">
                <select
                  className={inputCls}
                  value={locationId}
                  disabled={catalogLoading}
                  onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">— Sin ubicación —</option>
                  {locationOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </AssetSection>

          <AssetSection title="Responsable" description="Persona asignada al equipo, si aplica." icon={UserCheck}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Nombre del responsable">
                <input className={inputCls} value={assignedToName} onChange={(e) => setAssignedToName(e.target.value)} placeholder="Ej: Juan Pérez García" />
              </FormField>
              <FormField label="Fecha de asignación">
                <input type="date" className={inputCls} value={assignedToDate} onChange={(e) => setAssignedToDate(e.target.value)} />
              </FormField>
            </div>
          </AssetSection>

          <AssetSection
            title="Especificaciones técnicas"
            description="Opcional. Deja vacío en impresoras, switches u otros equipos sin CPU/RAM/disco."
            icon={Cpu}
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FormField label="Procesador">
                {processors.length > 0 ? (
                  <select className={inputCls} value={processor} disabled={catalogLoading} onChange={(e) => setProcessor(e.target.value)}>
                    <option value="">— N/A —</option>
                    {processors.map((p) => {
                      const label = formatProcessorLabel(p);
                      return (
                        <option key={p.id} value={label}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input className={inputCls} value={processor} onChange={(e) => setProcessor(e.target.value)} placeholder="Intel Core i7-1365U" />
                )}
              </FormField>

              <FormField label="RAM">
                {ramOptions.length > 0 ? (
                  <select className={inputCls} value={ramGb} disabled={catalogLoading} onChange={(e) => setRamGb(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">— N/A —</option>
                    {ramOptions.map((r) => (
                      <option key={r.id} value={r.sizeGb}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="number" className={inputCls} value={ramGb} onChange={(e) => setRamGb(e.target.value ? Number(e.target.value) : "")} min={1} placeholder="16" />
                )}
              </FormField>

              <FormField label="Almacenamiento">
                {storageOptions.length > 0 ? (
                  <select className={inputCls} value={storageGb} disabled={catalogLoading} onChange={(e) => setStorageGb(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">— N/A —</option>
                    {storageOptions.map((s) => (
                      <option key={s.id} value={s.sizeGb}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="number" className={inputCls} value={storageGb} onChange={(e) => setStorageGb(e.target.value ? Number(e.target.value) : "")} min={1} placeholder="512" />
                )}
              </FormField>

              <FormField label="Tipo de almacenamiento">
                <select className={inputCls} value={storageType} onChange={(e) => setStorageType(e.target.value as StorageType | "")}>
                  <option value="">— N/A —</option>
                  {(Object.keys(storageTypeLabels) as StorageType[]).map((st) => (
                    <option key={st} value={st}>
                      {storageTypeLabels[st]}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </AssetSection>

          <AssetSection
            title="Valor contable"
            description="MOI sin IVA y valor de rescate del activo."
            icon={DollarSign}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="MOI — monto original (sin IVA)" hint="Costo de adquisición sin IVA.">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputCls}
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value ? Number(e.target.value) : "")}
                  placeholder="18500.00"
                />
              </FormField>
              <FormField label="Valor de rescate" hint="Valor estimado al término de la vida útil (default 0).">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputCls}
                  value={salvageValue}
                  onChange={(e) => setSalvageValue(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0"
                />
              </FormField>
            </div>
          </AssetSection>

          <AssetSection title="Ciclo de vida" description="Fechas de compra, garantía y depreciación según tipo de activo." icon={Layers}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FormField label="Fecha de compra">
                <div className="relative">
                  <CalendarDays size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input type="date" className={`${inputCls} pl-9`} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                </div>
              </FormField>

              <FormField label="Fin de garantía">
                <input type="date" className={inputCls} value={warrantyEnd} onChange={(e) => setWarrantyEnd(e.target.value)} />
              </FormField>

              <ReadonlyMetric
                label="Vida útil"
                icon={Activity}
                value={
                  <>
                    {effectiveUsefulLife} <span className="text-xs font-normal text-on-surface-variant">años</span>
                  </>
                }
                tone={selectedAssetType ? "highlight" : "default"}
              />

              <ReadonlyMetric
                label="Fin de vida estimado"
                icon={AlertTriangle}
                tone={isExpiringSoon ? "warning" : "default"}
                value={
                  computedEndOfLife ? (
                    formatDateMx(computedEndOfLife.toISOString())
                  ) : (
                    <span className="font-normal text-on-surface-variant">Sin fecha de compra</span>
                  )
                }
              />
            </div>
            {selectedAssetType ? (
              <p className="mt-2 text-xs text-on-surface-variant">Vida útil según tipo &quot;{selectedAssetType.name}&quot;</p>
            ) : (
              <p className="mt-2 text-xs text-on-surface-variant">Selecciona un tipo de activo para aplicar la vida útil del catálogo.</p>
            )}
          </AssetSection>
        </div>

        <FormActions>
          <button type="submit" disabled={saving || catalogLoading} className={btnPrimary}>
            <Save size={15} />
            {saving ? "Guardando…" : isEdit ? "Actualizar activo" : "Crear activo"}
          </button>
          <button type="button" onClick={onCancel} className={btnSecondary}>
            <XCircle size={15} />
            Cancelar
          </button>
        </FormActions>

        {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
      </AssetPanel>
    </form>
  );
};
