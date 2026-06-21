interface AppHeaderProps {
  onThemeManagerClick?: () => void;
  helpEnabled?: boolean;
  onToggleHelp?: (enabled: boolean) => void;
}

function HelpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="help-icon"
      aria-hidden="true"
      style={{ width: 18, height: 18 }}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export function AppHeader({ onThemeManagerClick, helpEnabled, onToggleHelp }: AppHeaderProps) {
  const base = import.meta.env.BASE_URL;

  const handleHelpClick = () => {
    const helpUrl = `${base}docs/GUIA-USO.html`;
    window.open(helpUrl, '_blank');
  };

  return (
    <header className="app-header">
      <div className="header-brand">
        <a
          href="https://biblioteca.ua.es/es/"
          target="_blank"
          rel="noopener noreferrer"
          title="Biblioteca Universitaria de la Universidad de Alicante"
        >
          <img
            src={`${import.meta.env.BASE_URL}img/logo_BUA.png`}
            alt="BUA — Biblioteca Universitaria de la Universidad de Alicante"
            className="header-bua-logo"
          />
        </a>

        <div className="header-divider" aria-hidden="true" />

        <div className="header-brand-text">
          <span className="header-brand-name">ConvertidoreXe</span>
          <span className="header-brand-sub">DOCX → eXeLearning</span>
        </div>
      </div>

      <div className="header-buttons">
        {onThemeManagerClick && (
          <button
            onClick={onThemeManagerClick}
            className="btn-theme-manager"
            title="Administrar estilos eXeLearning"
          >
            Estilos eXeLearning
          </button>
        )}

        {onToggleHelp && (
          <button
            type="button"
            role="switch"
            aria-checked={helpEnabled}
            onClick={() => onToggleHelp(!helpEnabled)}
            className={`help-switch${helpEnabled ? ' help-switch--on' : ''}`}
            title={helpEnabled ? 'Ayuda activada — pulsa para desactivarla' : 'Ayuda desactivada — pulsa para activarla'}
          >
            <span className="help-switch-label">Ayuda</span>
            <span className="help-switch-track">
              <span className="help-switch-thumb" />
            </span>
          </button>
        )}

        <button
          onClick={handleHelpClick}
          className="btn-help"
          title="Abrir guía de uso"
          aria-label="Guía de uso"
        >
          <HelpIcon />
        </button>
      </div>
    </header>
  );
}
