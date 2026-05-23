import { useState } from 'react';
import type { ImportToElpxResult, SemanticDocument } from '../types';
import { semanticDocumentToPrintHtml } from '../core/renderers/html-print/semanticDocumentToPrintHtml';

interface DownloadButtonProps {
  result: ImportToElpxResult;
  semanticDoc: SemanticDocument | null;
  themeId?: string;
}

/** Icono de descarga (flecha hacia abajo) */
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

/** Icono representativo de ELPX (documento con acento azul) */
function ElpxIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 96 96"
      className="download-btn-icon"
      aria-hidden="true"
    >
      <path
        stroke="#CBD5E1"
        strokeWidth="2"
        fill="#fff"
        strokeMiterlimit="10"
        d="M67.1716 7H27c-1.1046 0-2 .8954-2 2v78c0 1.1046.8954 2 2 2h58c1.1046 0 2-.8954 2-2V26.8284c0-.5304-.2107-1.0391-.5858-1.4142L68.5858 7.5858C68.2107 7.2107 67.702 7 67.1716 7z"
      />
      <path fill="none" stroke="#CBD5E1" strokeWidth="2" d="M67 7v18c0 1.1046.8954 2 2 2h18" />
      <path
        fill="#BDD8FF"
        d="M79 61H48v-2h31c.5523 0 1 .4477 1 1s-.4477 1-1 1zm0-6H48v-2h31c.5523 0 1 .4477 1 1s-.4477 1-1 1zm0-6H48v-2h31c.5523 0 1 .4477 1 1s-.4477 1-1 1zm0-6H48v-2h31c.5523 0 1 .4477 1 1s-.4477 1-1 1zm0 24H48v-2h31c.5523 0 1 .4477 1 1s-.4477 1-1 1z"
      />
      <path
        fill="#1B6EC2"
        d="M12 74h32c2.2091 0 4-1.7909 4-4V38c0-2.2091-1.7909-4-4-4H12c-2.2091 0-4 1.7909-4 4v32c0 2.2091 1.7909 4 4 4z"
      />
      <path
        fill="#fff"
        d="M21.6245 60.6455c.0661.522.109.9769.1296 1.3657h.0762c.0306-.3685.0889-.8129.1751-1.3349.0862-.5211.1703-.961.2517-1.319L25.7911 44h4.5702l3.6562 15.1272c.183.7468.3353 1.6973.457 2.8532h.0608c.0508-.7979.1777-1.7184.3809-2.7615L37.8413 44H42l-5.1183 22h-4.86l-3.4885-14.5744c-.1016-.4197-.2158-.9663-.3428-1.6417-.127-.6745-.2057-1.1656-.236-1.4724h-.0608c-.0407.358-.1195.8896-.2364 1.595-.1169.7062-.211 1.2273-.2819 1.565L24.1 66h-4.9357L14 44h4.2349l3.1843 15.3882c.0709.3165.1392.7362.2053 1.2573z"
      />
    </svg>
  );
}

/** Icono PDF inline (igual que el pdf.svg provisto) */
function PdfIcon({ disabled }: { disabled?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      className="download-btn-icon"
      aria-hidden="true"
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <path d="M16 4h22l14 14v34a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8V12a8 8 0 0 1 8-8Z" fill="#d93025" />
      <path d="M38 4v12a4 4 0 0 0 4 4h10" fill="#f28b82" />
      <text
        x="32"
        y="39"
        fill="#fff"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="13"
        fontWeight="700"
        textAnchor="middle"
        letterSpacing="0.3"
      >
        PDF
      </text>
    </svg>
  );
}

export function DownloadButton({ result, semanticDoc, themeId }: DownloadButtonProps) {
  const [printLoading, setPrintLoading] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

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

  return (
    <div className="result-downloads">
      {/* Descarga ELPX */}
      <button onClick={handleDownloadElpx} className="btn-download-elpx">
        <ElpxIcon />
        <div className="download-btn-body">
          <span className="download-btn-title">Descargar proyecto eXeLearning</span>
          <span className="download-btn-sub">{result.filename}</span>
        </div>
        <DownloadArrow />
      </button>

      {/* Exportar PDF */}
      <button
        onClick={handleExportPrint}
        className="btn-download-pdf"
        disabled={printLoading || !semanticDoc}
        title={!semanticDoc ? 'El documento semántico no está disponible' : undefined}
      >
        <PdfIcon disabled={printLoading || !semanticDoc} />
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
