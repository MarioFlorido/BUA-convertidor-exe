interface StepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4;
  onStepClick?: (step: 2 | 3) => void;
}

const STEPS = [
  { n: 1, label: 'Documento' },
  { n: 2, label: 'Estructura' },
  { n: 3, label: 'Estilo' },
  { n: 4, label: 'Resultado' },
] as const;

export function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <nav className="step-indicator" aria-label="Pasos del proceso">
      {STEPS.map((step, index) => {
        const isDone = step.n < currentStep;
        const isActive = step.n === currentStep;
        const isClickable = isDone && onStepClick && (step.n === 2 || step.n === 3);

        return (
          <div key={step.n} className="step-item">
            <div
              className={`step-circle${isDone ? ' step-done' : ''}${isActive ? ' step-active' : ''}${isClickable ? ' step-clickable' : ''}`}
              aria-current={isActive ? 'step' : undefined}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              title={isClickable ? `Volver a ${step.label.toLowerCase()}` : undefined}
              onClick={isClickable ? () => onStepClick(step.n as 2 | 3) : undefined}
              onKeyDown={isClickable ? (e) => e.key === 'Enter' && onStepClick(step.n as 2 | 3) : undefined}
            >
              {isDone ? (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3,8 6.5,11.5 13,5" />
                </svg>
              ) : (
                <span>{step.n}</span>
              )}
            </div>
            <span
              className={`step-label${isActive ? ' step-label--active' : ''}${isDone ? ' step-label--done' : ''}${isClickable ? ' step-label--clickable' : ''}`}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? -1 : undefined}
              onClick={isClickable ? () => onStepClick(step.n as 2 | 3) : undefined}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 && (
              <div className={`step-connector${isDone ? ' step-connector--done' : ''}`} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
