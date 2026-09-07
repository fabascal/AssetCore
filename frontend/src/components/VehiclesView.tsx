import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, Filter, Plus, Truck, Eye, Pencil, FileText, Upload, Download, Trash2,
  AlertTriangle, CheckCircle2, XCircle, RefreshCw, CalendarDays, MapPin, User,
  DollarSign, Gauge, Palette, Tag, Activity, Shield, Clock,
} from "lucide-react";
import {
  Vehicle, VehicleDocument, VehicleDocumentType, vehicleDocumentTypeLabels,
  vehicleTypeLabels, assetStatusLabels, AssetStatus,
} from "../types";
import { api } from "../lib/api";
import { notify } from "../lib/toast";
import {
  AssetPanel, AssetPageHeader, AssetSection, AssetStatusBadge,
  DetailField, DetailFieldGrid, btnPrimary, btnSecondary, inputCls,
  formatCurrencyMxn, formatDateMx,
} from "./assets/AssetUi";

const statusStyles: Record<AssetStatus, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  ASSIGNED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  MAINTENANCE: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  SCRAP: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};

type Props = {
  vehicles: Vehicle[];
  loading?: boolean;
  canWrite?: boolean;
  onView: (vehicleId: number) => void;
  onEdit: (vehicle: Vehicle) => void;
  onNew?: () => void;
};

