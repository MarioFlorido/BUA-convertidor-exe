interface AppHeaderProps {
  onThemeManagerClick?: () => void;
}

export function AppHeader({ onThemeManagerClick }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="header-brand">
        {/* BUA logo: tres lomos de libro + texto */}
        <div className="header-logo">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 96 72"
            className="header-logo-books"
            aria-hidden="true"
            focusable="false"
          >
            {/* Lomo gris */}
            <rect x="0" y="11" width="20" height="61" rx="1" fill="#C8C6C4" />
            {/* Lomo naranja */}
            <rect x="23" y="2" width="28" height="70" rx="1" fill="#F5A520" />
            {/* Lomo amarillo (ligeramente inclinado) */}
            <polygon points="55,6 87,3 87,72 55,72" fill="#FDD000" />
          </svg>
          <span className="header-bua-text">BUA</span>
        </div>

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
