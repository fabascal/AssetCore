import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, Download, MapPin, CheckCircle2, XCircle,
  FileSpreadsheet, Loader2, AlertTriangle, RefreshCw,
} from "lucide-react";
import { api } from "../lib/api";
import { notify } from "../lib/toast";

/* ─── Types ─── */
type LocationNode = { id: number; name: string; parentId: number | null; children?: LocationNode[] };
type AssetType    = { id: number; name: string };

type ImportRow = {
  brand: string; model: string; serialNumber: string;
  assetTypeName?: string; status?: string;
  processor?: string; ramGb?: string; storageGb?: string; storageType?: string;
  purchaseDate?: string; warrantyEnd?: string; equipmentValue?: string;
  assignedToName?: string; assignedToDate?: string;
};

type ImportResult = {
  imported: number; skipped: number;
  results: { row: number; assetCode: string }[];
  errors:  { row: number; message: string }[];
};

/* ─── CSV Template ─── */
const TEMPLATE_HEADERS = [
  "Marca", "Modelo", "No.Serie", "Tipo Activo", "Estado",
  "Procesador", "RAM GB", "Almacenamiento GB", "Tipo Almacenamiento",
  "Fecha Compra", "Fin Garantia", "Valor Equipo",
  "Asignado A", "Fecha Asignacion",
];

const TEMPLATE_SAMPLE = [
  "Dell", "Latitude 5420", "SN-001234", "Laptop", "AVAILABLE",
  "Intel Core i5", "8", "256", "SSD",
  "2023-01-15", "2026-01-15", "18500",
  "", "",
];

const COLUMN_MAP: Record<string, keyof ImportRow> = {
  "marca":                "brand",
  "modelo":               "model",
  "no.serie":             "serialNumber",
  "noserie":              "serialNumber",
  "tipo activo":          "assetTypeName",
  "tipoactivo":           "assetTypeName",
  "estado":               "status",
  "procesador":           "processor",
  "ram gb":               "ramGb",
  "ramgb":                "ramGb",
  "almacenamiento gb":    "storageGb",
  "almacenamientogb":     "storageGb",
  "tipo almacenamiento":  "storageType",
  "tipoalmacenamiento":   "storageType",
  "fecha compra":         "purchaseDate",
  "fechacompra":          "purchaseDate",
  "fin garantia":         "warrantyEnd",
  "fingarantia":          "warrantyEnd",
  "valor equipo":         "equipmentValue",
  "valorequipo":          "equipmentValue",
  "asignado a":           "assignedToName",
  "asignadoa":            "assignedToName",
  "fecha asignacion":     "assignedToDate",
  "fechaasignacion":      "assignedToDate",
};

function downloadTemplate(assetTypes: AssetType[]) {
  const typeNames = assetTypes.map((t) => t.name).join(" | ");
  const notes = [
    `# NOTAS:`,
    `# - Estado válido: AVAILABLE | ASSIGNED | MAINTENANCE | SCRAP`,
    `# - Tipo Almacenamiento: SSD | HDD | NVME`,
    `# - Tipos de Activo disponibles: ${typeNames || "(configura en ITAM > Tipo de Activo)"}`,
    `# - Fechas en formato YYYY-MM-DD`,
    `# - Elimina esta sección de notas antes de importar`,
    ``,
  ];
  const bom = "\uFEFF"; // UTF-8 BOM for Excel
  const csv = bom + notes.join("\n") + TEMPLATE_HEADERS.join(",") + "\n" + TEMPLATE_SAMPLE.join(",") + "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "layout_importacion_activos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-záéíóúüñ0-9. ]/gi, "").trim());

  return lines.slice(1).filter((l) => l).map((line) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, "").trim());
    const row: Partial<ImportRow> = {};
    headers.forEach((h, i) => {
      const key = COLUMN_MAP[h] ?? COLUMN_MAP[h.replace(/\s+/g, "")];
      if (key && cols[i]) (row as Record<string, string>)[key] = cols[i];
    });
    return row as ImportRow;
  });
}

