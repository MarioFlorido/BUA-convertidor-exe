import { useMemo, useState } from 'react';
import type { DocumentStructure, H2StructureOption } from '../types';
import {
  describeSemanticTagIssue,
  type SemanticTagIssue,
} from '../core/validation/semanticTagBalance';
import { ContentTreeView } from './ContentTreeView';

interface StructureConfiguratorProps {
  structure: DocumentStructure;
  /** Avisos (no bloqueantes) de cajas semánticas [ejemplo]/[fin] mal cerradas. */
  tagIssues?: SemanticTagIssue[];
  onConfirm: (structure: DocumentStructure) => void;
  onCancel: () => void;
}

export interface StructureValidation {
  /** h1Id -> mensaje de error de jerarquía de nivel */
  h1Errors: Record<string, string>;
  /** h2Id -> mensaje de error de clasificación */
  h2Errors: Record<string, string>;
  hasErrors: boolean;
}

/**
 * Valida las dos reglas de maquetación del ELPX:
 *
 * 1. Jerarquía de páginas: una página de 3er nivel debe ir precedida por una
 *    subpágina (2º nivel) o por otra de 3er nivel (hermana). No se puede saltar
 *    de 1er a 3er nivel.
 *
 * 2. Título de iDevice: un H2 marcado como "Título de iDevice" genera un bloque
 *    hoja que no puede contener dentro otro H2, acordeón ni pestañas. Por eso
 *    solo es válido si es el último H2 de su sección o si el H2 siguiente también
 *    es "Título de iDevice". Si le sigue un H2 en texto / acordeón / pestañas,
 *    ese contenido quedaría anidado dentro del iDevice (estructura inválida).
 */
export function validateStructure(structure: DocumentStructure): StructureValidation {
  const h1Errors: Record<string, string> = {};
  const h2Errors: Record<string, string> = {};
  const sections = structure.h1Sections;

  sections.forEach((section, index) => {
    // Regla 1
    if (section.level === 3) {
      const prev = index > 0 ? sections[index - 1] : null;
      if (!prev || (prev.level !== 2 && prev.level !== 3)) {
        h1Errors[section.id] =
          'No se puede saltar de Página principal a un 3er nivel.';
      }
    }

    // Regla 2
    section.h2Items.forEach((h2, i) => {
      if (h2.option !== 'idevice-title') return;
      const next = section.h2Items[i + 1];
      if (next && next.option !== 'idevice-title') {
        h2Errors[h2.id] =
          'Un «Título de iDevice» crea un iDevice con ese título en la cabecera y un marco contenedor. Debe ser el último H2 de la sección o ir seguido de otro iDevice con título';
      }
    });
  });

  return {
    h1Errors,
    h2Errors,
    hasErrors: Object.keys(h1Errors).length > 0 || Object.keys(h2Errors).length > 0,
  };
}

const LEVEL_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Página principal',
  2: 'Subpágina',
  3: '3er nivel',
};

const BLOCK1: { option: H2StructureOption; label: string }[] = [
  { option: 'idevice-title', label: 'Título de iDevice' },
  { option: 'html',          label: 'Cabecera 2 en texto' },
];

const BLOCK2: { option: H2StructureOption; label: string }[] = [
  { option: 'accordion', label: 'Acordeón' },
  { option: 'tabs',      label: 'Pestañas' },
];

