import { useState } from 'react';
import { Toggle } from './Toggle';
import type { ImportToElpxResult, SemanticDocument } from '../types';
// El módulo de impresión embebe Paged.js (~491 KB); se carga de forma diferida
// (import dinámico en handleExportPrint) para no inflar el bundle inicial.

interface DownloadButtonProps {
  result: ImportToElpxResult;
  semanticDoc: SemanticDocument | null;
  themeId?: string;
  /** Función para regenerar el ELPX con opciones diferentes (nav expandido, etc.) */
  onRegenerateElpx?: (opts: { navExpanded: boolean }) => Promise<{ blob: Blob; filename: string }>;
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

export function DownloadButton({ result, semanticDoc, themeId, onRegenerateElpx }: DownloadButtonProps) {
  const [printLoading, setPrintLoading] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const [useCoverImage, setUseCoverImage] = useState(false);
  const [numberedHeadings, setNumberedHeadings] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);
  const [elpxLoading, setElpxLoading] = useState(false);
  const [elpxError, setElpxError] = useState<string | null>(null);

  const base = import.meta.env.BASE_URL;

  // ── Descarga ELPX ────────────────────────────────────────────────────────
  const handleDownloadElpx = async () => {
    // Si no se necesita regenerar (índice plegado, el default), descarga directa.
    if (!navExpanded || !onRegenerateElpx) {
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // Con índice desplegado: regenerar el ELPX al vuelo con la opción activada.
    setElpxLoading(true);
    setElpxError(null);
    try {
      const { blob, filename } = await onRegenerateElpx({ navExpanded: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setElpxError(err instanceof Error ? err.message : 'Error al generar el proyecto eXeLearning');
    } finally {
      setElpxLoading(false);
    }
  };

  // ── Exportar Print HTML (Paged.js) ───────────────────────────────────────
  const handleExportPrint = async () => {
    if (!semanticDoc) return;
    setPrintLoading(true);
    setPrintError(null);
    setPrintNotice(null);

    try {
      const { semanticDocumentToPrintHtml } = await import(
        '../core/renderers/html-print/semanticDocumentToPrintHtml'
      );
      const { html } = await semanticDocumentToPrintHtml(semanticDoc, {
        themeId,
        cover: { date: String(new Date().getFullYear()) },
        includeCover: true,
        includeToc: true,
        useCoverImage,
        numberedHeadings,
      });

      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');

      if (win) {
        win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
      } else {
        // Popup bloqueado: descargar el HTML e informar de cómo abrirlo.
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename.replace('.elpx', '_print.html');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setPrintNotice(
          'Tu navegador bloqueó la ventana emergente, así que se ha descargado el ' +
            'documento de impresión. Ábrelo y usa «Imprimir → Guardar como PDF». ' +
            'Permite las ventanas emergentes de este sitio para abrirlo directamente.',
        );
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
      {/* Descarga ELPX + switch índice */}
      <div className="pdf-download-group">
        <button onClick={handleDownloadElpx} className="btn-download-elpx" disabled={elpxLoading}>
          <img
            src={`${base}img/elpx-icon.png`}
            alt=""
            className="download-btn-icon"
            aria-hidden="true"
            style={{ opacity: elpxLoading ? 0.4 : 1 }}
          />
          <div className="download-btn-body">
            <span className="download-btn-title">
              {elpxLoading ? 'Generando…' : 'Descargar proyecto eXeLearning'}
            </span>
            <span className="download-btn-sub">{result.filename}</span>
          </div>
          {!elpxLoading && <DownloadArrow />}
        </button>
        <div className="toggle-group">
          <Toggle
            label="Menú lateral desplegado"
            checked={navExpanded}
            onChange={() => setNavExpanded((v) => !v)}
          />
        </div>
      </div>

      {elpxError && (
        <div className="download-error">
          Error al generar el proyecto eXeLearning: {elpxError}
        </div>
      )}

      {/* Exportar PDF + switch imagen de portada */}
      <div className="pdf-download-group">
        <button
          onClick={handleExportPrint}
          className="btn-download-pdf"
          disabled={pdfDisabled}
          title={!semanticDoc ? 'El documento semántico no está disponible' : undefined}
        >
          <img
            src={`${base}img/pdf.png`}
            alt=""
            className="download-btn-icon"
            aria-hidden="true"
            style={{ opacity: pdfDisabled ? 0.4 : 1 }}
          />
          <div className="download-btn-body">
            <span className="download-btn-title">
              {printLoading ? 'Generando vista de impresión…' : 'Vista previa para imprimir / PDF'}
            </span>
            <span className="download-btn-sub-browser">
              Los mejores resultados se optienen con los navegadores Google Chrome <img src={`${base}img/minichrome.png`} alt="Chrome" className="browser-icon" aria-hidden="true" /> o Microsoft Edge <img src={`${base}img/miniedge.png`} alt="Edge" className="browser-icon" aria-hidden="true" />
            </span>
          </div>
          {!printLoading && <DownloadArrow />}
        </button>
        <div className="toggle-group">
          <div className="pdf-toggle-stack">
            <Toggle
              label="Foto de portada"
              checked={useCoverImage}
              onChange={() => setUseCoverImage((v) => !v)}
            />
            <Toggle
              label="Numerar títulos"
              caption="1., 1.1., 1.1.1.…"
              checked={numberedHeadings}
              onChange={() => setNumberedHeadings((v) => !v)}
            />
          </div>
        </div>
      </div>

      {printError && (
        <div className="download-error">
          Error al generar la vista de impresión: {printError}
        </div>
      )}

      {printNotice && (
        <div className="download-notice">{printNotice}</div>
      )}
    </div>
  );
}
