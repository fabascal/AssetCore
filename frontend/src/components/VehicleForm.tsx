import { FormEvent, useEffect, useState } from "react";
import {
  Save, XCircle, Truck, CalendarDays, AlertTriangle,
  DollarSign, Tag, UserCheck, MapPin, Activity, Palette, Gauge,
} from "lucide-react";
import { Vehicle, VehicleType, vehicleTypeLabels, AssetStatus } from "../types";
import { api } from "../lib/api";
import { buildLocationOptions } from "../lib/locations";
import {
  AssetPanel,
  AssetPageHeader,
  AssetSection,
  AssetStatusBadge,
  FormActions,
  FormField,
  btnPrimary,
  btnSecondary,
  inputCls,
} from "./assets/AssetUi";

type Location = { id: number; name: string; parentId: number | null; children?: Location[] };

type SubmitPayload = {
  brand: string;
  model: string;
  year?: number | null;
  color?: string | null;
  plateNumber: string;
  serialNumber?: string | null;
  engineNumber?: string | null;
  vehicleType: VehicleType;
  mileage?: number | null;
  status: AssetStatus;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  salvageValue?: number | null;
  warrantyEnd?: string | null;
  usefulLifeYears?: number | null;
  locationId?: number | null;
  assignedToName?: string | null;
  assignedToDate?: string | null;
  specifications: Record<string, string>;
};

type Props = {
  initialVehicle?: Vehicle | null;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  onCancel: () => void;
};

