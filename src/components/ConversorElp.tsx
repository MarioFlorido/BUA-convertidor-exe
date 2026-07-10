import React, { useEffect, useRef, useState } from 'react';
import { parseElp } from '../core/elp/elpParser';
import { convertParsedElpToDocx } from '../core/elp/elpToDocx';

/**
 * Conversor de elp antiguo a docx — convierte un paquete .elp del eXeLearning
 * clásico (2.x) en un Word editable. Pensado como paso previo al flujo
 * normal: .elp → Word → (retoques del editor) → convertidor → .elpx.
 *
 * La conversión es local (como todo en la app) y deliberadamente sencilla:
 * texto, imágenes, listas, tablas y enlaces. Lo que Word no puede representar
 * (vídeos incrustados, actividades interactivas) se sustituye por una nota
 * visible y se lista en los avisos.
 */

type Stage = 'drop' | 'done';

interface ConversorElpProps {
  onBack: () => void;
}

interface ConversionSummary {
  pages: number;
  idevices: number;
  images: number;
  warnings: string[];
}

export function ConversorElp({ onBack }: ConversorElpProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('drop');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [summary, setSummary] = useState<ConversionSummary | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadName, setDownloadName] = useState('');

  // El blob URL se libera al desmontar el componente o al reemplazarlo.
  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const handleFile = async (file: File | undefined | null) => {
    if (!file || busy) return;
    if (!file.name.toLowerCase().endsWith('.elp')) {
      setError('El archivo debe ser un .elp del eXeLearning clásico.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const parsed = parseElp(new Uint8Array(await file.arrayBuffer()));
      const { blob, warnings } = await convertParsedElpToDocx(parsed);

      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(URL.createObjectURL(blob));
      setDownloadName(file.name.replace(/\.elp$/i, '') + '.docx');
      setFileName(file.name);
      setSummary({
        pages: parsed.pages.length,
        idevices: parsed.pages.reduce((sum, page) => sum + page.idevices.length, 0),
        images: parsed.resources.size,
        warnings: [...parsed.warnings, ...warnings],
      });
      setStage('done');
    } catch (err) {
      setError(
        'No se pudo convertir el archivo: ' + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleReset = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setStage('drop');
    setBusy(false);
    setError('');
    setFileName('');
    setSummary(null);
    setDownloadUrl('');
    setDownloadName('');
  };

  return (
    <div className="conversor-elp">
      <div className="limpiador-header">
        <button onClick={stage === 'drop' ? onBack : handleReset} className="btn-cancel">
          {stage === 'drop' ? '← Volver' : 'Convertir otro archivo'}
        </button>
      </div>

      <h2 className="section-heading">Conversor de elp antiguo a docx</h2>
      <p className="section-sub">
        Convierte un paquete <strong>.elp</strong> del eXeLearning clásico (2.x) en un documento
        Word con su texto e imágenes. Después podrás revisarlo, pasarlo por el Limpiador si hace
        falta y convertirlo en un curso nuevo con el convertidor.
      </p>

      {/* ── Cargar el .elp ── */}
      {stage === 'drop' && (
        <div className="limpiador-drop">
          {busy ? (
            <div className="conversor-elp-busy" role="status">
              <div className="pipeline-spinner" />
              <p>Convirtiendo el paquete… Los archivos con muchas imágenes pueden tardar unos segundos.</p>
            </div>
          ) : (
            <div
              className="upload-zone"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('drag-over');
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              aria-label="Área de carga de paquete eXeLearning antiguo"
            >
              <div className="upload-content">
                <h2>Sube tu paquete .elp</h2>
                <p>Arrastra y suelta un archivo .elp o haz clic para seleccionar</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".elp"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  style={{ display: 'none' }}
                  tabIndex={-1}
                />
                <button
                  className="btn-upload"
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                >
                  Seleccionar archivo
                </button>
                {error && <p className="upload-file-error">{error}</p>}
              </div>
            </div>
          )}

          <div className="limpiador-info-cards">
            <div className="limpiador-info-card">
              <h3>Qué conserva</h3>
              <p>Las páginas como títulos de Word, el texto con su formato básico, las imágenes, las listas, las tablas y los enlaces externos.</p>
            </div>
            <div className="limpiador-info-card">
              <h3>Qué se pierde</h3>
              <p>Los estilos visuales del curso y el contenido interactivo (vídeos incrustados, actividades). Todo lo omitido queda anotado en el propio Word y en el resumen final.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Resultado ── */}
      {stage === 'done' && summary && (
        <div className="result-section">
          <div className="result-success-card">
            <div className="result-success-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>
            <div className="result-success-body">
              <h2>Word generado</h2>
              <p>{fileName}</p>
            </div>
          </div>

          <div className="result-stats-card">
            <div className="stat-item">
              <span className="stat-label">Páginas</span>
              <span className="stat-value">{summary.pages}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Bloques de texto</span>
              <span className="stat-value">{summary.idevices}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Recursos</span>
              <span className="stat-value">{summary.images}</span>
            </div>
          </div>

          {summary.warnings.length > 0 && (
            <div className="alert alert-warning conversor-elp-warnings">
              Avisos ({summary.warnings.length}): este contenido no se puede representar en Word y
              se ha sustituido por una nota en el documento.
              <ul className="tag-issue-list">
                {summary.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <a className="btn-upload conversor-elp-download" href={downloadUrl} download={downloadName}>
            Descargar {downloadName}
          </a>

          <p className="section-sub conversor-elp-next">
            Siguiente paso: abre el Word, reorganiza lo que necesites y súbelo al convertidor para
            generar el curso nuevo con un estilo de la BUA.
          </p>
        </div>
      )}
    </div>
  );
}
