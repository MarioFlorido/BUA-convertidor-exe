import { StepIndicator } from './StepIndicator';
import { Toggle } from './Toggle';

interface SidebarProps {
  currentStep: 1 | 2 | 3 | 4;
  onStepClick?: (step: 2 | 3) => void;
  showPipeline: boolean;
  onThemeManagerClick?: () => void;
  onLimpiadorClick?: () => void;
  helpEnabled?: boolean;
  onToggleHelp?: (enabled: boolean) => void;
}

function PaletteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="sidebar-action-icon"
      aria-hidden="true"
      style={{ width: 16, height: 16 }}
    >
      <path d="M12 3a9 9 0 1 0 9 9c0-1-1-1.5-2-1.5h-3a2 2 0 0 1-1.4-3.4A2 2 0 0 0 13 5a2 2 0 0 0-1-1.7A9 9 0 0 0 12 3Z" />
      <circle cx="7.5" cy="10.5" r="1" />
      <circle cx="7.5" cy="14.5" r="1" />
      <circle cx="11" cy="17" r="1" />
    </svg>
  );
}

function BroomIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="sidebar-action-icon"
      aria-hidden="true"
      style={{ width: 16, height: 16 }}
    >
      <path d="m19.4 4.6-6.05 6.05" />
      <path d="M13.35 10.65 4.6 19.4a1.4 1.4 0 0 1-2-2l8.75-8.75a1.4 1.4 0 0 1 2 2Z" />
      <path d="M6.8 13.2 10.8 17.2" />
      <path d="M20 8h.01M21.5 11.5h.01M17 3h.01" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="sidebar-action-icon"
      aria-hidden="true"
      style={{ width: 16, height: 16 }}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export function Sidebar({
  currentStep,
  onStepClick,
  showPipeline,
  onThemeManagerClick,
  onLimpiadorClick,
  helpEnabled,
  onToggleHelp,
}: SidebarProps) {
  const base = import.meta.env.BASE_URL;

  const handleInfoClick = () => {
    window.open(`${base}docs/GUIA-USO.html`, '_blank');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <a
          href="https://biblioteca.ua.es/es/"
          target="_blank"
          rel="noopener noreferrer"
          title="Biblioteca Universitaria de la Universidad de Alicante"
        >
          <img
            src={`${base}img/logo_BUA.png`}
            alt="BUA — Biblioteca Universitaria de la Universidad de Alicante"
            className="sidebar-bua-logo"
          />
        </a>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">ConvertidoreXe</span>
          <span className="sidebar-brand-sub">DOCX → eXeLearning</span>
          <span className="sidebar-brand-sub">DOCX → PDF</span>
        </div>
      </div>

      {showPipeline && (
        <>
          <div className="sidebar-section-label">Proceso</div>
          <StepIndicator currentStep={currentStep} onStepClick={onStepClick} />
        </>
      )}

      <div className="sidebar-actions">
        {onLimpiadorClick && (
          <button
            onClick={onLimpiadorClick}
            className="sidebar-action"
            title="Limpiar un Word antes de convertirlo"
          >
            <BroomIcon />
            <span>Limpiador de Word</span>
          </button>
        )}

        {onThemeManagerClick && (
          <button
            onClick={onThemeManagerClick}
            className="sidebar-action"
            title="Administrar estilos eXeLearning"
          >
            <PaletteIcon />
            <span>Estilos eXeLearning</span>
          </button>
        )}

        <button
          onClick={handleInfoClick}
          className="sidebar-action"
          title="Abrir guía de uso"
        >
          <InfoIcon />
          <span>Manual de ayuda</span>
        </button>

        {onToggleHelp && (
          <div className="sidebar-toggle-row">
            <Toggle
              label="Tour inicial"
              checked={false}
              onChange={() => onToggleHelp(!helpEnabled)}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
