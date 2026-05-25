import { useState } from 'react';
import type { ImportToElpxResult, SemanticDocument } from '../types';
import { semanticDocumentToPrintHtml } from '../core/renderers/html-print/semanticDocumentToPrintHtml';

interface DownloadButtonProps {
  result: ImportToElpxResult;
  semanticDoc: SemanticDocument | null;
  themeId?: string;
}

function DownloadArrow() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="download-btn-arrow"
      style={{ width: 16, height: 16 }}
      aria-hidden="true"
    >
      <path d="M10 3v10M6 9l4 4 4-4M3 17h14" />
    </svg>
  );
}

export function DownloadButton({ result, semanticDoc, themeId }: DownloadButtonProps) {
  const [printLoading, setPrintLoading] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [useCoverImage, setUseCoverImage] = useState(true);

  const base = import.meta.env.BASE_URL;

  // ── Descarga ELPX ────────────────────────────────────────────────────────
  const handleDownloadElpx = () => {
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Exportar Print HTML (Paged.js) ───────────────────────────────────────
  const handleExportPrint = async () => {
    if (!semanticDoc) return;
    setPrintLoading(true);
    setPrintError(null);

    try {
      const { html } = await semanticDocumentToPrintHtml(semanticDoc, {
        themeId,
        cover: { date: String(new Date().getFullYear()) },
        includeCover: true,
        includeToc: true,
        useCoverImage,
      });

      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');

      if (win) {
        win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename.replace('.elpx', '_print.html');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Error al generar el documento de impresión');
    } finally {
      setPrintLoading(false);
    }
  };

  const pdfDisabled = printLoading || !semanticDoc;

  return (
    <div className="result-downloads">
      {/* Descarga ELPX */}
      <button onClick={handleDownloadElpx} className="btn-download-elpx">
        <img
          src={`${base}elpx-icon.png`}
          alt=""
          className="download-btn-icon"
          aria-hidden="true"
        />
        <div className="download-btn-body">
          <span className="download-btn-title">Descargar proyecto eXeLearning</span>
          <span className="download-btn-sub">{result.filename}</span>
        </div>
        <DownloadArrow />
      </button>

      {/* Opción imagen de portada */}
      <label className="pdf-cover-toggle">
        <span className="pdf-cover-toggle__label">Imagen de portada en PDF</span>
        <button
          role="switch"
          aria-checked={useCoverImage}
          onClick={() => setUseCoverImage((v) => !v)}
          className={`toggle-switch ${useCoverImage ? 'toggle-switch--on' : ''}`}
          title={useCoverImage ? 'Desactivar imagen de portada' : 'Activar imagen de portada'}
        >
          <span className="toggle-switch__thumb" />
        </button>
      </label>

      {/* Exportar PDF */}
      <button
        onClick={handleExportPrint}
        className="btn-download-pdf"
        disabled={pdfDisabled}
        title={!semanticDoc ? 'El documento semántico no está disponible' : undefined}
      >
        <img
          src={`${base}pdf.png`}
          alt=""
          className="download-btn-icon"
          aria-hidden="true"
          style={{ opacity: pdfDisabled ? 0.4 : 1 }}
        />
        <div className="download-btn-body">
          <span className="download-btn-title">
            {printLoading ? 'Generando vista de impresión…' : 'Vista previa para imprimir / PDF'}
          </span>
          <span className="download-btn-sub">
            {printLoading ? 'Por favor espera' : 'Abre Paged.js · Ctrl+P para guardar como PDF'}
          </span>
        </div>
        {!printLoading && <DownloadArrow />}
      </button>

      {printError && (
        <div className="download-error">
          Error al generar la vista de impresión: {printError}
        </div>
      )}
    </div>
  );
}
