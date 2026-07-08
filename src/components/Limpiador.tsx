import React, { useMemo, useRef, useState } from 'react';
import { Toggle } from './Toggle';
import {
  DocxCleaner,
  type BlockRole,
  type CleanerBlock,
} from '../core/limpiador/docxCleaner';

/**
 * Limpiador de Word — prepara un DOCX "sucio" (portada, índice, formato
 * visual…) para pasarlo por el convertidor. Utilidad creada por Silvia Gomis,
 * integrada aquí con el design system de la app.
 */

type Stage = 'drop' | 'review' | 'done';
type Filter = 'estructura' | 'todo';

interface LimpiadorProps {
  onBack: () => void;
}

const ROLE_OPTIONS: { value: BlockRole; label: string }[] = [
  { value: 'remove', label: 'Quitar' },
  { value: 'h1', label: 'Título 1 (página)' },
  { value: 'h2', label: 'Título 2 (sección)' },
  { value: 'h3', label: 'Título 3' },
  { value: 'h4', label: 'Título 4' },
  { value: 'normal', label: 'Texto normal' },
  { value: 'box:importante', label: 'Caja importante' },
  { value: 'box:definición', label: 'Caja definición' },
  { value: 'box:ejemplo', label: 'Caja ejemplo' },
  { value: 'box:pie', label: 'Pie (figura/tabla)' },
  { value: 'keep', label: 'Mantener igual' },
];

const TABLE_OPTIONS: { value: BlockRole; label: string }[] = [
  { value: 'table:horizontal', label: 'Tabla horizontal' },
  { value: 'table:vertical', label: 'Tabla vertical' },
  { value: 'remove', label: 'Quitar' },
];

/** Chip de tipo (caja/tabla) por rol. */
const CHIP_BY_ROLE: Record<string, { label: string; mod: string }> = {
  'box:importante': { label: 'Importante', mod: 'importante' },
  'box:definición': { label: 'Definición', mod: 'definicion' },
  'box:ejemplo': { label: 'Ejemplo', mod: 'ejemplo' },
  'box:pie': { label: 'Pie', mod: 'pie' },
  'table:horizontal': { label: 'Tabla', mod: 'tabla' },
  'table:vertical': { label: 'Tabla', mod: 'tabla' },
};

function boxTagOf(b: CleanerBlock | undefined): string | null {
  return b && b.role.indexOf('box:') === 0 ? b.role.slice(4) : null;
}

