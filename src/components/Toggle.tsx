interface ToggleProps {
  /** Etiqueta fija que nombra la opción — nunca cambia de texto con el estado. */
  label: string;
  /** Aclaración corta opcional bajo la etiqueta (p.ej. el formato de la numeración). */
  caption?: string;
  checked: boolean;
  onChange: () => void;
}

/**
 * Toggle con etiqueta fija + palabra de estado (No/Sí) + switch.
 * La etiqueta nombra la función; el estado se lee en una palabra, sin
 * depender solo del color/posición del switch.
 */
export function Toggle({ label, caption, checked, onChange }: ToggleProps) {
  return (
    <span className="pdf-cover-toggle-inline">
      <span className="pdf-cover-toggle-inline__label-group">
        <span className="pdf-cover-toggle-inline__label">{label}</span>
        {caption && <span className="pdf-cover-toggle-inline__caption">{caption}</span>}
      </span>
      <span className="toggle-state-control">
        <span className={`toggle-state-word ${checked ? 'toggle-state-word--on' : ''}`}>
          {checked ? 'Sí' : 'No'}
        </span>
        <button
          role="switch"
          aria-checked={checked}
          aria-label={label}
          title={checked ? 'Desactivar' : 'Activar'}
          onClick={onChange}
          className={`toggle-switch ${checked ? 'toggle-switch--on' : ''}`}
        >
          <span className="toggle-switch__thumb" />
        </button>
      </span>
    </span>
  );
}
