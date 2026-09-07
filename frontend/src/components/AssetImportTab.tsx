import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, Download, MapPin, CheckCircle2, XCircle,
  FileSpreadsheet, Loader2, AlertTriangle, RefreshCw, Info,
} from "lucide-react";
import { api } from "../lib/api";
import { buildLocationOptions, resolveLocationIdByPath, type LocationNode } from "../lib/locations";
import { notify } from "../lib/toast";
import {
  resolveCatalogCapacity,
  resolveCatalogProcessor,
  buildProcessorImportInput,
  formatProcessorImportError,
  validateImportRows,
  type ImportPreviewIssue,
} from "../lib/import-utils";
import { normalizeImportRowDates } from "../lib/import-dates";
import { applyImportStatusRules } from "../lib/import-status";
import { assetStatusLabels, type AssetStatus } from "../types";
import { btnPrimary, btnSecondary, inputCls } from "./itam-config/ItamCatalogUi";

/* ─── Types ─── */
type AssetType = { id: number; name: string };
type CatalogProcessor = { id: number; name: string; generation?: string | null };
type CatalogCapacity = { id: number; label: string; sizeGb: number };

type ImportRow = {
  brand: string;
  model: string;
  serialNumber: string;
  assetTypeName?: string;
  locationPath?: string;
  status?: string;
  processor?: string;
  processorGeneration?: string;
  ramGb?: string;
  storageGb?: string;
  storageType?: string;
  purchaseDate?: string;
  warrantyEnd?: string;
  purchasePrice?: string;
  salvageValue?: string;
  equipmentValue?: string;
  assignedToName?: string;
  assignedToDate?: string;
};

type ImportResult = {
  imported: number;
  skipped: number;
  results: { row: number; assetCode: string }[];
  errors: { row: number; message: string }[];
};

/* ─── CSV Template ─── */
const TEMPLATE_HEADERS = [
  "Marca", "Modelo", "No.Serie", "Tipo Activo", "Ubicacion", "Estado",
  "Procesador", "Generacion", "RAM GB", "Almacenamiento GB", "Tipo Almacenamiento",
  "Fecha Compra", "Fin Garantia", "MOI", "Valor Rescate",
  "Asignado A", "Fecha Asignacion",
];

const TEMPLATE_SAMPLES = [
  ["Dell", "Latitude 5420", "SN-001234", "Laptop", "Sede Central > Piso 2 > IT", "AVAILABLE", "Intel Core i5", "13", "16", "256", "SSD", "2023-01-15", "2026-01-15", "18500", "0", "Sistemas", "2023-01-15"],
  ["HP", "EliteBook 840", "SN-001235", "Laptop", "Sede Central > Piso 2 > IT", "AVAILABLE", "Intel Core i7 (Gen 14)", "", "16", "512", "SSD", "2024-03-01", "2027-03-01", "22000", "0", "", ""],
  ["HP", "LaserJet Pro", "SN-PR-9001", "Impresora", "Sede Central > Recepcion", "AVAILABLE", "", "", "", "", "", "2024-06-01", "2027-06-01", "8500", "0", "", ""],
  ["Cisco", "Catalyst 2960", "SN-SW-4400", "Switch", "Sede Central > Rack Principal", "AVAILABLE", "", "", "", "", "", "2022-03-10", "", "12000", "0", "", ""],
];

const COLUMN_MAP: Record<string, keyof ImportRow> = {
  marca: "brand",
  modelo: "model",
  "no.serie": "serialNumber",
  noserie: "serialNumber",
  "tipo activo": "assetTypeName",
  tipoactivo: "assetTypeName",
  ubicacion: "locationPath",
  ubicación: "locationPath",
  estado: "status",
  procesador: "processor",
  generacion: "processorGeneration",
  generación: "processorGeneration",
  gen: "processorGeneration",
  "generacion procesador": "processorGeneration",
  "ram gb": "ramGb",
  ramgb: "ramGb",
  "almacenamiento gb": "storageGb",
  almacenamientogb: "storageGb",
  "tipo almacenamiento": "storageType",
  tipoalmacenamiento: "storageType",
  "fecha compra": "purchaseDate",
  fechacompra: "purchaseDate",
  "fin garantia": "warrantyEnd",
  fingarantia: "warrantyEnd",
  moi: "purchasePrice",
  "valor rescate": "salvageValue",
  valorrescate: "salvageValue",
  "valor equipo": "equipmentValue",
  valorequipo: "equipmentValue",
  "asignado a": "assignedToName",
  asignadoa: "assignedToName",
  "fecha asignacion": "assignedToDate",
  fechaasignacion: "assignedToDate",
};

