import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, QrCode, Printer, TicketPlus, ChevronDown, ChevronUp, Play, Send, X as XIcon, RotateCcw, Cpu, Hash, Activity, Monitor, MapPin, HardDrive, MemoryStick, CalendarDays, AlertTriangle, UserCheck, FileText, Upload, Download, Trash2, Eye, ShieldCheck, Tag, Box, Layers } from "lucide-react";
import { Asset, CustodyDocument, TicketPriority, assetStatusLabels, assetDecommissionReasonLabels, type AssetDecommissionReason } from "../types";
import { api } from "../lib/api";
import { PdfViewer } from "./PdfViewer";
import { getApiErrorMessage, notify } from "../lib/toast";
import { formatAssetLocation } from "../lib/locations";
import {
  AssetPanel,
  AssetPageHeader,
  AssetSection,
  AssetStatusBadge,
  DetailField,
  DetailFieldGrid,
  btnSecondary,
  formatCurrencyMxn,
  formatDateMx,
  formatRam,
  formatStorage,
  hasTechnicalSpecs,
} from "./assets/AssetUi";

type CompanyInfo = {
  name: string;
  rfc?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logoData?: string | null;
  logoMime?: string | null;
};

type Props = {
  asset: Asset;
  qrImageUrl: string | null;
  ticketTopics: Array<{ id: number; name: string }>;
  onBack: () => void;
  onRefreshAsset?: () => void;
  onDecommissioned?: () => void;
  onCreateTicket: (payload: {
    title: string;
    description: string;
    priority: TicketPriority;
    assetId: number;
    supportTopicId: number | null;
  }) => Promise<void>;
  onTransitionTicket: (ticketId: number, action: "IN_PROGRESS" | "PROVIDER" | "CLOSED" | "CANCELLED" | "REOPEN") => Promise<void>;
};

const levelLabel: Record<string, string> = {
  LEVEL_1: "Nivel 1",
  LEVEL_2: "Nivel 2",
  PROVEEDOR: "Proveedor",
};

