
import type { DocxImportOptions, HeadingMode, Heading1Mode } from '../types';

interface ConfigPanelProps {
  options: DocxImportOptions;
  onOptionsChange: (options: DocxImportOptions) => void;
}

export function ConfigPanel({ options, onOptionsChange }: ConfigPanelProps) {
  const handleChange = (key: keyof DocxImportOptions, value: string) => {
    onOptionsChange({
      ...options,
      [key]: value,
    });
  };

  const modeOptions: Array<{ value: string; label: string; description: string }> = [
    { value: 'page', label: 'Nueva página', description: 'Crea una página nueva' },
    { value: 'block', label: 'Bloque en página', description: 'Crea un bloque dentro de la página actual' },
  ];

  const heading1Options: Array<{ value: string; label: string; description: string }> = [
    { value: 'page', label: 'Página', description: 'Encabezado 1 como página principal' },
    {
      value: 'resource',
      label: 'Título del recurso',
      description: 'Primer encabezado 1 como título del recurso (no aparece como página)',
    },
  ];

  return (
    <div className="config-panel">
      <div className="config-group">
        <label>Encabezado 1 (H1)</label>
        <select
          value={options.heading1Mode}
          onChange={(e) => handleChange('heading1Mode', e.target.value as Heading1Mode)}
        >
          {heading1Options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="help-text">
          {heading1Options.find((o) => o.value === options.heading1Mode)?.description}
        </p>
      </div>

      <div className="config-group">
        <label>Encabezado 2 (H2)</label>
        <select
          value={options.heading2Mode}
          onChange={(e) => handleChange('heading2Mode', e.target.value as HeadingMode)}
        >
          {modeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="help-text">
          {modeOptions.find((o) => o.value === options.heading2Mode)?.description}
        </p>
      </div>

      <div className="config-group">
        <label>Encabezado 3 (H3)</label>
        <select
          value={options.heading3Mode}
          onChange={(e) => handleChange('heading3Mode', e.target.value as HeadingMode)}
        >
          {modeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="help-text">
          {modeOptions.find((o) => o.value === options.heading3Mode)?.description}
        </p>
      </div>

      <div className="config-group">
        <label>Encabezado 4 (H4)</label>
        <select
          value={options.heading4Mode}
          onChange={(e) => handleChange('heading4Mode', e.target.value as HeadingMode)}
        >
          {modeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="help-text">
          {modeOptions.find((o) => o.value === options.heading4Mode)?.description}
        </p>
      </div>

      <div className="config-group">
        <label>Estilo de salida (tema)</label>
        <select
          value={options.themeId || 'base'}
          onChange={(e) => handleChange('themeId', e.target.value)}
        >
          <option value="base">Por defecto (base eXeLearning)</option>
          <option value="Doctorado_26-27">Doctorado 26-27</option>
          <option value="Doctorat_26-27">Doctorat 26-27</option>
          <option value="PhD_26-27">PhD 26-27</option>
        </select>
        <p className="help-text">Selecciona el tema visual para tu recurso eXeLearning</p>
      </div>
    </div>
  );
}