export const VehiclesTable = ({ vehicles, loading = false, canWrite = false, onView, onEdit, onNew }: Props) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "ALL">("ALL");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (statusFilter !== "ALL" && v.status !== statusFilter) return false;
      if (!q) return true;
      return (
        v.brand.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.plateNumber.toLowerCase().includes(q) ||
        (v.serialNumber ?? "").toLowerCase().includes(q) ||
        (v.assignedToName ?? "").toLowerCase().includes(q) ||
        (v.location?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [vehicles, search, statusFilter]);

  return (
    <section className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Parque Vehicular</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            {filtered.length} vehiculo{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canWrite && onNew ? (
          <button onClick={onNew} className={btnPrimary}>
            <Plus size={16} /> Nuevo Vehiculo
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            className={`${inputCls} pl-9`}
            placeholder="Buscar por marca, modelo, placa, serie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={inputCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AssetStatus | "ALL")}>
          <option value="ALL">Todos los estados</option>
          <option value="AVAILABLE">Disponible</option>
          <option value="ASSIGNED">Asignado</option>
          <option value="MAINTENANCE">Mantenimiento</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-outline-variant">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-low">
            <tr>
              {["Codigo", "Marca/Modelo", "Placa", "Tipo", "Km", "Estado", "Ubicacion", "Asignado a", "Acciones"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant bg-surface-container-lowest">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-on-surface-variant">Cargando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-on-surface-variant">No se encontraron vehiculos</td></tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary">{v.vehicleCode}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-on-surface">{v.brand} {v.model}</div>
                    {v.year ? <div className="text-xs text-on-surface-variant">{v.year}{v.color ? ` · ${v.color}` : ""}</div> : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{v.plateNumber}</td>
                  <td className="px-4 py-3 text-xs">{vehicleTypeLabels[v.vehicleType]}</td>
                  <td className="px-4 py-3 text-xs tabular-nums">{v.mileage ? `${v.mileage.toLocaleString()} km` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[v.status]}`}>
                      {assetStatusLabels[v.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant max-w-[150px] truncate">{v.locationPath ?? v.location?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{v.assignedToName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => onView(v.id)} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition" title="Ver detalle">
                        <Eye size={15} />
                      </button>
                      {canWrite ? (
                        <button onClick={() => onEdit(v)} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition" title="Editar">
                          <Pencil size={15} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

/* ─── Vehicle Detail ─── */

type DetailProps = {
  vehicle: Vehicle;
  canWrite?: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onDecommissioned: () => void;
};

export const VehicleDetail = ({ vehicle, canWrite = false, onBack, onRefresh, onDecommissioned }: DetailProps) => {
  const [docs, setDocs] = useState<VehicleDocument[]>(vehicle.documents ?? []);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<VehicleDocumentType>("CARTA_COMPROMISO");
  const [docDescription, setDocDescription] = useState("");
  const [docExpiresAt, setDocExpiresAt] = useState("");
  const [showDecommission, setShowDecommission] = useState(false);
  const [decommissionReason, setDecommissionReason] = useState("END_OF_LIFE");
  const [decommissionNotes, setDecommissionNotes] = useState("");

  const loadDocs = useCallback(async () => {
    try {
      const res = await api.get<{ docs: VehicleDocument[] }>(`/vehicles/${vehicle.id}/documents`);
      setDocs(res.data.docs);
    } catch { /* silent */ }
  }, [vehicle.id]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", docType);
      if (docDescription.trim()) formData.append("description", docDescription.trim());
      if (docExpiresAt) formData.append("expiresAt", docExpiresAt);

      await api.post(`/vehicles/${vehicle.id}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      notify.success("Documento", "Documento subido correctamente");
      setDocDescription("");
      setDocExpiresAt("");
      await loadDocs();
    } catch {
      notify.error("Documento", "Error al subir documento");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteDoc = async (docId: number) => {
    try {
      await api.delete(`/vehicles/${vehicle.id}/documents/${docId}`);
      notify.success("Documento", "Documento eliminado");
      await loadDocs();
    } catch {
      notify.error("Documento", "Error al eliminar");
    }
  };

  const handleDecommission = async () => {
    try {
      await api.post(`/vehicles/${vehicle.id}/decommission`, {
        reason: decommissionReason,
        notes: decommissionNotes.trim() || null,
      });
      notify.success("Vehiculo", "Vehiculo dado de baja");
      setShowDecommission(false);
      onDecommissioned();
    } catch {
      notify.error("Vehiculo", "Error al dar de baja");
    }
  };

  const isExpiringSoon = (date?: string | null) => {
    if (!date) return false;
    const d = new Date(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // 30 days
  };

  const isExpired = (date?: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  return (
    <div className="animate-fade-in space-y-6">
      <AssetPageHeader
        icon={Truck}
        title={`${vehicle.brand} ${vehicle.model}`}
        subtitle={`${vehicle.vehicleCode} · ${vehicle.plateNumber}`}
        badge={<AssetStatusBadge status={vehicle.status} />}
        actions={
          <>
            <button onClick={onBack} className={btnSecondary}>Volver</button>
            {canWrite && vehicle.status !== "SCRAP" ? (
              <button onClick={() => setShowDecommission(true)} className={`${btnSecondary} text-error border-error/30 hover:bg-error-container/20`}>
                <Trash2 size={14} /> Dar de Baja
              </button>
            ) : null}
          </>
        }
      />

      {/* Decommission modal */}
      {showDecommission ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-elevation-3">
            <h3 className="text-lg font-semibold text-on-surface">Dar de Baja Vehiculo</h3>
            <p className="mt-1 text-sm text-on-surface-variant">{vehicle.brand} {vehicle.model} ({vehicle.plateNumber})</p>
            <div className="mt-4 space-y-3">
              <select className={inputCls} value={decommissionReason} onChange={(e) => setDecommissionReason(e.target.value)}>
                <option value="END_OF_LIFE">Fin de vida util</option>
                <option value="DAMAGE">Danio / irreparable</option>
                <option value="THEFT">Robo / extravio</option>
                <option value="OTHER">Otro</option>
              </select>
              <textarea
                className={`${inputCls} min-h-[80px]`}
                placeholder="Notas (opcional, requerido si Otro)"
                value={decommissionNotes}
                onChange={(e) => setDecommissionNotes(e.target.value)}
              />
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setShowDecommission(false)} className={btnSecondary}>Cancelar</button>
              <button onClick={handleDecommission} className={`${btnPrimary} bg-error hover:bg-error/90`}>Confirmar Baja</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Info grid */}
      <AssetPanel>
        <AssetSection title="Informacion General" icon={Tag}>
          <DetailFieldGrid cols={4}>
            <DetailField label="Codigo" value={vehicle.vehicleCode} mono />
            <DetailField label="Tipo" value={vehicleTypeLabels[vehicle.vehicleType]} icon={Truck} />
            <DetailField label="Anio" value={vehicle.year ?? "—"} icon={CalendarDays} />
            <DetailField label="Color" value={vehicle.color ?? "—"} icon={Palette} />
            <DetailField label="Placa" value={vehicle.plateNumber} mono />
            <DetailField label="No. Serie" value={vehicle.serialNumber ?? "—"} mono />
            <DetailField label="No. Motor" value={vehicle.engineNumber ?? "—"} mono />
            <DetailField label="Kilometraje" value={vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : "—"} icon={Gauge} />
          </DetailFieldGrid>
        </AssetSection>

        <AssetSection title="Estado y Ubicacion" icon={Activity} className="mt-6">
          <DetailFieldGrid cols={3}>
            <DetailField label="Estado" value={assetStatusLabels[vehicle.status]} icon={Activity} />
            <DetailField label="Ubicacion" value={vehicle.locationPath ?? vehicle.location?.name ?? "—"} icon={MapPin} />
            <DetailField label="Asignado a" value={vehicle.assignedToName ?? "Sin asignar"} icon={User} highlight={Boolean(vehicle.assignedToName)} />
            <DetailField label="Fecha Asignacion" value={formatDateMx(vehicle.assignedToDate)} icon={CalendarDays} />
          </DetailFieldGrid>
        </AssetSection>

        <AssetSection title="Datos Financieros" icon={DollarSign} className="mt-6">
          <DetailFieldGrid cols={4}>
            <DetailField label="Precio Compra" value={formatCurrencyMxn(vehicle.purchasePrice)} />
            <DetailField label="Valor Rescate" value={formatCurrencyMxn(vehicle.salvageValue)} />
            <DetailField label="Fecha Compra" value={formatDateMx(vehicle.purchaseDate)} icon={CalendarDays} />
            <DetailField label="Fin Garantia" value={formatDateMx(vehicle.warrantyEnd)} icon={Shield} />
            <DetailField label="Vida Util" value={vehicle.usefulLifeYears ? `${vehicle.usefulLifeYears} anios` : "—"} icon={Clock} />
            <DetailField label="Fin Vida Util" value={formatDateMx(vehicle.endOfLifeDate)} icon={CalendarDays} />
          </DetailFieldGrid>
        </AssetSection>
      </AssetPanel>

      {/* Documents */}
      <AssetPanel>
        <AssetSection title="Documentos" icon={FileText} description="Carta compromiso, tarjeta de circulacion, seguro, facturas">
          {canWrite ? (
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-on-surface-variant">Tipo</label>
                <select className={inputCls} value={docType} onChange={(e) => setDocType(e.target.value as VehicleDocumentType)}>
                  {Object.entries(vehicleDocumentTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-on-surface-variant">Descripcion</label>
                <input className={inputCls} value={docDescription} onChange={(e) => setDocDescription(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-on-surface-variant">Vigencia</label>
                <input type="date" className={inputCls} value={docExpiresAt} onChange={(e) => setDocExpiresAt(e.target.value)} />
              </div>
              <label className={`${btnPrimary} cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload size={14} />
                {uploading ? "Subiendo..." : "Subir"}
                <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
          ) : null}

          {docs.length === 0 ? (
            <p className="text-sm text-on-surface-variant py-4 text-center">Sin documentos</p>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={18} className="shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-on-surface truncate">{doc.originalName}</p>
                      <p className="text-xs text-on-surface-variant">
                        {vehicleDocumentTypeLabels[doc.documentType]}
                        {doc.description ? ` · ${doc.description}` : ""}
                        {doc.expiresAt ? (
                          <span className={isExpired(doc.expiresAt) ? " text-error font-semibold" : isExpiringSoon(doc.expiresAt) ? " text-amber-600 font-semibold" : ""}>
                            {" "}· Vence: {formatDateMx(doc.expiresAt)}
                            {isExpired(doc.expiresAt) ? " (VENCIDO)" : isExpiringSoon(doc.expiresAt) ? " (PROXIMO)" : ""}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={`/api/vehicles/${vehicle.id}/documents/${doc.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition"
                      title="Descargar"
                    >
                      <Download size={15} />
                    </a>
                    {canWrite ? (
                      <button onClick={() => handleDeleteDoc(doc.id)} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-error-container/20 hover:text-error transition" title="Eliminar">
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AssetSection>
      </AssetPanel>
    </div>
  );
};