export function StructureConfigurator({ structure, tagIssues = [], onConfirm, onCancel }: StructureConfiguratorProps) {
  const [localStructure, setLocalStructure] = useState(structure);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const validation = useMemo(() => validateStructure(localStructure), [localStructure]);

  /** Nº de H2 con error dentro de una sección (para avisar aunque esté plegada) */
  const countH2Errors = (h1Id: string) => {
    const section = localStructure.h1Sections.find((h1) => h1.id === h1Id);
    if (!section) return 0;
    return section.h2Items.filter((h2) => validation.h2Errors[h2.id]).length;
  };

  const handleConfirm = () => {
    if (validation.hasErrors) return;
    onConfirm(localStructure);
  };

  const toggleSection = (h1Id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(h1Id) ? next.delete(h1Id) : next.add(h1Id);
      return next;
    });
  };

  const handleH1LevelChange = (h1Id: string, level: 1 | 2 | 3) => {
    setLocalStructure({
      h1Sections: localStructure.h1Sections.map((h1) =>
        h1.id === h1Id ? { ...h1, level } : h1
      ),
    });
  };

  const handleH2OptionChange = (h1Id: string, h2Id: string, option: H2StructureOption) => {
    setLocalStructure({
      h1Sections: localStructure.h1Sections.map((h1) =>
        h1.id === h1Id
          ? {
              ...h1,
              h2Items: h1.h2Items.map((h2) =>
                h2.id === h2Id ? { ...h2, option } : h2
              ),
            }
          : h1
      ),
    });
  };

  return (
    <div className="structure-configurator">
      {tagIssues.length > 0 && (
        <div className="alert alert-warning" role="alert">
          <strong>Revisa las cajas semánticas antes de continuar.</strong> Parece que
          {tagIssues.length === 1 ? ' una caja no está' : ` ${tagIssues.length} cajas no están`}{' '}
          bien cerrada{tagIssues.length === 1 ? '' : 's'} con <code>[fin]</code>. Si conviertes
          así, el contenido puede mezclarse o aparecer la etiqueta como texto. Corrige el documento
          de Word y vuelve a subirlo:
          <ul className="tag-issue-list">
            {tagIssues.map((issue, i) => (
              <li key={i}>{describeSemanticTagIssue(issue)}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="help-text">
        Cada H1 genera una página. Abre cada sección para configurar sus apartados H2.
      </p>

      <div className="structure-main-layout">
        <div className="structure-sections">
        {localStructure.h1Sections.map((h1, index) => {
          const isFirst = index === 0;
          const isOpen = openSections.has(h1.id);
          const levelError = validation.h1Errors[h1.id];
          const h2ErrorCount = countH2Errors(h1.id);
          const hasError = Boolean(levelError) || h2ErrorCount > 0;

          return (
            <div
              key={h1.id}
              className={`h1-card${isOpen ? ' h1-card--open' : ''}${hasError ? ' h1-card--error' : ''}`}
            >

              {/* CABECERA — siempre visible */}
              <div className="h1-card-header">
                <div className="h1-card-title">
                  <span className="h1-card-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                      <path d="M14 3v5h5" />
                      <line x1="9" y1="13" x2="15" y2="13" />
                      <line x1="9" y1="17" x2="13" y2="17" />
                    </svg>
                  </span>
                  <span className="h1-card-text">{h1.title}</span>
                </div>

                <div className="h1-card-controls">
                  {/* Nivel — fijo para el primero, seleccionable para el resto */}
                  {isFirst ? (
                    <span className="level-fixed">Página principal</span>
                  ) : (
                    <div className="level-selector">
                      {([1, 2, 3] as const).map((level) => (
                        <label
                          key={level}
                          className={`level-option${h1.level === level ? ' level-option--active' : ''}`}
                        >
                          <input
                            type="radio"
                            name={`${h1.id}-level`}
                            value={level}
                            checked={h1.level === level}
                            onChange={() => handleH1LevelChange(h1.id, level)}
                          />
                          {LEVEL_LABELS[level]}
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Botón expandir */}
                  <button
                    className="h1-toggle"
                    onClick={() => toggleSection(h1.id)}
                    aria-expanded={isOpen}
                    title={isOpen ? 'Cerrar sección' : 'Abrir sección'}
                  >
                    {h2ErrorCount > 0 && (
                      <span
                        className="h1-error-badge"
                        title={`${h2ErrorCount} H2 con errores`}
                      >
                        ⚠ {h2ErrorCount}
                      </span>
                    )}
                    <span className="h1-toggle-count">
                      {h1.h2Items.length} H2
                    </span>
                    <span className="h1-toggle-arrow">{isOpen ? '▲' : '▼'}</span>
                  </button>
                </div>
              </div>

              {/* Error de jerarquía de nivel — siempre visible */}
              {levelError && <p className="config-error config-error--level">{levelError}</p>}

              {/* LISTA DE H2 — expandible */}
              {isOpen && (
                <div className="h2-list">
                  {h1.h2Items.length === 0 ? (
                    <p className="no-h2">No contiene encabezamientos H2</p>
                  ) : (
                    h1.h2Items.map((h2) => {
                      const h2Error = validation.h2Errors[h2.id];
                      return (
                      <div key={h2.id} className={`h2-item${h2Error ? ' h2-item--error' : ''}`}>
                        <div className="h2-item-name">{h2.text}</div>
                        <div className="h2-item-blocks">

                          {/* Bloque 1 — opciones estándar */}
                          <div className="h2-block">
                            {BLOCK1.map(({ option, label }) => (
                              <label
                                key={option}
                                className={`h2-option${h2.option === option ? ' h2-option--active' : ''}`}
                              >
                                <input
                                  type="radio"
                                  name={h2.id}
                                  value={option}
                                  checked={h2.option === option}
                                  onChange={() => handleH2OptionChange(h1.id, h2.id, option)}
                                />
                                {label}
                              </label>
                            ))}
                          </div>

                          {/* Bloque 2 — efectos especiales */}
                          <div className="h2-block h2-block--special">
                            <span className="h2-block-label">Efectos</span>
                            {BLOCK2.map(({ option, label }) => (
                              <label
                                key={option}
                                className={`h2-option${h2.option === option ? ' h2-option--active' : ''}`}
                              >
                                <input
                                  type="radio"
                                  name={h2.id}
                                  value={option}
                                  checked={h2.option === option}
                                  onChange={() => handleH2OptionChange(h1.id, h2.id, option)}
                                />
                                {label}
                              </label>
                            ))}
                          </div>

                        </div>

                        {h2Error && <p className="config-error">{h2Error}</p>}
                      </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>

        <ContentTreeView structure={localStructure} />
      </div>

      {validation.hasErrors && (
        <p className="structure-error-summary" role="alert">
          Hay errores de estructura que debes corregir antes de continuar.
        </p>
      )}

      <div className="structure-actions">
        <button
          onClick={handleConfirm}
          className="btn-confirm"
          disabled={validation.hasErrors}
          title={validation.hasErrors ? 'Corrige los errores de estructura para continuar' : undefined}
        >
          Continuar con esta estructura
        </button>
        <button onClick={onCancel} className="btn-cancel">
          Volver
        </button>
      </div>
    </div>
  );
}
