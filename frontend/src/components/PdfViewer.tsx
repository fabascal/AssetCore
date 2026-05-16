import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

type Props = {
  url: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
let pdfjsLib: any = null;
const loadPdfJs = async () => {
  if (pdfjsLib) return pdfjsLib;
  const lib = await import("pdfjs-dist/build/pdf.mjs" as any);
  lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
  pdfjsLib = lib;
  return lib;
};

export const PdfViewer = ({ url }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [error, setError] = useState("");

  /* Load document */
  useEffect(() => {
    let cancelled = false;
    let loadingTask: any = null;
    setError("");

    loadPdfJs()
      .then((lib) => {
        if (cancelled) return;
        loadingTask = lib.getDocument(url);
        return loadingTask.promise;
      })
      .then((doc: any) => {
        if (cancelled || !doc) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el PDF");
      });

    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
    };
  }, [url]);

  /* Render current page */
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    pdfDoc.getPage(currentPage).then((page: any) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      page.render({ canvasContext: ctx, viewport });
    });

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, scale]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (!pdfDoc) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="inline-flex items-center gap-2 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Cargando documento...
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-center gap-3 border-b border-border-light dark:border-border-dark bg-slate-100 dark:bg-surface-dark px-4 py-2">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          className="rounded-md p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-surface-lighter disabled:opacity-30 transition"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 min-w-[80px] text-center">
          {currentPage} / {numPages}
        </span>
        <button
          type="button"
          disabled={currentPage >= numPages}
          onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          className="rounded-md p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-surface-lighter disabled:opacity-30 transition"
        >
          <ChevronRight size={18} />
        </button>
        <div className="mx-2 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        <button
          type="button"
          disabled={scale <= 0.5}
          onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
          className="rounded-md p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-surface-lighter disabled:opacity-30 transition"
        >
          <ZoomOut size={16} />
        </button>
        <span className="text-xs text-slate-500 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          disabled={scale >= 3}
          onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))}
          className="rounded-md p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-surface-lighter disabled:opacity-30 transition"
        >
          <ZoomIn size={16} />
        </button>
      </div>
      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-slate-300 dark:bg-slate-800">
        <div className="flex justify-center p-4">
          <canvas ref={canvasRef} className="shadow-lg" />
        </div>
      </div>
    </div>
  );
};
