import { useState } from 'react';
import { ThemeRegistry } from '../core/services/ThemeRegistry';
import { ThemeOrderService } from '../core/services/ThemeOrderService';


interface ThemeSelectorProps {
  onConfirm: (themeId: string) => void;
  onCancel: () => void;
}

export function ThemeSelector({ onConfirm, onCancel }: ThemeSelectorProps) {
  // Leer del registry en cada montaje para recoger temas añadidos desde ThemeManager
  // Omitir el tema 'base' (es un fallback automático, no un estilo para elegir)
  const availableThemes = ThemeOrderService.applyOrder(ThemeRegistry.getAll()).filter(
    (theme) => theme.id !== 'base'
  );
  const [selectedThemeId, setSelectedThemeId] = useState<string>(() => {
    const saved = localStorage.getItem('bua-last-theme');
    // Verificar que el estilo guardado sigue existiendo en el registry
    if (saved && ThemeRegistry.get(saved)) return saved;
    return 'base';
  });

  return (
    <div className="theme-selector">
      <p className="help-text">
        Elige el estilo que deseas aplicar a tu recurso eXeLearning:
      </p>

      <div className="theme-list">
        {availableThemes.map((theme) => (
          <label key={theme.id} className="theme-option">
            {theme.metadata.screenshot && (
              <img
                className="theme-thumbnail"
                src={theme.metadata.screenshot}
                alt=""
                aria-hidden="true"
                loading="lazy"
              />
            )}
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
              <span
                className={`theme-badge theme-badge--${theme.source === 'builtin' ? 'official' : 'user'}`}
              >
                {theme.source === 'builtin' ? 'Oficial' : 'Local'}
              </span>
            </div>
          </label>
        ))}
      </div>

      <div className="theme-actions">
        <button onClick={() => onConfirm(selectedThemeId)} className="btn-confirm">
          Continuar con este estilo
        </button>
        <button onClick={onCancel} className="btn-cancel">
          Volver
        </button>
      </div>
    </div>
  );
}