export const VehicleForm = ({ initialVehicle, onSubmit, onCancel }: Props) => {
  const isEdit = Boolean(initialVehicle);

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number | "">("");
  const [color, setColor] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [engineNumber, setEngineNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("SEDAN");
  const [mileage, setMileage] = useState<number | "">("");
  const [status, setStatus] = useState<AssetStatus>("AVAILABLE");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState<number | "">("");
  const [salvageValue, setSalvageValue] = useState<number | "">("");
  const [warrantyEnd, setWarrantyEnd] = useState("");
  const [usefulLifeYears, setUsefulLifeYears] = useState<number | "">(5);
  const [locationId, setLocationId] = useState<number | "">("");
  const [assignedToName, setAssignedToName] = useState("");
  const [assignedToDate, setAssignedToDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    api.get<{ locations: Location[] }>("/itam-config/locations")
      .then((res) => setLocations(res.data.locations))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!initialVehicle) return;
    setBrand(initialVehicle.brand);
    setModel(initialVehicle.model);
    setYear(initialVehicle.year ?? "");
    setColor(initialVehicle.color ?? "");
    setPlateNumber(initialVehicle.plateNumber);
    setSerialNumber(initialVehicle.serialNumber ?? "");
    setEngineNumber(initialVehicle.engineNumber ?? "");
    setVehicleType(initialVehicle.vehicleType);
    setMileage(initialVehicle.mileage ?? "");
    setStatus(initialVehicle.status);
    setPurchaseDate(initialVehicle.purchaseDate ? initialVehicle.purchaseDate.split("T")[0] : "");
    setPurchasePrice(initialVehicle.purchasePrice ?? "");
    setSalvageValue(initialVehicle.salvageValue ?? "");
    setWarrantyEnd(initialVehicle.warrantyEnd ? initialVehicle.warrantyEnd.split("T")[0] : "");
    setUsefulLifeYears(initialVehicle.usefulLifeYears ?? 5);
    setLocationId(initialVehicle.locationId ?? "");
    setAssignedToName(initialVehicle.assignedToName ?? "");
    setAssignedToDate(initialVehicle.assignedToDate ? initialVehicle.assignedToDate.split("T")[0] : "");
  }, [initialVehicle]);

  const locationOptions = buildLocationOptions(locations);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!brand.trim() || !model.trim() || !plateNumber.trim()) {
      setError("Marca, Modelo y Placa son obligatorios");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        brand: brand.trim(),
        model: model.trim(),
        year: year === "" ? null : Number(year),
        color: color.trim() || null,
        plateNumber: plateNumber.trim(),
        serialNumber: serialNumber.trim() || null,
        engineNumber: engineNumber.trim() || null,
        vehicleType,
        mileage: mileage === "" ? null : Number(mileage),
        status,
        purchaseDate: purchaseDate || null,
        purchasePrice: purchasePrice === "" ? null : Number(purchasePrice),
        salvageValue: salvageValue === "" ? 0 : Number(salvageValue),
        warrantyEnd: warrantyEnd || null,
        usefulLifeYears: usefulLifeYears === "" ? 5 : Number(usefulLifeYears),
        locationId: locationId === "" ? null : Number(locationId),
        assignedToName: assignedToName.trim() || null,
        assignedToDate: assignedToDate || null,
        specifications: {},
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <AssetPageHeader
        icon={Truck}
        title={isEdit ? `Editar ${initialVehicle?.vehicleCode}` : "Nuevo Vehiculo"}
        subtitle={isEdit ? "Actualiza los datos del vehiculo" : "Registra un vehiculo en el parque vehicular"}
        badge={isEdit ? <AssetStatusBadge status={status} /> : undefined}
      />

      <form onSubmit={handleSubmit}>
        <AssetPanel>
          {error ? (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm text-on-error-container">
              <AlertTriangle size={16} />
              {error}
            </div>
          ) : null}

          <AssetSection title="Identificacion" icon={Tag} description="Datos principales del vehiculo">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormField label="Marca" required>
                <input className={inputCls} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ej: Toyota" />
              </FormField>
              <FormField label="Modelo" required>
                <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ej: Hilux" />
              </FormField>
              <FormField label="Anio">
                <input type="number" className={inputCls} value={year} onChange={(e) => setYear(e.target.value === "" ? "" : Number(e.target.value))} placeholder="2024" min={1900} max={2100} />
              </FormField>
              <FormField label="Color" hint="Opcional">
                <input className={inputCls} value={color} onChange={(e) => setColor(e.target.value)} placeholder="Ej: Blanco" />
              </FormField>
              <FormField label="Tipo de Vehiculo">
                <select className={inputCls} value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleType)}>
                  {Object.entries(vehicleTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Kilometraje" hint="Opcional">
                <input type="number" className={inputCls} value={mileage} onChange={(e) => setMileage(e.target.value === "" ? "" : Number(e.target.value))} placeholder="45000" min={0} />
              </FormField>
            </div>
          </AssetSection>

          <AssetSection title="Identificadores" icon={Tag} description="Placa, numero de serie y motor" className="mt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Placa" required>
                <input className={inputCls} value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="ABC-123-D" />
              </FormField>
              <FormField label="No. Serie (VIN)" hint="Opcional">
                <input className={inputCls} value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="1HGBH41JXMN109186" />
              </FormField>
              <FormField label="No. Motor" hint="Opcional">
                <input className={inputCls} value={engineNumber} onChange={(e) => setEngineNumber(e.target.value)} placeholder="2TR1234567" />
              </FormField>
            </div>
          </AssetSection>

          <AssetSection title="Estado y Asignacion" icon={Activity} className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormField label="Estado">
                <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as AssetStatus)}>
                  <option value="AVAILABLE">Disponible</option>
                  <option value="ASSIGNED">Asignado</option>
                  <option value="MAINTENANCE">Mantenimiento</option>
                </select>
              </FormField>
              <FormField label="Ubicacion">
                <select className={inputCls} value={locationId} onChange={(e) => setLocationId(e.target.value === "" ? "" : Number(e.target.value))}>
                  <option value="">Sin ubicacion</option>
                  {locationOptions.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Asignado a" hint="Nombre de quien tiene el vehiculo">
                <input className={inputCls} value={assignedToName} onChange={(e) => setAssignedToName(e.target.value)} placeholder="Ej: Juan Perez" />
              </FormField>
              <FormField label="Fecha de Asignacion" hint="Opcional">
                <input type="date" className={inputCls} value={assignedToDate} onChange={(e) => setAssignedToDate(e.target.value)} />
              </FormField>
            </div>
          </AssetSection>

          <AssetSection title="Datos Financieros" icon={DollarSign} className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FormField label="Fecha de Compra">
                <input type="date" className={inputCls} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </FormField>
              <FormField label="Precio de Compra (MOI)">
                <input type="number" className={inputCls} value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value === "" ? "" : Number(e.target.value))} placeholder="350000" min={0} step="0.01" />
              </FormField>
              <FormField label="Valor de Rescate" hint="Default 0">
                <input type="number" className={inputCls} value={salvageValue} onChange={(e) => setSalvageValue(e.target.value === "" ? "" : Number(e.target.value))} placeholder="50000" min={0} step="0.01" />
              </FormField>
              <FormField label="Vida Util (anios)" hint="Default 5">
                <input type="number" className={inputCls} value={usefulLifeYears} onChange={(e) => setUsefulLifeYears(e.target.value === "" ? "" : Number(e.target.value))} min={1} max={50} />
              </FormField>
            </div>
          </AssetSection>

          <AssetSection title="Garantia" icon={CalendarDays} className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Fin de Garantia" hint="Opcional">
                <input type="date" className={inputCls} value={warrantyEnd} onChange={(e) => setWarrantyEnd(e.target.value)} />
              </FormField>
            </div>
          </AssetSection>

          <FormActions>
            <button type="submit" className={btnPrimary} disabled={saving}>
              <Save size={16} />
              {saving ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Vehiculo"}
            </button>
            <button type="button" className={btnSecondary} onClick={onCancel} disabled={saving}>
              <XCircle size={16} />
              Cancelar
            </button>
          </FormActions>
        </AssetPanel>
      </form>
    </div>
  );
};