export function Limpiador({ onBack }: LimpiadorProps) {
  const cleanerRef = useRef<DocxCleaner | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('drop');
  const [fileName, setFileName] = useState('');
  const [blocks, setBlocks] = useState<CleanerBlock[]>([]);
  const [optFormat, setOptFormat] = useState(true);
  const [optHeader, setOptHeader] = useState(true);
  const [filter, setFilter] = useState<Filter>('estructura');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadName, setDownloadName] = useState('');

  const base = import.meta.env.BASE_URL;

  // ── Carga ────────────────────────────────────────────────────────────────
  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const cleaner = new DocxCleaner();
      const loaded = await cleaner.load(file);
      cleanerRef.current = cleaner;
      setFileName(file.name);
      setBlocks(loaded);
      setStage('review');
    } catch (err) {
      setError('No se pudo abrir el archivo: ' + (err instanceof Error ? err.message : String(err)));
      setStage('drop');
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    handleFile(e.dataTransfer.files?.[0]);
  };

  // ── Edición ──────────────────────────────────────────────────────────────
  const setRole = (i: number, role: BlockRole) => {
    setBlocks((prev) => prev.map((b) => (b.i === i ? { ...b, role } : b)));
  };

  const shiftLevels = (delta: number) => {
    setBlocks((prev) =>
      prev.map((b) => {
        const m = /^h([1-4])$/.exec(b.role);
        if (!m) return b;
        const lvl = Math.max(1, Math.min(4, +m[1] + delta));
        return { ...b, role: ('h' + lvl) as BlockRole };
      }),
    );
  };

  // ── Generación ───────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!cleanerRef.current) return;
    setBusy(true);
    setError('');
    try {
      const blob = await cleanerRef.current.generate(blocks, {
        stripFormat: optFormat,
        removeHeaderFooter: optHeader,
      });
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(URL.createObjectURL(blob));
      setDownloadName(fileName.replace(/\.docx$/i, '') + ' (limpio).docx');
      setStage('done');
    } catch (err) {
      setError('Error al generar: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    cleanerRef.current = null;
    setStage('drop');
    setFileName('');
    setBlocks([]);
    setBusy(false);
    setError('');
    setDownloadUrl('');
    setDownloadName('');
    setFilter('estructura');
  };

  // ── Derivados de la revisión ─────────────────────────────────────────────
  const counts = useMemo(
    () => ({
      h1: blocks.filter((b) => b.role === 'h1').length,
      h2: blocks.filter((b) => b.role === 'h2').length,
      box: blocks.filter((b) => b.role.indexOf('box:') === 0).length,
      remove: blocks.filter((b) => b.role === 'remove').length,
    }),
    [blocks],
  );

  const visible = useMemo(
    () =>
      filter === 'estructura'
        ? blocks.filter(
            (b) =>
              ['heading', 'box', 'table', 'cover', 'toc'].includes(b.kind) ||
              /^(h[1-4]|box:|table:|remove)/.test(b.role),
          )
        : blocks.filter((b) => b.kind !== 'empty'),
    [blocks, filter],
  );

  // ── Render de una fila de bloque ─────────────────────────────────────────
  const renderRow = (b: CleanerBlock) => {
    const mh = /^h([1-4])$/.exec(b.role);
    const removed = b.role === 'remove';
    const chip = CHIP_BY_ROLE[b.role];
    const isLabelPara =
      b.kind === 'box' && /^(ejemplo|importante|definici[oó]n|pie)$/i.test((b.text || '').trim());
    const indent = mh ? (parseInt(mh[1], 10) - 1) * 20 : b.kind === 'heading' ? 0 : 14;
    const options = b.kind === 'table' ? TABLE_OPTIONS : ROLE_OPTIONS;
    const rowMods = [
      'limpiador-row',
      removed ? 'limpiador-row--removed' : '',
      mh ? `limpiador-row--h${mh[1]}` : '',
      chip ? `limpiador-row--${chip.mod}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div key={b.i} className={rowMods}>
        <div className="limpiador-row-bar" />
        <div className="limpiador-row-body" style={{ paddingLeft: indent }}>
          {chip && <span className={`limpiador-chip limpiador-chip--${chip.mod}`}>{chip.label}</span>}
          <span className="limpiador-row-text">
            {isLabelPara ? `${b.text} · etiqueta, se elimina` : b.text || '—'}
          </span>
        </div>
        <select
          className="limpiador-row-select"
          value={b.role}
          onChange={(e) => setRole(b.i, e.target.value as BlockRole)}
          aria-label="Tipo de bloque"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  /** Filas con marcadores [etiqueta]…[fin] alrededor de cada grupo de cajas. */
  const renderRows = () => {
    const out: React.ReactNode[] = [];
    visible.forEach((b) => {
      const tag = boxTagOf(b);
      if (tag && boxTagOf(blocks[b.i - 1]) !== tag) {
        out.push(
          <div key={`m-${b.i}`} className={`limpiador-marker limpiador-marker--${tag === 'definición' ? 'definicion' : tag}`}>
            [{tag}]
          </div>,
        );
      }
      if (b.kind === 'table' && b.role.indexOf('table:') === 0) {
        out.push(
          <div key={`t-${b.i}`} className="limpiador-marker limpiador-marker--tabla">
            [{b.role.split(':')[1]}]
          </div>,
        );
      }
      out.push(renderRow(b));
      if (tag && boxTagOf(blocks[b.i + 1]) !== tag) {
        out.push(
          <div key={`f-${b.i}`} className="limpiador-marker limpiador-marker--fin">
            [fin]
          </div>,
        );
      }
    });
    return out;
  };

  // ── Pantallas ────────────────────────────────────────────────────────────
  return (
    <div className="limpiador">
      <div className="limpiador-header">
        <button onClick={stage === 'drop' ? onBack : handleReset} className="btn-cancel">
          {stage === 'drop' ? '← Volver' : 'Empezar de nuevo'}
        </button>
      </div>

      <div className="limpiador-title-row">
        <h2 className="section-heading">Limpiador de Word</h2>
        <span className="limpiador-credit">By Silvia Gomis</span>
      </div>
      <p className="section-sub">
        Prepara tu documento Word para el convertidor: quita portada, índice y formato,
        y revisa títulos, cajas y tablas.{' '}
        <a
          href={`${base}docs/limpiador.html`}
          target="_blank"
          rel="noopener noreferrer"
          className="help-link"
        >
          Guía de uso
        </a>
      </p>

      {/* ── Cargar documento ── */}
      {stage === 'drop' && (
        <div className="limpiador-drop">
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
            aria-label="Área de carga de documento Word para limpiar"
          >
            <div className="upload-content">
              <img src={`${base}img/docx.png`} alt="" className="upload-icon" aria-hidden="true" />
              <h2>Sube el Word que quieres limpiar</h2>
              <p>Arrastra y suelta un archivo .docx o haz clic para seleccionar</p>
              <input
                ref={inputRef}
                type="file"
                accept=".docx"
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
                {busy ? 'Analizando…' : 'Seleccionar archivo'}
              </button>
              {error && <p className="upload-file-error">{error}</p>}
            </div>
          </div>

          <div className="limpiador-info-cards">
            <div className="limpiador-info-card">
              <h3>Qué hace automáticamente</h3>
              <p>
                Quita encabezado, pie, portada e índice. Borra el formato conservando enlaces
                e imágenes. Detecta los recuadros y tablas.
              </p>
            </div>
            <div className="limpiador-info-card">
              <h3>Qué decides tú</h3>
              <p>
                Revisas cada título y eliges si es página (H1) o sección (H2…). Puedes crear
                o cambiar etiquetas en cualquier párrafo.
              </p>
            </div>
            <div className="limpiador-info-card">
              <h3>100% privado</h3>
              <p>El archivo se procesa dentro de tu navegador. No se sube a ningún servidor.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Revisión ── */}
      {stage === 'review' && (
        <div className="limpiador-review">
          <div className="doc-title-banner limpiador-doc-banner">
            <img src={`${base}img/docx.png`} alt="" className="doc-title-icon" aria-hidden="true" />
            <div className="doc-title-text">
              <span className="doc-title-label">Documento</span>
              <span className="doc-title-name">{fileName}</span>
            </div>
          </div>

          <div className="result-stats-card limpiador-stats">
            <div className="stat-item">
              <span className="stat-label">Páginas (H1)</span>
              <span className="stat-value">{counts.h1}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Secciones (H2)</span>
              <span className="stat-value">{counts.h2}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Cajas</span>
              <span className="stat-value">{counts.box}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">A quitar</span>
              <span className="stat-value">{counts.remove}</span>
            </div>
          </div>

          <div className="limpiador-options">
            <div className="limpiador-options-toggles">
              <Toggle
                label="Borrar formato (conservar enlaces)"
                checked={optFormat}
                onChange={() => setOptFormat((v) => !v)}
              />
              <Toggle
                label="Quitar encabezado y pie"
                checked={optHeader}
                onChange={() => setOptHeader((v) => !v)}
              />
            </div>
            <div className="limpiador-options-shift">
              <button className="btn-cancel" onClick={() => shiftLevels(-1)}>
                ⬆ Subir títulos un nivel
              </button>
              <button className="btn-cancel" onClick={() => shiftLevels(1)}>
                ⬇ Bajar títulos un nivel
              </button>
            </div>
          </div>

          <div className="limpiador-filter-bar">
            <p className="help-text">
              Revisa cada bloque y las etiquetas <strong>[importante] · [definición] · [ejemplo] · [fin]</strong>{' '}
              que se insertarán.
            </p>
            <div className="level-selector" role="tablist" aria-label="Filtro de bloques">
              <label className={`level-option${filter === 'estructura' ? ' level-option--active' : ''}`}>
                <input
                  type="radio"
                  name="limpiador-filter"
                  checked={filter === 'estructura'}
                  onChange={() => setFilter('estructura')}
                />
                Estructura
              </label>
              <label className={`level-option${filter === 'todo' ? ' level-option--active' : ''}`}>
                <input
                  type="radio"
                  name="limpiador-filter"
                  checked={filter === 'todo'}
                  onChange={() => setFilter('todo')}
                />
                Todo el texto
              </label>
            </div>
          </div>

          <div className="limpiador-block-list">{renderRows()}</div>

          {error && (
            <div className="error-message">
              <p><strong>Error:</strong> {error}</p>
            </div>
          )}

          <div className="limpiador-generate">
            <button className="btn-confirm" onClick={handleGenerate} disabled={busy}>
              {busy ? 'Generando…' : 'Generar Word limpio'}
            </button>
          </div>
        </div>
      )}

      {/* ── Descarga ── */}
      {stage === 'done' && (
        <div className="result-section limpiador-done">
          <div className="result-success-card">
            <div className="result-success-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>
            <div className="result-success-body">
              <h2>Tu Word está listo</h2>
              <p>
                Descárgalo y súbelo al convertidor. Recuerda asignar allí «Subpágina» a las
                páginas que lo necesiten.
              </p>
            </div>
          </div>

          <a href={downloadUrl} download={downloadName} className="btn-download-elpx limpiador-download">
            <img src={`${base}img/docx.png`} alt="" className="download-btn-icon" aria-hidden="true" />
            <span className="download-btn-body">
              <span className="download-btn-title">Descargar Word limpio</span>
              <span className="download-btn-sub">{downloadName}</span>
            </span>
          </a>

          <div className="result-actions">
            <button onClick={handleReset} className="btn-reset">
              Limpiar otro documento
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