function downloadTemplate(assetTypes: AssetType[], locationPaths: string[]) {
  const typeNames = assetTypes.map((t) => t.name).join(" | ");
  const locationHint = locationPaths.slice(0, 5).join(" | ") || "(configura en ITAM > Ubicaciones)";
  const notes = [
    "# NOTAS:",
    "# - Marca, Modelo y No.Serie son obligatorios.",
    "# - Procesador, RAM y Almacenamiento son opcionales (dejar vacío en switches, impresoras, etc.).",
    "# - Si indicas RAM/Procesador/Almacenamiento, deben existir en catálogo ITAM.",
    "# - Procesador: nombre del catálogo ITAM (ej. Intel Core i7). Generacion: columna aparte (ej. 13).",
    "# - También puedes poner todo en Procesador: Intel Core i7 (Gen 13) — deja Generacion vacía.",
    "# - Ubicacion: ruta completa con niveles, ej. Sede > Piso 2 > IT (opcional por fila).",
    "# - Si la fila no trae Ubicacion, se usa la ubicación global del formulario.",
    `# - Estado: AVAILABLE | ASSIGNED | MAINTENANCE | SCRAP (o español: Disponible, Asignado, etc.)`,
    "# - Si la columna Asignado A tiene valor, el estado se define como ASSIGNED (aunque Estado diga AVAILABLE o esté vacío).",
    "# - Tipo Almacenamiento: SSD | HDD | NVME",
    `# - Tipos de Activo: ${typeNames || "(configura en ITAM > Tipo de Activo)"}`,
    `# - Ubicaciones ejemplo: ${locationHint}`,
    "# - Fechas: YYYY-MM-DD (recomendado, ej. 2023-01-15). También acepta DD/MM/YYYY (ej. 15/01/2023).",
    "# - MOI: monto original sin IVA. Valor Rescate: opcional (default 0).",
    "# - Valor Equipo (legacy): alias de MOI si no se indica columna MOI.",
    "# - Elimina esta sección antes de importar",
    "",
  ];
  const bom = "\uFEFF";
  const csv =
    bom +
    notes.join("\n") +
    TEMPLATE_HEADERS.join(",") +
    "\n" +
    TEMPLATE_SAMPLES.map((row) => row.join(",")).join("\n") +
    "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "layout_importacion_activos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/[^a-záéíóúüñ0-9. ]/gi, "").trim());

  return lines.slice(1).filter((l) => l).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, "").trim());
    const row: Partial<ImportRow> = {};
    headers.forEach((h, i) => {
      const key = COLUMN_MAP[h] ?? COLUMN_MAP[h.replace(/\s+/g, "")];
      if (key && cols[i] !== undefined && cols[i] !== "") (row as Record<string, string>)[key] = cols[i];
    });
    const normalized = normalizeImportRowDates(row as Record<string, unknown>) as ImportRow;
    return applyImportStatusRules(normalized);
  });
}

function formatResolvedCapacity(value: string | undefined, catalog: CatalogCapacity[]) {
  if (!value) return "—";
  const match = resolveCatalogCapacity(value, catalog);
  return match ? `${match.label} (${match.sizeGb} GB)` : value;
}

