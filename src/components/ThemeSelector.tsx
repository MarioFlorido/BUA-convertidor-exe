import { useState, useEffect } from 'react';
import type { Theme } from '../types';

interface ThemeSelectorProps {
  onConfirm: (themeId: string) => void;
  onCancel: () => void;
}

interface ThemeWithScreenshot extends Theme {
  screenshot?: string | null;
}

export function ThemeSelector({ onConfirm, onCancel }: ThemeSelectorProps) {
  const [availableThemes, setAvailableThemes] = useState<ThemeWithScreenshot[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('base');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar temas desde el archivo de configuración
  useEffect(() => {
    const loadThemes = async () => {
      try {
        const baseUrl = import.meta.env.BASE_URL ?? '/';
        const response = await fetch(`${baseUrl}themes-config.json`);
        if (!response.ok) {
          throw new Error('No se pudo cargar la configuración de temas');
        }
        const config = await response.json();
        setAvailableThemes(config.themes);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setLoading(false);
      }
    };

    loadThemes();
  }, []);

  const selectedTheme = availableThemes.find((t) => t.id === selectedThemeId);

  if (loading) {
    return (
      <div className="theme-selector">
        <h2>Seleccionar tema visual</h2>
        <p className="help-text">Cargando temas disponibles...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="theme-selector">
        <h2>Seleccionar tema visual</h2>
        <p className="help-text" style={{ color: '#d32f2f' }}>
          Error: {error}
        </p>
        <div className="theme-actions">
          <button onClick={onCancel} className="btn-cancel">
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-selector">
      <h2>Seleccionar tema visual</h2>
      <p className="help-text">Elige el tema que deseas aplicar a tu recurso eXeLearning:</p>

      <div className="theme-list">
        {availableThemes.map((theme) => (
          <label key={theme.id} className="theme-option">
            <input
              type="radio"
              name="theme"
              value={theme.id}
              checked={selectedThemeId === theme.id}
              onChange={(e) => setSelectedThemeId(e.target.value)}
            />
            <div className="theme-content">
              <div className="theme-name">{theme.name}</div>
              <div className="theme-meta">
                <span className="theme-activity">{theme.activity}</span>
                <span className="theme-language">{theme.language.toUpperCase()}</span>
              </div>
              <div className="theme-description">{theme.description}</div>
            </div>
          </label>
        ))}
      </div>

      {selectedTheme && (
        <div className="theme-info">
          <h3>Vista previa de tema</h3>
          <p>
            <strong>{selectedTheme.name}</strong>
          </p>
          {selectedTheme.screenshot ? (
            <div className="theme-screenshot">
              <img
                src={selectedTheme.screenshot}
                alt={`Screenshot de ${selectedTheme.name}`}
                style={{ maxWidth: '100%', borderRadius: '4px', marginTop: '1rem' }}
              />
            </div>
          ) : (
            <p className="theme-preview-note">
              No hay captura de pantalla disponible para este tema
            </p>
          )}
        </div>
      )}

      <div className="theme-actions">
        <button onClick={() => onConfirm(selectedThemeId)} className="btn-confirm">
          Continuar con este tema
        </button>
        <button onClick={onCancel} className="btn-cancel">
          Volver
        </button>
      </div>
    </div>
  );
}
