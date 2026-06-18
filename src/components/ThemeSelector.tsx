import { useState } from 'react';
import { ThemeRegistry } from '../core/services/ThemeRegistry';
import { ThemeOrderService } from '../core/services/ThemeOrderService';
import { groupIntoFamilies, languageLabel, languageCode } from '../core/services/themeGrouping';


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
  // Agrupar por familia (mismo curso en varios idiomas): una fila por familia,
  // cada idioma como opción seleccionable. La selección sigue siendo por variante.
  const families = groupIntoFamilies(availableThemes);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(() => {
    const saved = localStorage.getItem('bua-last-theme');
    // Restaurar solo si sigue siendo un tema visible de la lista ('base' no:
    // está oculto, y una selección invisible permitiría continuar sin elegir)
    if (saved && saved !== 'base' && ThemeRegistry.get(saved)) return saved;
    return null;
  });

  return (
    <div className="theme-selector">
      <p className="help-text">
        Elige el estilo que deseas aplicar a tu recurso eXeLearning:
      </p>

      <div className="theme-list">
        {families.map((family) => {
          // Un único screenshot por familia (las variantes de idioma lo comparten)
          const screenshot = family.variants.find((v) => v.metadata.screenshot)?.metadata.screenshot;
          const isOfficial = family.variants[0].source === 'builtin';

          // Familia con una sola variante: opción simple seleccionable (como antes)
          if (family.variants.length === 1) {
            const theme = family.variants[0];
            return (
              <label key={family.key} className="theme-option">
                {screenshot && (
                  <img className="theme-thumbnail" src={screenshot} alt="" aria-hidden="true" loading="lazy" />
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
                        <span className="theme-language">{theme.metadata.language.toUpperCase()}</span>
                      )}
                    </div>
                  )}
                  {theme.metadata.description && (
                    <div className="theme-description">{theme.metadata.description}</div>
                  )}
                  <span className={`theme-badge theme-badge--${isOfficial ? 'official' : 'user'}`}>
                    {isOfficial ? 'Oficial' : 'Local'}
                  </span>
                </div>
              </label>
            );
          }

          // Familia con varias variantes de idioma: un screenshot + celdas-radio por idioma
          const activity = family.variants[0].metadata.activity;
          return (
            <div key={family.key} className="theme-family-option">
              {screenshot && (
                <img className="theme-thumbnail" src={screenshot} alt="" aria-hidden="true" loading="lazy" />
              )}
              <div className="theme-content">
                <div className="theme-name">{family.name}</div>
                {activity && (
                  <div className="theme-meta">
                    <span className="theme-activity">{activity}</span>
                  </div>
                )}
                <span className={`theme-badge theme-badge--${isOfficial ? 'official' : 'user'}`}>
                  {isOfficial ? 'Oficial' : 'Local'}
                </span>
                <div className="theme-lang-options">
                  {family.variants.map((v) => (
                    <label key={v.id} className="theme-lang-option">
                      <input
                        type="radio"
                        name="theme"
                        value={v.id}
                        checked={selectedThemeId === v.id}
                        onChange={(e) => setSelectedThemeId(e.target.value)}
                      />
                      <span className="theme-lang-pill">{languageCode(v.metadata.language)}</span>
                      <span className="theme-lang-name">{languageLabel(v.metadata.language) || v.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="theme-actions">
        <button
          onClick={() => selectedThemeId && onConfirm(selectedThemeId)}
          className="btn-confirm"
          disabled={!selectedThemeId}
          title={!selectedThemeId ? 'Elige un estilo para continuar' : undefined}
        >
          Continuar con este estilo
        </button>
        <button onClick={onCancel} className="btn-cancel">
          Volver
        </button>
      </div>
    </div>
  );
}