/* ─── Styles ─── */
const selectCls = "w-full rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-1 ring-primary";
const btnPrimary = "inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60 transition";
const btnSecondary = "inline-flex items-center gap-1.5 rounded-xl border border-border-light dark:border-border-dark px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-lighter transition";

export const AssetImportTab = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [locations,   setLocations]   = useState<LocationNode[]>([]);
  const [assetTypes,  setAssetTypes]  = useState<AssetType[]>([]);
  const [rootId,      setRootId]      = useState<number | "">("");
  const [locationId,  setLocationId]  = useState<number | "">("");
  const [rows,        setRows]        = useState<ImportRow[]>([]);
  const [fileName,    setFileName]    = useState("");
  const [importing,   setImporting]   = useState(false);
  const [result,      setResult]      = useState<ImportResult | null>(null);
  const [dragOver,    setDragOver]    = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ locations: LocationNode[] }>("/itam-config/locations"),
      api.get<{ assetTypes: AssetType[] }>("/itam-config/asset-types"),
    ]).then(([loc, at]) => {
      setLocations(loc.data.locations);
      setAssetTypes(at.data.assetTypes);
    }).catch(() => notify.error("Importar", "No se pudieron cargar los catálogos."));
  }, []);

  const rootLocations  = locations.filter((l) => !l.parentId);
  const childLocations = locations.find((l) => l.id === Number(rootId))?.children ?? [];

  const handleFile = useCallback((file: File) => {
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".csv")) handleFile(f);
    else notify.warning("Importar", "Solo se aceptan archivos .csv");
  }, [handleFile]);

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    const handle = notify.loading("Importando", `Procesando ${rows.length} fila(s)…`);
    try {
      const res = await api.post<ImportResult>("/assets/bulk-import", {
        locationId: locationId || null,
        rows,
      });
      setResult(res.data);
      if (res.data.imported > 0) {
        notify.success("Importación", `${res.data.imported} activo(s) importado(s) correctamente.`);
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

  const reset = () => { setRows([]); setFileName(""); setResult(null); };

  return (
    <div className="space-y-6">
      {/* Instructions + Download template */}
      <div className="rounded-xl border border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Carga masiva de activos</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Descarga el layout CSV, llénalo con los activos y súbelo aquí.
            La ubicación se asigna globalmente desde los selectores.
          </p>
        </div>
        <button onClick={() => downloadTemplate(assetTypes)} className={btnSecondary}>
          <Download size={15} /> Descargar layout
        </button>
      </div>

      {/* Location selectors */}
      <div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
          <MapPin size={14} className="text-primary" /> Ubicación destino <span className="font-normal text-slate-400">(opcional — aplica a todos los activos del archivo)</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">Zona / Área</span>
            <select className={selectCls} value={rootId} onChange={(e) => { setRootId(e.target.value ? Number(e.target.value) : ""); setLocationId(""); }}>
              <option value="">— Sin zona —</option>
              {rootLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">Ubicación específica</span>
            <select className={selectCls} value={locationId} disabled={!rootId || childLocations.length === 0} onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">— {childLocations.length === 0 && rootId ? "Sin sub-ubicaciones" : "Todas"} —</option>
              {childLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      {!result && (
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
            <FileSpreadsheet size={14} className="text-primary" /> Archivo CSV
          </p>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed transition p-8 text-center ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border-light dark:border-border-dark hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-surface-lighter"
            }`}
          >
            <Upload size={28} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            {fileName ? (
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{fileName}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Arrastra tu archivo CSV aquí</p>
                <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionarlo</p>
              </>
            )}
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
          </div>
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && !result && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Vista previa — <span className="text-primary">{rows.length} fila(s)</span>
            </p>
            <button onClick={reset} className={btnSecondary + " text-xs py-1.5 px-3"}>
              <RefreshCw size={12} /> Cambiar archivo
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border-light dark:border-border-dark">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-surface-lighter">
                <tr>
                  {["#", "Marca", "Modelo", "No. Serie", "Tipo", "Estado", "RAM", "Almac.", "Fecha Compra"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-surface-lighter/40">
                    <td className="px-3 py-2 text-slate-400">{i + 2}</td>
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{r.brand || <span className="text-red-400">—</span>}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.model || "—"}</td>
                    <td className="px-3 py-2 font-mono text-slate-500 dark:text-slate-400">{r.serialNumber || <span className="text-red-400">—</span>}</td>
                    <td className="px-3 py-2 text-slate-500">{r.assetTypeName || "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{r.status || "AVAILABLE"}</td>
                    <td className="px-3 py-2 text-slate-500">{r.ramGb ? `${r.ramGb} GB` : "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{r.storageGb ? `${r.storageGb} GB` : "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{r.purchaseDate || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && (
              <p className="px-3 py-2 text-center text-xs text-slate-400 border-t border-border-light dark:border-border-dark">
                … y {rows.length - 10} fila(s) más
              </p>
            )}
          </div>

          {/* Missing required fields warning */}
          {rows.some((r) => !r.brand || !r.model || !r.serialNumber) && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>Algunas filas tienen campos requeridos vacíos (Marca, Modelo, No. Serie). Se omitirán durante la importación.</span>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-3">
            <button onClick={reset} className={btnSecondary}>Cancelar</button>
            <button onClick={handleImport} disabled={importing} className={btnPrimary}>
              {importing ? <><Loader2 size={15} className="animate-spin" /> Importando…</> : <><Upload size={15} /> Importar {rows.length} activo(s)</>}
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-700/30 bg-emerald-50 dark:bg-emerald-900/20 px-5 py-4 flex items-center gap-3">
              <CheckCircle2 size={22} className="text-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{result.imported}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500">importado(s)</p>
              </div>
            </div>
            <div className={`rounded-xl border px-5 py-4 flex items-center gap-3 ${
              result.skipped > 0
                ? "border-red-200 dark:border-red-700/30 bg-red-50 dark:bg-red-900/20"
                : "border-border-light dark:border-border-dark bg-slate-50 dark:bg-background-dark"
            }`}>
              <XCircle size={22} className={result.skipped > 0 ? "text-red-400 flex-shrink-0" : "text-slate-300 flex-shrink-0"} />
              <div>
                <p className={`text-2xl font-bold ${result.skipped > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400"}`}>{result.skipped}</p>
                <p className={`text-xs ${result.skipped > 0 ? "text-red-500 dark:text-red-500" : "text-slate-400"}`}>omitido(s)</p>
              </div>
            </div>
          </div>

          {/* Success list (collapsed if many) */}
          {result.results.length > 0 && (
            <details className="rounded-xl border border-border-light dark:border-border-dark overflow-hidden" open={result.results.length <= 5}>
              <summary className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-surface-lighter cursor-pointer flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500" /> Activos creados ({result.results.length})
              </summary>
              <div className="divide-y divide-border-light dark:divide-border-dark max-h-48 overflow-y-auto">
                {result.results.map((r) => (
                  <div key={r.row} className="px-4 py-2 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Fila {r.row}</span>
                    <span className="font-mono font-semibold text-primary">{r.assetCode}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Error list */}
          {result.errors.length > 0 && (
            <details className="rounded-xl border border-red-200 dark:border-red-700/30 overflow-hidden" open>
              <summary className="px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 cursor-pointer flex items-center gap-2">
                <XCircle size={14} /> Errores ({result.errors.length})
              </summary>
              <div className="divide-y divide-border-light dark:divide-border-dark max-h-48 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <div key={i} className="px-4 py-2 flex items-start gap-3 text-xs">
                    <span className="text-slate-400 flex-shrink-0">Fila {e.row}</span>
                    <span className="text-red-600 dark:text-red-400">{e.message}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <button onClick={reset} className={btnSecondary + " w-full justify-center"}>
            <RefreshCw size={14} /> Nueva importación
          </button>
        </div>
      )}
    </div>
  );
};
