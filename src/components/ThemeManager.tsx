import { useState, useEffect } from 'react';

interface ThemeConfig {
  id: string;
  name: string;
  activity: string;
  language: string;
  description: string;
  screenshot?: string | null;
}

const API_URL = 'http://localhost:5175';

export function ThemeManager() {
  const [themes, setThemes] = useState<ThemeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Cargar temas
  const loadThemes = async () => {
    try {
      const response = await fetch(`${API_URL}/api/themes`);
      if (response.ok) {
        const data = await response.json();
        setThemes(data.themes || []);
      }
    } catch (err) {
      console.error('Error cargando temas:', err);
      setError('No se pudo conectar al servidor de temas. ¿Está ejecutándose en puerto 5174?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThemes();
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      setError('Por favor selecciona un archivo ZIP');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('theme', file);

      const response = await fetch(`${API_URL}/api/upload-theme`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`✅ ${data.message}`);
        await loadThemes();
        // Limpiar input
        e.target.value = '';
      } else {
        setError(`❌ ${data.error}`);
      }
    } catch (err) {
      setError(
        `Error: ${err instanceof Error ? err.message : 'Error desconocido'}`
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTheme = async (id: string) => {
    if (!confirm(`¿Eliminar tema "${id}"? Se borrará la carpeta y la configuración.`)) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`${API_URL}/api/themes/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`✅ ${data.message}`);
        await loadThemes();
      } else {
        setError(`❌ ${data.error}`);
      }
    } catch (err) {
      setError(
        `Error: ${err instanceof Error ? err.message : 'Error desconocido'}`
      );
    }
  };

  if (loading) {
    return (
      <div className="theme-manager">
        <p>Cargando administrador de temas...</p>
      </div>
    );
  }

  return (
    <div className="theme-manager">
      <h2>Administrador de Temas</h2>
      <p className="help-text">
        Carga archivos ZIP de temas. El sistema automáticamente los extrae y
        configura.
      </p>

      {/* Mensajes de estado */}
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      {/* Formulario de carga */}
      <div className="theme-upload-section">
        <h3>Cargar nuevo tema</h3>
        <div className="upload-input-wrapper">
          <input
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            disabled={uploading}
            id="theme-file-input"
          />
          <label htmlFor="theme-file-input" className="upload-label">
            {uploading ? '⏳ Cargando...' : '📦 Selecciona un archivo ZIP'}
          </label>
        </div>
        <p className="help-text">
          El nombre del archivo ZIP será el ID del tema (ej: Doctorado_26-27.zip)
        </p>
      </div>

      {/* Lista de temas */}
      <div className="themes-list">
        <h3>Temas configurados ({themes.length})</h3>
        {themes.length === 0 ? (
          <p className="no-items">No hay temas configurados</p>
        ) : (
          <div className="theme-items">
            {themes.map((theme) => (
              <div key={theme.id} className="theme-item">
                <div className="theme-item-header">
                  <div>
                    <strong>{theme.name}</strong>
                    <span className="theme-id">({theme.id})</span>
                  </div>
                  <button
                    onClick={() => handleDeleteTheme(theme.id)}
                    className="btn-delete"
                  >
                    🗑️ Eliminar
                  </button>
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
          <li>Asegúrate de tener el servidor ejecutándose (npm run theme-server)</li>
          <li>Carga archivos ZIP de temas (Doctorado_26-27.zip, etc.)</li>
          <li>El sistema automáticamente los extrae a <code>public/themes/</code></li>
          <li>El archivo <code>themes-config.json</code> se actualiza automáticamente</li>
          <li>Los temas aparecen en el selector de la aplicación</li>
          <li>Haz commit y push a GitHub cuando termines</li>
        </ol>
      </div>
    </div>
  );
}
