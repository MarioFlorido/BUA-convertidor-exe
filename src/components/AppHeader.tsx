interface AppHeaderProps {
  onThemeManagerClick?: () => void;
}

export function AppHeader({ onThemeManagerClick }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="header-content">
        <h1>ConvertidoreXe</h1>
        <p>Convierte tus documentos Word a eXeLearning</p>
      </div>
      {onThemeManagerClick && (
        <button onClick={onThemeManagerClick} className="btn-theme-manager" title="Administrar temas">
          ⚙️ Temas
        </button>
      )}
    </header>
  );
}