export const AssetDetail = ({ asset, qrImageUrl, ticketTopics, onBack, onRefreshAsset, onDecommissioned, onCreateTicket, onTransitionTicket }: Props) => {
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [supportTopicId, setSupportTopicId] = useState("");
  const [uploadingCustody, setUploadingCustody] = useState(false);
  const [markingAsScrap, setMarkingAsScrap] = useState(false);
  const [showDecommissionModal, setShowDecommissionModal] = useState(false);
  const [decommissionReason, setDecommissionReason] = useState<AssetDecommissionReason>("END_OF_LIFE");
  const [decommissionNotes, setDecommissionNotes] = useState("");
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);
  const [previewDocName, setPreviewDocName] = useState("");
  const custodyFileRef = useRef<HTMLInputElement>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    api.get<{ company: CompanyInfo }>("/itam-config/company")
      .then((r) => setCompany(r.data.company))
      .catch(() => undefined);
  }, []);

  const priorityClass: Record<TicketPriority, string> = {
    LOW: "border-l-4 border-l-emerald-500",
    MEDIUM: "border-l-4 border-l-amber-500",
    HIGH: "border-l-4 border-l-orange-500",
    CRITICAL: "border-l-4 border-l-red-500 animate-pulse",
  };

  const submitTicket = async (event: FormEvent) => {
    event.preventDefault();
    if (ticketTopics.length > 0 && !supportTopicId) {
      return;
    }

    await onCreateTicket({
      title,
      description,
      priority,
      assetId: asset.id,
      supportTopicId: supportTopicId ? Number(supportTopicId) : null,
    });
    setShowModal(false);
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setSupportTopicId(ticketTopics[0] ? String(ticketTopics[0].id) : "");
  };

  const openDecommissionModal = () => {
    setDecommissionReason("END_OF_LIFE");
    setDecommissionNotes("");
    setShowDecommissionModal(true);
  };

  const closeDecommissionModal = () => {
    setShowDecommissionModal(false);
    setDecommissionReason("END_OF_LIFE");
    setDecommissionNotes("");
  };

  const submitDecommission = async (event: FormEvent) => {
    event.preventDefault();

    if (decommissionReason === "OTHER" && decommissionNotes.trim().length < 3) {
      notify.warning("Activos", 'Describe el motivo cuando seleccionas "Otro".');
      return;
    }

    setMarkingAsScrap(true);
    try {
      await api.post(`/assets/${asset.id}/decommission`, {
        reason: decommissionReason,
        notes: decommissionNotes.trim() || null,
      });
      notify.success("Activos", "Activo dado de baja correctamente.");
      closeDecommissionModal();
      onDecommissioned?.();
    } catch (error) {
      notify.error("Activos", getApiErrorMessage(error, "No fue posible dar de baja el activo."));
    } finally {
      setMarkingAsScrap(false);
    }
  };



  const printableLabelHtml = useMemo(() => {
    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: 50mm 25mm; margin: 2mm; }
            body { margin: 0; font-family: Arial, sans-serif; }
            .label { width: 46mm; height: 21mm; display: flex; gap: 2mm; align-items: center; }
            .meta { font-size: 8pt; line-height: 1.2; }
            img { width: 18mm; height: 18mm; object-fit: contain; }
          </style>
        </head>
        <body>
          <div class="label">
            <img id="qr" src="${qrImageUrl ?? ""}" />
            <div class="meta">
              <strong>${asset.assetCode}</strong><br/>
              ${asset.brand} ${asset.model}<br/>
              S/N: ${asset.serialNumber}
            </div>
          </div>
          <script>
            var img = document.getElementById('qr');
            function doPrint() { setTimeout(function(){ window.print(); }, 150); }
            if (img.complete) { doPrint(); }
            else { img.onload = doPrint; img.onerror = doPrint; }
          </script>
        </body>
      </html>
    `;
  }, [asset.assetCode, asset.brand, asset.model, asset.serialNumber, qrImageUrl]);

  const printLabel = () => {
    const blob = new Blob([printableLabelHtml], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const w = window.open(blobUrl, "_blank", "width=500,height=300");
    if (!w) { URL.revokeObjectURL(blobUrl); return; }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  };

  const printCartaResponsiva = async () => {
    const today = new Date();
    const todayStr = today.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    const assignDate = asset.assignedToDate
      ? new Date(asset.assignedToDate).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })
      : todayStr;
    const locationStr = formatAssetLocation(asset.location, asset.locationPath);

    // Fetch fresh company data at print time to guarantee the logo is available
    let co = company;
    try {
      const r = await api.get<{ company: CompanyInfo }>("/itam-config/company");
      co = r.data.company;
      setCompany(co);
    } catch { /* use cached state */ }

    const logoSrc = co?.logoData && co?.logoMime
      ? `data:${co.logoMime};base64,${co.logoData}`
      : "";
    const companyName = co?.name ?? "Empresa";
    const companyNameLegal = co?.name ?? "Empresa, S.A. de C.V.";
    const equipoDesc = `${asset.assetType?.name ?? "EQUIPO"} ${asset.brand} ${asset.model}`.trim();
    const vidaUtil = asset.usefulLifeYears ? `${asset.usefulLifeYears} a\u00f1os` : "5 a\u00f1os";
    const valorStr = asset.equipmentValue !== null && asset.equipmentValue !== undefined
      ? Number(asset.equipmentValue).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "";

    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Carta Responsiva - ${asset.assetCode}</title>
  <style>
    @page { size: letter; margin: 14mm 14mm 12mm; }
    body { font-family: 'Times New Roman', 'Segoe UI', serif; color: #000; line-height: 1.3; margin: 0; padding: 0; font-size: 10.7pt; }

    .header { text-align: center; margin-bottom: 6px; min-height: 36px; }
    .header img { max-height: 60px; margin-bottom: 4px; max-width: 220px; object-fit: contain; display: block; margin-left: auto; margin-right: auto; }
    .company { font-size: 10pt; margin-top: 2px; font-weight: bold; }
    .title { font-size: 12.5pt; font-weight: bold; text-align: center; margin: 10px 0 12px; text-transform: uppercase; letter-spacing: 0.5pt; }

    .body-text { text-align: justify; margin: 0 0 8px; font-size: 10.7pt; }
    .body-text b { font-weight: bold; }

    .signature-section { margin-top: 26px; text-align: center; }
    .signature-line { display: inline-block; width: 300px; border-bottom: 1px solid #000; margin-top: 60px; }
    .signature-label { font-size: 10pt; margin-top: 4px; }

    .footer-line { text-align: center; margin-top: 12px; font-size: 10pt; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoSrc ? `<img src="${logoSrc}" alt="Logo de la empresa" />` : ""}
    <div class="company">${companyName}</div>
  </div>

  <div class="title">CARTA RESPONSIVA EQUIPO DE C&Oacute;MPUTO</div>

  <p class="body-text">
    Por medio de la presente el C. <b>${asset.assignedToName ?? "________________________________________________"}</b> que en lo posterior se le denominar&aacute; como &ldquo;<b>EL TRABAJADOR</b>&rdquo;, declara recibir como herramienta de trabajo una <b>${equipoDesc}</b> con n&uacute;mero de serie <b>${asset.serialNumber}</b>${valorStr ? ` con un valor comercial de <b>$${valorStr} M.N.</b>` : ""} que en lo sucesivo se le denominar&aacute; &ldquo;<b>EL EQUIPO</b>&rdquo;, mismo que firma de conformidad, comprometi&eacute;ndose a mantenerlo en el estado en el que lo recibe, cuidando de dicho material como si fuera de su propiedad, en el entendido de que en caso de que sufra cualquier da&ntilde;o ocasionado por su dolo, negligencia o uso inapropiado se har&aacute; responsable de la reparaci&oacute;n del mismo. El da&ntilde;o ser&aacute; valuado por el personal que &ldquo;<b>LA EMPRESA</b>&rdquo; designe para ello, con el fin de que &ldquo;<b>EL EQUIPO</b>&rdquo;, quede nuevamente en &oacute;ptimas condiciones de funcionamiento.
  </p>

  <p class="body-text">
    En caso de que por causas inherentes al uso y desgaste normales de &ldquo;<b>EL EQUIPO</b>&rdquo;, requiera cualquier reparaci&oacute;n, el trabajador notificar&aacute; tal circunstancia a &ldquo;<b>LA EMPRESA</b>&rdquo; para que la misma le indique las condiciones en las que se llevar&aacute;n a cabo tales reparaciones o trabajo de mantenimiento sobre que del mismo habr&aacute;n de realizarse, sin costo alguno para &ldquo;<b>EL TRABAJADOR</b>&rdquo;.
  </p>

  <p class="body-text">
    El trabajador reconoce que el equipo que se le entrega s&oacute;lo podr&aacute; ser utilizado para cumplir con las tareas que le encomiende &ldquo;<b>LA EMPRESA</b>&rdquo; en su calidad de patr&oacute;n y que no podr&aacute; hacer uso del mismo para cuestiones de car&aacute;cter personal. Asimismo, se compromete a emplear el equipo &uacute;nicamente y de acuerdo con las condiciones y especificaciones que para dichos efectos haga de su conocimiento la empresa y para lo cual fue dise&ntilde;ado dicho equipo, oblig&aacute;ndose a no modificarlo ni en el hardware ni en el software, es decir no agregar ni suprimir ning&uacute;n programa de los que se encuentren cargados originalmente sin el expreso consentimiento por escrito de la empresa.
  </p>

  <p class="body-text">
    El trabajador reconoce que los derechos sobre el equipo objeto de la presente, corresponden exclusivamente a <b>${companyNameLegal}</b> por lo que a la simple solicitud de la empresa, se obliga a devolver el equipo que se le entrega a la firma del presente y, en todo caso, al terminar su relaci&oacute;n laboral con la compa&ntilde;&iacute;a dejar&aacute; de utilizar el mismo haciendo entrega de &eacute;l al personal que se le indique en el mismo estado en que lo haya recibido, salvo el deterioro que sufra &ldquo;<b>EL EQUIPO</b>&rdquo; por el uso normal para el desempe&ntilde;o de las actividades encomendadas por &ldquo;<b>LA EMPRESA</b>&rdquo;.
  </p>

  <p class="body-text">
    De acuerdo a las caracter&iacute;sticas f&iacute;sicas y t&eacute;cnicas de &ldquo;<b>EL EQUIPO</b>&rdquo;, se estima como tiempo de vida &uacute;til de <b>${vidaUtil}</b>.
  </p>

  <div class="signature-section">
    <div class="signature-line"></div>
    <div class="signature-label">Nombre y Firma de conformidad</div>
  </div>

  <p class="footer-line">
    Recib&iacute; de conformidad de parte de ${companyNameLegal} en ${locationStr || "________________"} a ${assignDate}.
  </p>

  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 300);
    };
  <\/script>
</body>
</html>`;

    // Use a Blob URL so the page has a real origin and data-URL images are allowed by the browser
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const w = window.open(blobUrl, "_blank");
    if (!w) {
      URL.revokeObjectURL(blobUrl);
      return;
    }
    // Revoke the blob URL after enough time for the print dialog to open
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  };

  return (
    <section className="animate-fade-in space-y-6">
      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={submitTicket} className="w-full max-w-xl rounded-xl border border-outline-variant bg-surface-container-lowest p-6 transition-colors">
            <h3 className="text-lg font-semibold text-on-surface">Levantar Ticket</h3>
            <div className="mt-4 space-y-3">
              <input
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface"
                placeholder="Titulo"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <textarea
                rows={4}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface"
                placeholder="Descripcion"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
              <select
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
              >
                <option value="LOW">Baja</option>
                <option value="MEDIUM">Media</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Critica</option>
              </select>
              <select
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface"
                value={supportTopicId}
                onChange={(e) => setSupportTopicId(e.target.value)}
                required={ticketTopics.length > 0}
              >
                <option value="">Seleccionar tema de soporte...</option>
                {ticketTopics.map((topic) => (
                  <option key={topic.id} value={String(topic.id)}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white">
                Crear Ticket
              </button>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-outline-variant px-3 py-1.5 text-sm text-on-surface">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {showDecommissionModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form onSubmit={submitDecommission} className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-6 transition-colors">
            <h3 className="text-lg font-semibold text-on-surface">Dar de baja activo</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              {asset.assetCode} — {asset.brand} {asset.model}
            </p>
            <p className="mt-3 text-xs text-on-surface-variant">
              Se quitará del inventario en circulación y quedará registrado quién, cuándo y por qué se dio de baja.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-xs text-on-surface-variant">
                Motivo de baja
                <select
                  className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface"
                  value={decommissionReason}
                  onChange={(e) => setDecommissionReason(e.target.value as AssetDecommissionReason)}
                  required
                >
                  {(Object.entries(assetDecommissionReasonLabels) as [AssetDecommissionReason, string][]).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs text-on-surface-variant">
                {decommissionReason === "OTHER" ? "Detalle del motivo" : "Notas adicionales (opcional)"}
                <textarea
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface"
                  placeholder={
                    decommissionReason === "OTHER"
                      ? "Describe por qué se da de baja este activo..."
                      : "Información extra sobre la baja..."
                  }
                  value={decommissionNotes}
                  onChange={(e) => setDecommissionNotes(e.target.value)}
                  required={decommissionReason === "OTHER"}
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDecommissionModal}
                className="rounded-md border border-outline-variant px-3 py-2 text-xs text-on-surface"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={markingAsScrap}
                className="rounded-md bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {markingAsScrap ? "Procesando..." : "Confirmar baja"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <AssetPanel>
        <AssetPageHeader
          icon={Monitor}
          title={`${asset.brand} ${asset.model}`}
          subtitle={asset.assetCode}
          badge={<AssetStatusBadge status={asset.status} />}
          actions={
            <>
              {asset.status !== "SCRAP" ? (
                <button
                  type="button"
                  onClick={openDecommissionModal}
                  disabled={markingAsScrap}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-error/30 bg-error-container/20 px-3 py-2 text-xs font-medium text-on-error-container transition-all duration-200 hover:bg-error-container/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Dar de baja
                </button>
              ) : null}
              <button type="button" onClick={onBack} className={btnSecondary + " !py-2 !px-3 !text-xs"}>
                <ArrowLeft size={14} />
                Volver
              </button>
            </>
          }
        />

        {asset.status === "SCRAP" ? (
          <div className="mb-6 rounded-xl border border-error/30 bg-error-container/20 p-4">
            <h3 className="text-sm font-semibold text-on-error-container">Registro de baja</h3>
            <div className="mt-2 grid gap-2 text-sm text-on-surface md:grid-cols-2">
              <p>
                <span className="font-medium text-on-surface-variant">Motivo:</span>{" "}
                {asset.decommissionReason ? assetDecommissionReasonLabels[asset.decommissionReason] : "—"}
              </p>
              <p>
                <span className="font-medium text-on-surface-variant">Fecha:</span>{" "}
                {asset.decommissionedAt ? new Date(asset.decommissionedAt).toLocaleString("es-MX") : "—"}
              </p>
              <p>
                <span className="font-medium text-on-surface-variant">Registrado por:</span>{" "}
                {asset.decommissionedBy?.fullName ?? "—"}
              </p>
              {asset.decommissionNotes ? (
                <p className="md:col-span-2">
                  <span className="font-medium text-on-surface-variant">Notas:</span> {asset.decommissionNotes}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-8">
          <AssetSection title="Identificación" description="Datos principales del equipo." icon={Tag}>
            <DetailFieldGrid cols={3}>
              <DetailField label="Código" value={asset.assetCode} icon={Hash} mono highlight />
              <DetailField label="Tipo" value={asset.assetType?.name ?? "—"} icon={Layers} />
              <DetailField label="Estado" value={assetStatusLabels[asset.status]} icon={Activity} />
              <DetailField label="Marca" value={asset.brand} icon={Tag} />
              <DetailField label="Modelo" value={asset.model} icon={Box} />
              <DetailField label="No. de serie" value={asset.serialNumber} icon={Cpu} mono />
              <DetailField label="Valor del equipo (MOI)" value={formatCurrencyMxn(asset.purchasePrice ?? asset.equipmentValue)} icon={ShieldCheck} />
              <DetailField label="Valor de rescate" value={formatCurrencyMxn(asset.salvageValue ?? 0)} icon={ShieldCheck} />
              <DetailField
                label="Ubicación"
                value={formatAssetLocation(asset.location, asset.locationPath)}
                icon={MapPin}
                className="md:col-span-2"
              />
            </DetailFieldGrid>
          </AssetSection>

          <AssetSection title="Responsable" description="Asignación actual del equipo." icon={UserCheck}>
            <DetailFieldGrid cols={2}>
              <DetailField
                label="Nombre"
                value={asset.assignedToName ?? "Sin asignar"}
                icon={UserCheck}
                highlight={Boolean(asset.assignedToName)}
              />
              <DetailField
                label="Fecha de asignación"
                value={formatDateMx(asset.assignedToDate)}
                icon={CalendarDays}
              />
            </DetailFieldGrid>
          </AssetSection>

          <AssetSection
            title="Especificaciones técnicas"
            description={
              hasTechnicalSpecs(asset)
                ? "Hardware registrado en catálogo ITAM."
                : "Sin especificaciones — común en impresoras, switches u otros dispositivos."
            }
            icon={Cpu}
          >
            {hasTechnicalSpecs(asset) ? (
              <DetailFieldGrid cols={3}>
                <DetailField label="Procesador" value={asset.processor ?? "—"} icon={Cpu} />
                <DetailField label="RAM" value={formatRam(asset.ramGb)} icon={MemoryStick} />
                <DetailField
                  label="Almacenamiento"
                  value={formatStorage(asset.storageGb, asset.storageType)}
                  icon={HardDrive}
                />
              </DetailFieldGrid>
            ) : (
              <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-6 text-center text-sm text-on-surface-variant">
                Este activo no tiene procesador, RAM ni almacenamiento registrados.
              </p>
            )}
          </AssetSection>

          <AssetSection title="Ciclo de vida" description="Compra, garantía y fin de vida útil." icon={Layers}>
            <DetailFieldGrid cols={4}>
              <DetailField label="Fecha de compra" value={formatDateMx(asset.purchaseDate)} icon={CalendarDays} />
              <DetailField label="Garantía hasta" value={formatDateMx(asset.warrantyEnd)} icon={ShieldCheck} />
              <DetailField
                label="Vida útil"
                value={asset.usefulLifeYears ? `${asset.usefulLifeYears} años` : "—"}
                icon={Activity}
              />
              <DetailField
                label="Fin de vida"
                value={formatDateMx(asset.endOfLifeDate)}
                icon={AlertTriangle}
                highlight={Boolean(
                  asset.endOfLifeDate && new Date(asset.endOfLifeDate) <= new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                )}
              />
            </DetailFieldGrid>
          </AssetSection>
        </div>
      </AssetPanel>

      {/* ── Documentos y acciones rápidas ── */}
      <AssetPanel>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-on-surface mb-4"><FileText size={18} className="text-primary" /> Documentos del activo</h3>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button type="button" onClick={printLabel} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-dark transition">
            <QrCode size={14} />
            Imprimir QR
          </button>
          <button type="button" onClick={printCartaResponsiva} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 transition">
            <Printer size={14} />
            {asset.custodyDocs && asset.custodyDocs.length > 0 ? "Generar Nueva Carta" : "Generar Carta Responsiva"}
          </button>
          <div>
            <input ref={custodyFileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploadingCustody(true);
              try {
                const fd = new FormData();
                fd.append("file", file);
                await api.post(`/assets/${asset.id}/custody-docs`, fd);
                onRefreshAsset?.();
              } catch { /* ignore */ }
              setUploadingCustody(false);
              if (custodyFileRef.current) custodyFileRef.current.value = "";
            }} />
            <button type="button" disabled={uploadingCustody} onClick={() => custodyFileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-60 transition">
              <Upload size={14} />
              {uploadingCustody ? "Subiendo..." : "Subir Carta Firmada"}
            </button>
          </div>
        </div>

        {/* Lista de cartas */}
        {asset.custodyDocs && asset.custodyDocs.length > 0 ? (
          <div className="space-y-2">
            {asset.custodyDocs.map((doc: CustodyDocument) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText size={16} className="shrink-0 text-blue-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{doc.originalName}</p>
                    <p className="text-[11px] text-on-surface-variant">
                      {doc.assignedToName} · {new Date(doc.createdAt).toLocaleDateString("es-MX")} · {(doc.sizeBytes / 1024).toFixed(0)} KB
                      {doc.uploadedBy ? ` · Subido por ${doc.uploadedBy.fullName}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" onClick={() => {
                    setPreviewDocUrl(`/api/assets/${asset.id}/custody-docs/${doc.id}/download`);
                    setPreviewDocName(doc.originalName);
                  }} className="rounded-lg border border-blue-200 dark:border-blue-800 p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition" title="Ver documento">
                    <Eye size={14} />
                  </button>
                  <a href={`/api/assets/${asset.id}/custody-docs/${doc.id}/download`} target="_blank" rel="noreferrer" className="rounded-lg border border-outline-variant p-1.5 text-on-surface-variant hover:bg-surface-container-high transition" title="Descargar">
                    <Download size={14} />
                  </a>
                  <button type="button" onClick={async () => {
                    try {
                      await api.delete(`/assets/${asset.id}/custody-docs/${doc.id}`);
                      onRefreshAsset?.();
                    } catch { /* ignore */ }
                  }} className="rounded-lg border border-red-200 dark:border-red-800 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition" title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant italic">No hay cartas responsivas almacenadas.</p>
        )}
      </AssetPanel>

      {/* ── PDF Viewer Modal ── */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreviewDocUrl(null)}>
          <div className="relative flex flex-col w-full max-w-7xl h-[92vh] rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-outline-variant px-5 py-3 bg-surface-container-low">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-on-surface truncate">
                <FileText size={16} className="text-blue-500 shrink-0" />
                {previewDocName}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <a href={previewDocUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-2.5 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high transition">
                  <Download size={13} /> Descargar
                </a>
                <button type="button" onClick={() => setPreviewDocUrl(null)} className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-slate-600 dark:hover:text-slate-200 transition">
                  <XIcon size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <PdfViewer url={previewDocUrl} />
            </div>
          </div>
        </div>
      )}

      <AssetPanel>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-on-surface"><TicketPlus size={18} className="text-primary" /> Historial de tickets</h3>
          <button
            type="button"
            onClick={() => {
              setSupportTopicId(ticketTopics[0] ? String(ticketTopics[0].id) : "");
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark transition"
          >
            <TicketPlus size={14} />
            Levantar Ticket
          </button>
        </div>
        <div className="space-y-3">
          {asset.tickets && asset.tickets.length > 0 ? (
            asset.tickets.map((ticket) => (
              <article key={ticket.id} className={`rounded-xl border border-outline-variant bg-surface-container-low p-4 ${priorityClass[ticket.priority]}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-on-surface">{ticket.title}</h4>
                    <p className="mt-1 text-xs text-on-surface-variant">{ticket.description}</p>
                  </div>
                  <span className="inline-flex items-center rounded-lg bg-primary/15 px-2 py-1 text-[10px] font-semibold text-primary">{ticket.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-on-surface-variant">
                  <span className="rounded bg-surface-container-high px-2 py-1">Prioridad: {ticket.priority}</span>
                  <span className="rounded bg-surface-container-high px-2 py-1">Escalacion: {levelLabel[ticket.level] ?? ticket.level}</span>
                  <span className="rounded bg-surface-container-high px-2 py-1">
                    Asignado: {ticket.assignedTo?.fullName ?? "Sin asignar"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ticket.status === "OPEN" && (
                    <button
                      type="button"
                      onClick={() => onTransitionTicket(ticket.id, "IN_PROGRESS")}
                      className="rounded border border-outline-variant px-2 py-1 text-[11px] text-on-surface hover:bg-surface-container-high"
                    >
                      En Proceso
                    </button>
                  )}
                  {ticket.status === "IN_PROGRESS" && (
                    <button
                      type="button"
                      onClick={() => onTransitionTicket(ticket.id, "PROVIDER")}
                      className="rounded bg-purple-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-purple-700"
                    >
                      Enviar a Proveedor
                    </button>
                  )}
                  {ticket.status !== "CLOSED" && ticket.status !== "CANCELLED" && (
                    <>
                      <button
                        type="button"
                        onClick={() => onTransitionTicket(ticket.id, "CLOSED")}
                        className="rounded border border-outline-variant px-2 py-1 text-[11px] text-on-surface hover:bg-surface-container-high"
                      >
                        Cerrar
                      </button>
                      <button
                        type="button"
                        onClick={() => onTransitionTicket(ticket.id, "CANCELLED")}
                        className="rounded border border-outline-variant px-2 py-1 text-[11px] text-on-surface-variant hover:bg-surface-container-high"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                  {ticket.status === "CLOSED" && (
                    <button
                      type="button"
                      onClick={() => onTransitionTicket(ticket.id, "REOPEN")}
                      className="rounded bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                    >
                      Reabrir
                    </button>
                  )}
                </div>
                <div className="mt-4 rounded border border-outline-variant bg-white/70 dark:bg-surface-dark/70 p-3 transition-colors">
                  <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Linea de Tiempo</h5>
                  <ol className="space-y-2 border-l border-outline-variant pl-3">
                    {ticket.events?.map((event) => (
                      <li key={event.id} className="relative">
                        <span className="absolute -left-[18px] top-1 h-2 w-2 rounded-full bg-primary" />
                        <p className="text-xs text-on-surface">{event.action}</p>
                        <p className="text-[11px] text-on-surface-variant">
                          {event.actor?.fullName ?? "Sistema"} - {new Date(event.createdAt).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-on-surface-variant">Este activo no tiene tickets registrados.</p>
          )}
        </div>
      </AssetPanel>
    </section>
  );
};