export const AssetImportTab = ({ onImportComplete }: { onImportComplete?: () => void | Promise<void> }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [locations, setLocations] = useState<LocationNode[]>([]);
  const [assetTypes, setAssetTypes] = useState<AssetType[]>([]);
  const [processors, setProcessors] = useState<CatalogProcessor[]>([]);
  const [ramOptions, setRamOptions] = useState<CatalogCapacity[]>([]);
  const [storageOptions, setStorageOptions] = useState<CatalogCapacity[]>([]);
  const [defaultLocationId, setDefaultLocationId] = useState<number | "">("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    setCatalogLoading(true);
    Promise.all([
      api.get<{ locations: LocationNode[] }>("/itam-config/locations"),
      api.get<{ assetTypes: AssetType[] }>("/itam-config/asset-types"),
      api.get<{ processors: CatalogProcessor[] }>("/itam-config/processors"),
      api.get<{ ram: CatalogCapacity[] }>("/itam-config/ram"),
      api.get<{ storage: CatalogCapacity[] }>("/itam-config/storage"),
    ])
      .then(([loc, at, pr, ra, st]) => {
        setLocations(loc.data.locations);
        setAssetTypes(at.data.assetTypes);
        setProcessors(pr.data.processors);
        setRamOptions(ra.data.ram);
        setStorageOptions(st.data.storage);
      })
      .catch(() => notify.error("Importar", "No se pudieron cargar los catálogos."))
      .finally(() => setCatalogLoading(false));
  }, []);

  const locationOptions = useMemo(() => buildLocationOptions(locations), [locations]);
  const locationPaths = useMemo(() => locationOptions.map((option) => option.label), [locationOptions]);

  const previewIssues = useMemo<ImportPreviewIssue[]>(() => {
    if (rows.length === 0) return [];
    return validateImportRows(rows, {
      assetTypeNames: assetTypes.map((t) => t.name),
      processors,
      ramOptions,
      storageOptions,
      locationPaths,
      defaultLocationId: defaultLocationId ? Number(defaultLocationId) : null,
      resolveLocationId: (path) => resolveLocationIdByPath(path, locations),
    });
  }, [rows, assetTypes, processors, ramOptions, storageOptions, locationPaths, defaultLocationId, locations]);

  const blockingIssues = previewIssues.filter((issue) => issue.severity === "error");
  const warningIssues = previewIssues.filter((issue) => issue.severity === "warning");

  const handleFile = useCallback((file: File) => {
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRows(parseCSV(text));
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f && f.name.endsWith(".csv")) handleFile(f);
      else notify.warning("Importar", "Solo se aceptan archivos .csv");
    },
    [handleFile],
  );

  const handleImport = async () => {
    if (rows.length === 0 || blockingIssues.length > 0) return;
    setImporting(true);
    const handle = notify.loading("Importando", `Procesando ${rows.length} fila(s)…`);
    try {
      const res = await api.post<ImportResult>("/assets/bulk-import", {
        locationId: defaultLocationId || null,
        rows,
      });
      setResult(res.data);
      if (res.data.imported > 0) {
        notify.success(
          "Importación",
          `${res.data.imported} activo(s) importado(s). Ve a Inventario → Activos para verlos.`,
        );
        await onImportComplete?.();
      }
      if (res.data.skipped > 0) {
        notify.warning("Importación", `${res.data.skipped} fila(s) con error.`);
      }
    } catch {
      notify.error("Importar", "Error al procesar la importación.");
    } finally {
      handle.dismiss();
      setImporting(false);
    }
  };

  const reset = () => {
    setRows([]);
    setFileName("");
    setResult(null);
  };

  const selectedLocationLabel = locationOptions.find((o) => o.id === Number(defaultLocationId))?.label;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-on-surface">Carga masiva de activos</p>
          <p className="text-xs text-on-surface-variant">
            Importa laptops, impresoras, switches u otros equipos. Las especificaciones técnicas son opcionales;
            cuando las indiques, se vinculan al catálogo ITAM (RAM, procesador, almacenamiento).
          </p>
        </div>
        <button type="button" onClick={() => downloadTemplate(assetTypes, locationPaths)} className={btnSecondary}>
          <Download size={15} /> Descargar layout
        </button>
      </div>

      <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
        <p className="text-sm font-semibold text-on-surface mb-1 flex items-center gap-1.5">
          <MapPin size={14} className="text-primary" /> Ubicación por defecto
        </p>
        <p className="text-xs text-on-surface-variant mb-3">
          Aplica a filas sin columna <span className="font-medium">Ubicacion</span>. Usa la ruta completa con todos los niveles.
        </p>
        <select
          className={inputCls}
          value={defaultLocationId}
          disabled={catalogLoading}
          onChange={(e) => setDefaultLocationId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">— Sin ubicación global —</option>
          {locationOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {selectedLocationLabel && (
          <p className="mt-2 text-xs text-on-surface-variant">
            Destino: <span className="font-medium text-on-surface">{selectedLocationLabel}</span>
          </p>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-outline-variant bg-secondary-container/30 px-4 py-3 text-xs text-on-surface-variant">
        <Info size={14} className="mt-0.5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p>
            Columna <strong className="text-on-surface">Ubicacion</strong>: ruta con niveles, ej.{" "}
            <code className="rounded bg-surface-container-high px-1">Sede &gt; Piso 2 &gt; IT</code>.
          </p>
          <p>
            <strong className="text-on-surface">Procesador</strong> + <strong className="text-on-surface">Generacion</strong>: columnas separadas (
            <code className="rounded bg-surface-container-high px-1">Intel Core i7</code> +{" "}
            <code className="rounded bg-surface-container-high px-1">13</code>) o todo en Procesador (
            <code className="rounded bg-surface-container-high px-1">Intel Core i7 (Gen 13)</code>).
          </p>
          <p>
            <strong className="text-on-surface">Fechas</strong> (Compra, Garantía, Asignación): formato{" "}
            <code className="rounded bg-surface-container-high px-1">YYYY-MM-DD</code> (ej.{" "}
            <code className="rounded bg-surface-container-high px-1">2023-01-15</code>). También acepta{" "}
            <code className="rounded bg-surface-container-high px-1">DD/MM/YYYY</code>.
          </p>
          <p>
            <strong className="text-on-surface">RAM GB</strong> debe coincidir con una opción del catálogo (ej.{" "}
            <code className="rounded bg-surface-container-high px-1">16</code> → objeto RAM de 16 GB).
          </p>
        </div>
      </div>

      {!result && (
        <div>
          <p className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-1.5">
            <FileSpreadsheet size={14} className="text-primary" /> Archivo CSV
          </p>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-8 text-center ${
              dragOver
                ? "border-primary bg-primary-container/20"
                : "border-outline-variant hover:border-primary/40 hover:bg-surface-container-low"
            }`}
          >
            <Upload size={28} className="mx-auto mb-3 text-on-surface-variant/40" />
            {fileName ? (
              <p className="text-sm font-medium text-on-surface">{fileName}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-on-surface-variant">Arrastra tu archivo CSV aquí</p>
                <p className="text-xs text-on-surface-variant/70 mt-1">o haz clic para seleccionarlo</p>
              </>
            )}
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
          </div>
        </div>
      )}

      {rows.length > 0 && !result && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-on-surface">
              Vista previa — <span className="text-primary">{rows.length} fila(s)</span>
            </p>
            <button type="button" onClick={reset} className={`${btnSecondary} text-xs py-1.5 px-3`}>
              <RefreshCw size={12} /> Cambiar archivo
            </button>
          </div>

          {(blockingIssues.length > 0 || warningIssues.length > 0) && (
            <div className="mb-3 space-y-2">
              {blockingIssues.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-xs text-on-error-container">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">{blockingIssues.length} error(es) — corrige antes de importar</p>
                    <ul className="mt-1 space-y-0.5 list-disc pl-4">
                      {blockingIssues.slice(0, 6).map((issue, i) => (
                        <li key={i}>
                          Fila {issue.row}: {issue.message}
                        </li>
                      ))}
                      {blockingIssues.length > 6 && <li>… y {blockingIssues.length - 6} más</li>}
                    </ul>
                  </div>
                </div>
              )}
              {warningIssues.length > 0 && blockingIssues.length === 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-outline-variant bg-tertiary-container/30 px-4 py-3 text-xs text-on-surface-variant">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <span>{warningIssues.length} fila(s) quedarán sin ubicación asignada.</span>
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-outline-variant">
            <table className="w-full text-xs">
              <thead className="bg-surface-container-low">
                <tr>
                  {["#", "Marca", "Modelo", "Serie", "Tipo", "Ubicación", "Estado", "Asignado", "MOI", "Rescate", "Procesador", "Gen.", "RAM", "Almac."].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-on-surface-variant whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant bg-surface-container-lowest">
                {rows.slice(0, 10).map((r, i) => {
                  const resolvedRam = formatResolvedCapacity(r.ramGb, ramOptions);
                  const resolvedStorage = formatResolvedCapacity(r.storageGb, storageOptions);
                  const processorInput = buildProcessorImportInput(r.processor, r.processorGeneration);
                  const resolvedProcessor = processorInput
                    ? resolveCatalogProcessor(processorInput, processors) ?? formatProcessorImportError(r.processor, r.processorGeneration)
                    : "—";
                  const locationLabel =
                    r.locationPath?.trim() ||
                    selectedLocationLabel ||
                    "—";

                  return (
                    <tr key={i} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-3 py-2 text-on-surface-variant">{i + 2}</td>
                      <td className="px-3 py-2 font-medium text-on-surface">{r.brand || "—"}</td>
                      <td className="px-3 py-2 text-on-surface">{r.model || "—"}</td>
                      <td className="px-3 py-2 font-mono text-on-surface-variant">{r.serialNumber || "—"}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{r.assetTypeName || "—"}</td>
                      <td className="px-3 py-2 text-on-surface-variant max-w-[180px] truncate" title={locationLabel}>
                        {locationLabel}
                      </td>
                      <td className="px-3 py-2 text-on-surface-variant">
                        {assetStatusLabels[(r.status as AssetStatus) ?? "AVAILABLE"] ?? r.status ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-on-surface-variant max-w-[120px] truncate" title={r.assignedToName}>
                        {r.assignedToName || "—"}
                      </td>
                      <td className="px-3 py-2 text-on-surface-variant">{r.purchasePrice ?? r.equipmentValue ?? "—"}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{r.salvageValue ?? "—"}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{resolvedProcessor}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{r.processorGeneration || "—"}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{resolvedRam}</td>
                      <td className="px-3 py-2 text-on-surface-variant">{resolvedStorage}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > 10 && (
              <p className="px-3 py-2 text-center text-xs text-on-surface-variant border-t border-outline-variant">
                … y {rows.length - 10} fila(s) más
              </p>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={reset} className={btnSecondary}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || blockingIssues.length > 0}
              className={btnPrimary}
            >
              {importing ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Importando…
                </>
              ) : (
                <>
                  <Upload size={15} /> Importar {rows.length} activo(s)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {result.imported > 0 ? (
            <p className="rounded-xl border border-primary/20 bg-primary-container/20 px-4 py-3 text-sm text-on-surface">
              Los activos ya están en el inventario. Abre <span className="font-semibold">Inventario → Activos</span> en el menú lateral para consultarlos.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-outline-variant bg-primary-container/30 px-5 py-4 flex items-center gap-3">
              <CheckCircle2 size={22} className="text-primary shrink-0" />
              <div>
                <p className="text-2xl font-bold text-on-surface">{result.imported}</p>
                <p className="text-xs text-on-surface-variant">importado(s)</p>
              </div>
            </div>
            <div
              className={`rounded-2xl border px-5 py-4 flex items-center gap-3 ${
                result.skipped > 0
                  ? "border-error/30 bg-error-container/20"
                  : "border-outline-variant bg-surface-container-low"
              }`}
            >
              <XCircle size={22} className={result.skipped > 0 ? "text-error shrink-0" : "text-on-surface-variant shrink-0"} />
              <div>
                <p className={`text-2xl font-bold ${result.skipped > 0 ? "text-on-error-container" : "text-on-surface-variant"}`}>
                  {result.skipped}
                </p>
                <p className="text-xs text-on-surface-variant">omitido(s)</p>
              </div>
            </div>
          </div>

          {result.results.length > 0 && (
            <details className="rounded-2xl border border-outline-variant overflow-hidden" open={result.results.length <= 5}>
              <summary className="px-4 py-3 text-sm font-medium text-on-surface bg-surface-container-low cursor-pointer flex items-center gap-2">
                <CheckCircle2 size={14} className="text-primary" /> Activos creados ({result.results.length})
              </summary>
              <div className="divide-y divide-outline-variant max-h-48 overflow-y-auto bg-surface-container-lowest">
                {result.results.map((r) => (
                  <div key={r.row} className="px-4 py-2 flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">Fila {r.row}</span>
                    <span className="font-mono font-semibold text-primary">{r.assetCode}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {result.errors.length > 0 && (
            <details className="rounded-2xl border border-error/30 overflow-hidden" open>
              <summary className="px-4 py-3 text-sm font-medium text-on-error-container bg-error-container/30 cursor-pointer flex items-center gap-2">
                <XCircle size={14} /> Errores ({result.errors.length})
              </summary>
              <div className="divide-y divide-outline-variant max-h-48 overflow-y-auto bg-surface-container-lowest">
                {result.errors.map((e, i) => (
                  <div key={i} className="px-4 py-2 flex items-start gap-3 text-xs">
                    <span className="text-on-surface-variant shrink-0">Fila {e.row}</span>
                    <span className="text-on-error-container">{e.message}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <button type="button" onClick={reset} className={`${btnSecondary} w-full justify-center`}>
            <RefreshCw size={14} /> Nueva importación
          </button>
        </div>
      )}
    </div>
  );
};
