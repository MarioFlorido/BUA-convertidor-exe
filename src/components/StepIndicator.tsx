interface StepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4;
}

const STEPS = [
  { n: 1, label: 'Documento' },
  { n: 2, label: 'Estructura' },
  { n: 3, label: 'Tema' },
  { n: 4, label: 'Resultado' },
] as const;

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <nav className="step-indicator" aria-label="Pasos del proceso">
      {STEPS.map((step, index) => {
        const isDone = step.n < currentStep;
        const isActive = step.n === currentStep;

        return (
          <div key={step.n} className="step-item">
            <div
              className={`step-circle${isDone ? ' step-done' : ''}${isActive ? ' step-active' : ''}`}
              aria-current={isActive ? 'step' : undefined}
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
              className={`step-label${isActive ? ' step-label--active' : ''}${isDone ? ' step-label--done' : ''}`}
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
