import { useState } from 'react';
import type { ImportToElpxResult, SemanticDocument } from '../types';
import { semanticDocumentToPrintHtml } from '../core/renderers/html-print/semanticDocumentToPrintHtml';

interface DownloadButtonProps {
  result: ImportToElpxResult;
  /** Documento semántico para el renderer print. null mientras se convierte. */
  semanticDoc: SemanticDocument | null;
  /** ID del tema seleccionado por el usuario. */
  themeId?: string;
}

export function DownloadButton({ result, semanticDoc, themeId }: DownloadButtonProps) {
  const [printLoading, setPrintLoading] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  // ── Descarga ELPX ─────────────────────────────────────────────────────────
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

  // ── Exportar Print HTML (abre en ventana nueva para imprimir con Paged.js) ─
  const handleExportPrint = async () => {
    if (!semanticDoc) return;

    setPrintLoading(true);
    setPrintError(null);

    try {
      const { html } = await semanticDocumentToPrintHtml(semanticDoc, {
        themeId,
        cover: {
          // Año actual como fecha de portada
          date: String(new Date().getFullYear()),
        },
        includeCover: true,
        includeToc: true,
      });

      // Abrir en ventana nueva — Paged.js pagina automáticamente
      // El usuario imprime con Ctrl+P → "Guardar como PDF"
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');

      // Limpiar URL cuando la ventana cargue
      if (win) {
        win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
      } else {
        // Fallback: descargar como fichero si el navegador bloqueó el popup
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

  return (
    <div className="download-buttons">

      {/* Botón principal: descargar ELPX */}
      <button onClick={handleDownloadElpx} className="btn-download">
        Descargar {result.filename}
      </button>

      {/* Botón secundario: exportar print/PDF */}
      <button
        onClick={handleExportPrint}
        className="btn-download-pdf"
        disabled={printLoading || !semanticDoc}
        title={!semanticDoc ? 'El documento semántico no está disponible' : undefined}
      >
        {printLoading ? 'Generando vista de impresión...' : 'Vista previa para imprimir / PDF'}
      </button>

      {printError && (
        <div className="download-error">
          Error al generar la vista de impresión: {printError}
        </div>
      )}

    </div>
  );
}
