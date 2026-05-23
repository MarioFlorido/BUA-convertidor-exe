interface AppHeaderProps {
  onThemeManagerClick?: () => void;
}

export function AppHeader({ onThemeManagerClick }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <img
          src={`${import.meta.env.BASE_URL}logo_BUA.png`}
          alt="BUA — Biblioteca Universitaria de la Universidad de Alicante"
          className="header-bua-logo"
        />

        <div className="header-divider" aria-hidden="true" />

        <div className="header-brand-text">
          <span className="header-brand-name">ConvertidoreXe</span>
          <span className="header-brand-sub">DOCX → eXeLearning</span>
        </div>
      </div>

      {onThemeManagerClick && (
        <button
          onClick={onThemeManagerClick}
          className="btn-theme-manager"
          title="Administrar temas institucionales"
        >
          Temas
        </button>
      )}
    </header>
  );
}
