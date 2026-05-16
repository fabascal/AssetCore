import { useMemo, useState } from "react";
import { Printer, X, MapPin, Loader2 } from "lucide-react";
import { Asset } from "../types";
import { api } from "../lib/api";
import { notify } from "../lib/toast";

type Props = {
  assets: Asset[];
  onClose: () => void;
};

type LocationNode = { id: number; name: string; parentId: number | null };

const LABEL_PAGE_HTML = (labels: string) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: 50mm 25mm; margin: 0; }
    body { font-family: Arial, sans-serif; }
    .label {
      width: 50mm; height: 25mm;
      padding: 2mm;
      display: flex; gap: 2mm; align-items: center;
      page-break-after: always;
      overflow: hidden;
    }
    .label:last-child { page-break-after: avoid; }
    .qr { width: 19mm; height: 19mm; flex-shrink: 0; object-fit: contain; }
    .meta { font-size: 6.5pt; line-height: 1.35; overflow: hidden; }
    .meta strong { font-size: 7pt; display: block; }
  </style>
</head>
<body>
${labels}
<script>
  var imgs = document.querySelectorAll('img.qr');
  var pending = imgs.length;
  function tryPrint() {
    pending--;
    if (pending <= 0) setTimeout(function(){ window.print(); }, 200);
  }
  if (pending === 0) { setTimeout(function(){ window.print(); }, 200); }
  else { imgs.forEach(function(img){
    if (img.complete) { tryPrint(); }
    else { img.onload = tryPrint; img.onerror = tryPrint; }
  }); }
</script>
</body>
</html>`;

const selectCls = "w-full rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-1 ring-primary";

export const BatchLabelPrintModal = ({ assets, onClose }: Props) => {
  const [rootId, setRootId] = useState<number | "">("");
  const [locationId, setLocationId] = useState<number | "">("");
  const [printing, setPrinting] = useState(false);

  /* Build unique location nodes from the asset list */
  const allLocations = useMemo<LocationNode[]>(() => {
    const map = new Map<number, LocationNode>();
    assets.forEach((a) => {
      if (!a.location) return;
      if (a.location.parentId && a.location.parent) {
        map.set(a.location.parentId, { id: a.location.parentId, name: a.location.parent.name, parentId: null });
      }
      map.set(a.location.id, { id: a.location.id, name: a.location.name, parentId: a.location.parentId ?? null });
    });
    return Array.from(map.values());
  }, [assets]);

  const rootLocations = useMemo(() => allLocations.filter((l) => !l.parentId).sort((a, b) => a.name.localeCompare(b.name)), [allLocations]);
  const childLocations = useMemo(() => allLocations.filter((l) => l.parentId === Number(rootId)).sort((a, b) => a.name.localeCompare(b.name)), [allLocations, rootId]);

  /* Assets matching the current selection */
  const selectedAssets = useMemo(() => {
    if (!rootId) return [];
    if (locationId) return assets.filter((a) => a.locationId === Number(locationId));
    /* If no child selected, include all under the root (children + root itself if directly assigned) */
    const childIds = new Set(childLocations.map((c) => c.id));
    childIds.add(Number(rootId));
    return assets.filter((a) => a.locationId != null && childIds.has(a.locationId));
  }, [assets, rootId, locationId, childLocations]);

  const handlePrint = async () => {
    if (selectedAssets.length === 0) return;
    setPrinting(true);
    const handle = notify.loading("Generando etiquetas", `Descargando ${selectedAssets.length} QR${selectedAssets.length > 1 ? "s" : ""}…`);
    try {
      /* Fetch all QRs in parallel and convert to data URLs */
      const qrDataUrls = await Promise.all(
        selectedAssets.map(async (a) => {
          const res = await api.get<Blob>(`/assets/${a.id}/qr`, { responseType: "blob" });
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(res.data);
          });
        }),
      );

      const labelsHtml = selectedAssets
        .map(
          (a, i) => `<div class="label">
  <img class="qr" src="${qrDataUrls[i]}" alt="QR ${a.assetCode}"/>
  <div class="meta">
    <strong>${a.assetCode}</strong>
    ${a.brand} ${a.model}<br/>
    S/N: ${a.serialNumber}
  </div>
</div>`,
        )
        .join("\n");

      const html = LABEL_PAGE_HTML(labelsHtml);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const w = window.open(blobUrl, "_blank");
      if (!w) {
        notify.error("Etiquetas", "El navegador bloqueó la ventana emergente. Permite popups para este sitio.");
        URL.revokeObjectURL(blobUrl);
      } else {
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        onClose();
      }
    } catch {
      notify.error("Etiquetas", "No se pudieron generar las etiquetas.");
    } finally {
      handle.dismiss();
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-6 shadow-xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Printer size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Imprimir etiquetas</h3>
              <p className="text-xs text-slate-400">Por ubicación</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-lighter transition">
            <X size={18} />
          </button>
        </div>

        {/* Location selectors */}
        <div className="space-y-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <MapPin size={13} className="text-primary" /> Zona / Área
            </span>
            <select
              className={selectCls}
              value={rootId}
              onChange={(e) => { setRootId(e.target.value ? Number(e.target.value) : ""); setLocationId(""); }}
            >
              <option value="">— Seleccionar zona —</option>
              {rootLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>

          {rootId !== "" && childLocations.length > 0 && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Ubicación específica</span>
              <select
                className={selectCls}
                value={locationId}
                onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">— Todas las ubicaciones de esta zona —</option>
                {childLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
          )}

          {rootId !== "" && childLocations.length === 0 && (
            <p className="text-xs text-slate-400 italic">Esta zona no tiene sub-ubicaciones.</p>
          )}
        </div>

        {/* Summary */}
        {rootId !== "" && (
          <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
            selectedAssets.length > 0
              ? "bg-primary/10 text-primary"
              : "bg-slate-100 dark:bg-surface-lighter text-slate-400"
          }`}>
            <Printer size={15} />
            {selectedAssets.length > 0
              ? `${selectedAssets.length} etiqueta${selectedAssets.length !== 1 ? "s" : ""} a imprimir`
              : "Sin activos en la selección"}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex gap-3 justify-end">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-xl border border-border-light dark:border-border-dark px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-lighter transition">
            Cancelar
          </button>
          <button
            onClick={handlePrint}
            disabled={printing || selectedAssets.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60 transition"
          >
            {printing ? <><Loader2 size={15} className="animate-spin" /> Generando...</> : <><Printer size={15} /> Imprimir</>}
          </button>
        </div>
      </div>
    </div>
  );
};
