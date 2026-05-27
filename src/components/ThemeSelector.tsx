import { useState } from 'react';
import { ThemeRegistry } from '../core/services/ThemeRegistry';
import type { ThemeBundle } from '../core/services/ThemeBundle';

interface ThemeSelectorProps {
  onConfirm: (themeId: string) => void;
  onCancel: () => void;
}

export function ThemeSelector({ onConfirm, onCancel }: ThemeSelectorProps) {
  // ThemeRegistry está poblado desde el boot — lectura síncrona, sin fetch
  const [availableThemes] = useState<ThemeBundle[]>(() =>
    ThemeRegistry.getAll()
  );
  const [selectedThemeId, setSelectedThemeId] = useState<string>('base');

  return (
    <div className="theme-selector">
      <h2>Seleccionar tema visual</h2>
      <p className="help-text">
        Elige el tema que deseas aplicar a tu recurso eXeLearning:
      </p>

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
              <div className="theme-name">{theme.metadata.name ?? theme.name}</div>
              {(theme.metadata.activity || theme.metadata.language) && (
                <div className="theme-meta">
                  {theme.metadata.activity && (
                    <span className="theme-activity">{theme.metadata.activity}</span>
                  )}
                  {theme.metadata.language && (
                    <span className="theme-language">
                      {theme.metadata.language.toUpperCase()}
                    </span>
                  )}
                </div>
              )}
              {theme.metadata.description && (
                <div className="theme-description">{theme.metadata.description}</div>
              )}
              {theme.source === 'user' && (
                <span className="theme-badge theme-badge--user">Personalizado</span>
              )}
            </div>
            {theme.metadata.screenshot && (
              <img
                className="theme-thumbnail"
                src={theme.metadata.screenshot}
                alt=""
                aria-hidden="true"
                loading="lazy"
              />
            )}
          </label>
        ))}
      </div>

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
