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
        Carga archivos ZIP de temas. El sistema los procesa directamente en el
        navegador, sin necesidad de servidor.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Formulario de carga con drag-and-drop */}
      <div className="theme-upload-section">
        <h3>Cargar nuevo tema</h3>
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
            {uploading
              ? '⏳ Cargando...'
              : dragActive
              ? '📥 Suelta el archivo aquí'
              : '📦 Arrastra ZIP aquí o haz clic'}
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
                  {theme.id === 'base' ? (
                    <span className="theme-badge">Base</span>
                  ) : (
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
            ))}
          </div>
        )}
      </div>

      {/* Instrucciones */}
      <div className="manager-instructions">
        <h4>Instrucciones:</h4>
        <ol>
          <li>Arrastra o selecciona un archivo ZIP de tema</li>
          <li>El sistema lo valida y lo registra automáticamente</li>
          <li>El tema queda disponible en el selector de forma inmediata</li>
          <li>Los temas persisten en el navegador y sobreviven recargas de página</li>
          <li>Para actualizar un tema (nuevo curso académico), carga el nuevo ZIP con el mismo nombre — reemplazará al anterior</li>
          <li>Solo el tema <strong>Base</strong> no puede eliminarse</li>
        </ol>
      </div>
    </div>
  );
}
