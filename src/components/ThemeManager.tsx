import { useState, useRef, useMemo, useEffect } from 'react';
import { themeClientService } from '../core/services/ThemeClientService';
import { ThemeRegistry } from '../core/services/ThemeRegistry';
import { ThemeOrderService } from '../core/services/ThemeOrderService';
import type { ThemeBundle } from '../core/services/ThemeBundle';
import {
  groupIntoFamilies,
  flattenFamilies,
  languageLabel,
  languageCode,
} from '../core/services/themeGrouping';
import { OfficialThemeAdmin } from './OfficialThemeAdmin';

export function ThemeManager() {
  const [themes, setThemes] = useState<ThemeBundle[]>(() =>
    ThemeOrderService.applyOrder(ThemeRegistry.getAll())
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshThemes = () =>
    setThemes(ThemeOrderService.applyOrder(ThemeRegistry.getAll()));

  // El catálogo se carga en segundo plano: si esta pantalla se abre antes de
  // que termine, los temas que vayan llegando deben aparecer solos.
  useEffect(() => ThemeRegistry.subscribe(refreshThemes), []);

  // Vista derivada: los estilos agrupados por familia (mismo curso en varios idiomas).
  const families = useMemo(() => groupIntoFamilies(themes), [themes]);

  // El reordenado opera a nivel de familia; se persiste la lista de IDs aplanada.
  const reorderFamilies = (from: number, to: number) => {
    if (from === to) return;
    const next = families.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const flat = flattenFamilies(next);
    setThemes(flat);
    ThemeOrderService.save(flat.map((t) => t.id));
  };

  const handleFamilyDragStart = (idx: number) => (e: React.DragEvent<HTMLDivElement>) => {
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Necesario en Firefox para que arranque el drag
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const handleFamilyDragOver = (idx: number) => (e: React.DragEvent<HTMLDivElement>) => {
    if (draggingIdx === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overIdx !== idx) setOverIdx(idx);
  };

  const handleFamilyDrop = (idx: number) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggingIdx === null) return;
    reorderFamilies(draggingIdx, idx);
    setDraggingIdx(null);
    setOverIdx(null);
  };

  const handleFamilyDragEnd = () => {
    setDraggingIdx(null);
    setOverIdx(null);
  };

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Por favor selecciona un archivo ZIP');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const bundle = await themeClientService.loadThemeZip(file);
      setSuccess(`✅ Estilo "${bundle.name}" cargado correctamente`);
      refreshThemes();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(`❌ Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDeleteTheme = async (bundle: ThemeBundle) => {
    if (bundle.id === 'base') {
      setError('El estilo base no se puede eliminar');
      return;
    }
    if (!confirm(`¿Eliminar estilo "${bundle.name}"?`)) return;

    try {
      setError(null);
      await themeClientService.removeTheme(bundle.id);
      setSuccess(`✅ Estilo "${bundle.name}" eliminado`);
      refreshThemes();
    } catch (err) {
      setError(`❌ ${err instanceof Error ? err.message : 'Error desconocido'}`);
    }
  };

  return (
    <div className="theme-manager">
      <h2>Administrador de Estilos eXeLearning</h2>
      <p className="help-text">
        Importa estilos en ZIP para usarlos en este navegador. Los estilos locales
        se guardan en el almacenamiento del navegador y solo son visibles aquí.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Formulario de carga con drag-and-drop */}
      <div className="theme-upload-section">
        <h3>Importar estilo local</h3>
        <div
          className={`upload-input-wrapper ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            disabled={uploading}
            id="theme-file-input"
          />
          <label htmlFor="theme-file-input" className="upload-label">
            {uploading ? (
              <span className="upload-label-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="upload-label-icon" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" strokeDasharray="4 2" />
                </svg>
                Cargando...
              </span>
            ) : dragActive ? (
              <span className="upload-label-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="upload-label-icon" aria-hidden="true">
                  <path d="M12 4v12M8 12l4 4 4-4" />
                  <path d="M4 20h16" />
                </svg>
                Suelta el archivo aquí
              </span>
            ) : (
              <span className="upload-label-content">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="upload-label-icon" aria-hidden="true">
                  <path d="M12 16V8M9 11l3-3 3 3" />
                  <path d="M5 20h14" />
                  <rect x="3" y="4" width="18" height="14" rx="2" />
                </svg>
                Arrastra ZIP aquí o haz clic
              </span>
            )}
          </label>
        </div>
        <p className="help-text">
          El nombre del archivo ZIP será el ID del estilo (ej: Doctorado_27-28.zip).
          Si ya existe un estilo con ese ID, será reemplazado.
        </p>
        <p className="help-text">
          <a
            href={`${import.meta.env.BASE_URL}docs/guia-temas.html`}
            target="_blank"
            rel="noopener noreferrer"
            className="help-link"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="help-link-icon">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8h.01M11 12h1v4h1" />
            </svg>
            Ver guía completa de carga y gestión de estilos
          </a>
        </p>
      </div>

      {/* Lista de estilos agrupados por familia (mismo curso en varios idiomas) */}
      <div className="themes-list">
        <h3>Estilos disponibles ({themes.length})</h3>
        {families.length === 0 ? (
          <p className="no-items">No hay estilos cargados</p>
        ) : (
          <div className="theme-items">
            {families.map((family, idx) => {
              const isDragging = draggingIdx === idx;
              const isOver = overIdx === idx && draggingIdx !== null && draggingIdx !== idx;
              const dropAbove = isOver && (draggingIdx ?? -1) > idx;
              const dropBelow = isOver && (draggingIdx ?? -1) < idx;
              const single = family.variants.length === 1;
              const isOfficial = family.variants[0].source === 'builtin';
              return (
                <div
                  key={family.key}
                  className={`theme-item${single ? '' : ' theme-item--family'}${isDragging ? ' theme-item--dragging' : ''}${dropAbove ? ' theme-item--drop-above' : ''}${dropBelow ? ' theme-item--drop-below' : ''}`}
                  draggable
                  onDragStart={handleFamilyDragStart(idx)}
                  onDragOver={handleFamilyDragOver(idx)}
                  onDrop={handleFamilyDrop(idx)}
                  onDragEnd={handleFamilyDragEnd}
                >
                  <div className="theme-item-header">
                    <span className="theme-drag-handle" aria-hidden="true" title="Arrastra para reordenar">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <circle cx="5.5" cy="4" r="0.8" fill="currentColor" />
                        <circle cx="10.5" cy="4" r="0.8" fill="currentColor" />
                        <circle cx="5.5" cy="8" r="0.8" fill="currentColor" />
                        <circle cx="10.5" cy="8" r="0.8" fill="currentColor" />
                        <circle cx="5.5" cy="12" r="0.8" fill="currentColor" />
                        <circle cx="10.5" cy="12" r="0.8" fill="currentColor" />
                      </svg>
                    </span>
                    {single ? (
                      <div>
                        <strong>{family.variants[0].metadata.name ?? family.variants[0].name}</strong>
                        <span className="theme-id">({family.variants[0].id})</span>
                      </div>
                    ) : (
                      <div>
                        <strong>{family.name}</strong>
                        <span className="theme-family-count">{family.variants.length} idiomas</span>
                      </div>
                    )}
                    <div className="theme-item-actions">
                      <span className={`theme-badge theme-badge--${isOfficial ? 'official' : 'user'}`}>
                        {isOfficial ? 'Oficial' : 'Local'}
                      </span>
                      {single && family.variants[0].source === 'user' && (
                        <button
                          onClick={() => handleDeleteTheme(family.variants[0])}
                          className="btn-delete"
                          disabled={uploading}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>

                  {!single && (
                    <div className="theme-variant-grid">
                      {family.variants.map((v) => (
                        <div className="theme-variant" key={v.id}>
                          <div className="theme-variant-lang">
                            <span className="theme-lang-pill">{languageCode(v.metadata.language)}</span>
                            <span>{languageLabel(v.metadata.language) || v.id}</span>
                          </div>
                          <div className="theme-variant-foot">
                            <span className="theme-variant-id" title={v.id}>{v.id}</span>
                            {v.source === 'user' && (
                              <button
                                onClick={() => handleDeleteTheme(v)}
                                className="btn-delete btn-delete--sm"
                                disabled={uploading}
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Administración de temas oficiales (requiere token de GitHub) */}
      <hr className="admin-divider" />
      <OfficialThemeAdmin />

    </div>
  );
}
