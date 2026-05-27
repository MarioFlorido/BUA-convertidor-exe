import { useState, useRef } from 'react';
import { themeClientService } from '../core/services/ThemeClientService';
import { ThemeRegistry } from '../core/services/ThemeRegistry';
import type { ThemeBundle } from '../core/services/ThemeBundle';

export function ThemeManager() {
  const [themes, setThemes] = useState<ThemeBundle[]>(() =>
    ThemeRegistry.getAll()
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshThemes = () => setThemes(ThemeRegistry.getAll());

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
      setSuccess(`✅ Tema "${bundle.name}" cargado correctamente`);
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
      setError('El tema base no se puede eliminar');
      return;
    }
    if (!confirm(`¿Eliminar tema "${bundle.name}"?`)) return;

    try {
      setError(null);
      await themeClientService.removeTheme(bundle.id);
      setSuccess(`✅ Tema "${bundle.name}" eliminado`);
      refreshThemes();
    } catch (err) {
      setError(`❌ ${err instanceof Error ? err.message : 'Error desconocido'}`);
    }
  };

  return (
    <div className="theme-manager">
      <h2>Administrador de Temas</h2>
      <p className="help-text">
        Importa temas en ZIP para usarlos en este navegador. Los temas locales
        se guardan en el almacenamiento del navegador y solo son visibles aquí.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Formulario de carga con drag-and-drop */}
      <div className="theme-upload-section">
        <h3>Importar tema local</h3>
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
          El nombre del archivo ZIP será el ID del tema (ej: Doctorado_27-28.zip).
          Si ya existe un tema con ese ID, será reemplazado.
        </p>
      </div>

      {/* Lista unificada de temas */}
      <div className="themes-list">
        <h3>Temas disponibles ({themes.length})</h3>
        {themes.length === 0 ? (
          <p className="no-items">No hay temas cargados</p>
        ) : (
          <div className="theme-items">
            {themes.map((theme) => (
              <div key={theme.id} className="theme-item">
                <div className="theme-item-header">
                  <div>
                    <strong>{theme.metadata.name ?? theme.name}</strong>
                    <span className="theme-id">({theme.id})</span>
                  </div>
                  <div className="theme-item-actions">
                    <span
                      className={`theme-badge theme-badge--${
                        theme.source === 'builtin' ? 'official' : 'user'
                      }`}
                    >
                      {theme.source === 'builtin' ? 'Oficial' : 'Local'}
                    </span>
                    {theme.source === 'user' && (
                      <button
                        onClick={() => handleDeleteTheme(theme)}
                        className="btn-delete"
                        disabled={uploading}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
