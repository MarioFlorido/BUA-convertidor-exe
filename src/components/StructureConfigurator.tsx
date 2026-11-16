import { useMemo, useState } from 'react';
import type { DocumentStructure, H2StructureOption } from '../types';
import {
  describeSemanticTagIssue,
  type SemanticTagIssue,
} from '../core/validation/semanticTagBalance';
import type { RecallKind } from '../core/services/structureMemory';
import {
  applyWordStructure,
  describeHeadingTagIssue,
  hasWordStructure,
  matchesWordStructure,
  type HeadingTagIssue,
} from '../core/pipeline/headingTags';
import { ContentTreeView } from './ContentTreeView';

interface StructureConfiguratorProps {
  structure: DocumentStructure;
  /**
   * Si la estructura viene ya rellena desde la memoria del navegador (el
   * mismo Word o su traducción, configurados antes), de qué tipo es la
   * coincidencia; `null` si es la recién parseada, en blanco.
   */
  recall?: RecallKind | null;
  /** Avisos (no bloqueantes) de cajas semánticas [ejemplo]/[fin] mal cerradas. */
  tagIssues?: SemanticTagIssue[];
  /** Avisos (no bloqueantes) de las etiquetas de estructura de los títulos. */
  headingTagIssues?: HeadingTagIssue[];
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
          'No se puede saltar de Página principal a un 3er nivel. Tiene que ir después de una Subpágina. Marca como Subpágina la página anterior, o cambia esta a Subpágina.';
      }
    }

    // Regla 2
    section.h2Items.forEach((h2, i) => {
      if (h2.option !== 'idevice-title') return;
      const next = section.h2Items[i + 1];
      if (next && next.option !== 'idevice-title') {
        h2Errors[h2.id] =
          'Un «Título de iDevice» crea un iDevice con ese título en la cabecera y un marco contenedor. Debe ser el último encabezamiento de la sección o ir seguido de otro iDevice con título.';
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

/** Marca de la opción que pide la etiqueta del título en el Word. */
function WordMark() {
  return (
    <span className="word-mark" title="Opción indicada por la etiqueta de este título en el Word">
      Word
    </span>
  );
}

/**
 * Una sola frase de ayuda. Si el árbol viene ya relleno de la memoria, esa
 * frase dice de dónde sale en vez de explicar cómo rellenarlo: quien ya lo
 * configuró una vez no necesita la explicación, y sí saber por qué no está en
 * blanco. Nada que pulsar: la estructura se edita igual que siempre.
 */
const HELP_TEXT: Record<RecallKind | 'none' | 'word', string> = {
  none: 'Cada Título 1 del Word será una página del curso. Despliega cada página para elegir cómo se muestran sus Título 2.',
  word: 'Se ha aplicado la estructura que indican las etiquetas de los títulos del Word. Puedes cambiar lo que quieras.',
  same: 'Se ha recuperado la estructura guardada en este navegador que elegiste la última vez para este documento.',
  similar: 'Se ha recuperado la estructura de otro documento con los mismos títulos que configuraste antes en este navegador. Revísala por si algo cambia.',
};

export function StructureConfigurator({ structure, recall = null, tagIssues = [], headingTagIssues = [], onConfirm, onCancel }: StructureConfiguratorProps) {
  const [localStructure, setLocalStructure] = useState(structure);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const validation = useMemo(() => validateStructure(localStructure), [localStructure]);

  // Etiquetas de estructura en los títulos del Word: son solo el valor inicial,
  // pero se señala qué pedía el Word y se puede volver a ello de un clic.
  const fromWord = useMemo(() => hasWordStructure(structure), [structure]);
  const asWordSays = useMemo(() => matchesWordStructure(localStructure), [localStructure]);
  const helpKind: RecallKind | 'none' | 'word' = recall ?? (fromWord ? 'word' : 'none');

  const errorH1Ids = useMemo(() => {
    const ids = new Set<string>(Object.keys(validation.h1Errors));
    localStructure.h1Sections.forEach((h1) => {
      if (h1.h2Items.some((h2) => validation.h2Errors[h2.id])) ids.add(h1.id);
    });
    return ids;
  }, [validation, localStructure]);

  const expandAll = () =>
    setOpenSections(new Set(localStructure.h1Sections.map((h1) => h1.id)));
  const collapseAll = () => setOpenSections(new Set());

  const handleTreePageClick = (h1Id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.add(h1Id);
      return next;
    });
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      document
        .getElementById(`h1-card-${h1Id}`)
        ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    }, 50);
  };

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
          <strong>Revisa las etiquetas entre corchetes del Word.</strong>{' '}
          {tagIssues.length === 1
            ? 'Hay una etiqueta mal colocada'
            : `Hay ${tagIssues.length} etiquetas mal colocadas`}
          . Si continúas así, parte del contenido puede quedar fuera de su sitio o
          la etiqueta puede verse tal cual en el curso.{' '}
          {tagIssues.length === 1 ? 'Corrígela' : 'Corrígelas'} en el Word y vuelve
          a subirlo:
          <ul className="tag-issue-list">
            {tagIssues.map((issue, i) => (
              <li key={i}>{describeSemanticTagIssue(issue)}</li>
            ))}
          </ul>
        </div>
      )}

      {headingTagIssues.length > 0 && (
        <div className="alert alert-warning" role="alert">
          <strong>Algunas etiquetas de los títulos no se han aplicado.</strong>{' '}
          {headingTagIssues.length === 1
            ? 'Una etiqueta no se ha podido aplicar'
            : `${headingTagIssues.length} etiquetas no se han podido aplicar`}
          . Puedes elegir la estructura aquí mismo, o corregir el Word y volver a
          subirlo para que la próxima vez salga bien:
          <ul className="tag-issue-list">
            {headingTagIssues.map((issue, i) => (
              <li key={i}>{describeHeadingTagIssue(issue)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="structure-top-bar">
        {helpKind !== 'none' ? (
          <p className="help-text help-text--recall" role="status">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <polyline points="3 3 3 9 9 9" />
              <polyline points="12 7 12 12 15.5 14" />
            </svg>
            {HELP_TEXT[helpKind]}
          </p>
        ) : (
          <p className="help-text">{HELP_TEXT.none}</p>
        )}
        <div className="expand-collapse-bar">
          {fromWord && (
            <>
              <button
                className="btn-expand-all"
                onClick={() => setLocalStructure(applyWordStructure(localStructure))}
                disabled={asWordSays}
                title={
                  asWordSays
                    ? 'La estructura ya coincide con las etiquetas del Word'
                    : 'Deshace tus cambios y vuelve a aplicar las etiquetas de los títulos del Word'
                }
              >
                Volver a las etiquetas definidas en el Word
              </button>
              <span className="expand-sep" aria-hidden="true">·</span>
            </>
          )}
          <button
            className="btn-expand-all"
            onClick={expandAll}
            disabled={openSections.size === localStructure.h1Sections.length}
          >
            Expandir todo
          </button>
          <span className="expand-sep" aria-hidden="true">·</span>
          <button
            className="btn-expand-all"
            onClick={collapseAll}
            disabled={openSections.size === 0}
          >
            Contraer todo
          </button>
        </div>
      </div>

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
              id={`h1-card-${h1.id}`}
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
                          {h1.wordLevel === level && <WordMark />}
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Botón expandir */}
                  <button
                    className="h1-toggle"
                    onClick={() => toggleSection(h1.id)}
                    aria-expanded={isOpen}
                    title={isOpen ? 'Ocultar sus Título 2' : 'Ver sus Título 2'}
                  >
                    {h2ErrorCount > 0 && (
                      <span
                        className="h1-error-badge"
                        title={`${h2ErrorCount} Título 2 por corregir`}
                      >
                        <svg className="badge-warn-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        {h2ErrorCount}
                      </span>
                    )}
                    <span className="h1-toggle-count">
                      {h1.h2Items.length} Título 2
                    </span>
                    <svg
                      className={`chevron${isOpen ? ' chevron--open' : ''}`}
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                    >
                      <polyline points="4 6 8 10 12 6" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Error de jerarquía de nivel — siempre visible */}
              {levelError && <p className="config-error config-error--level">{levelError}</p>}

              {/* LISTA DE H2 — siempre montada; el despliegue se anima con
                  grid-template-rows 0fr→1fr y visibility (ver .h2-list-wrap) */}
              <div className={`h2-list-wrap${isOpen ? ' h2-list-wrap--open' : ''}`}>
                <div className="h2-list-clip">
                <div className="h2-list">
                  {h1.h2Items.length === 0 ? (
                    <p className="no-h2">Esta página no tiene Título 2</p>
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
                                {h2.wordOption === option && <WordMark />}
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
                                {h2.wordOption === option && <WordMark />}
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
                </div>
              </div>
            </div>
          );
        })}
        </div>

        <ContentTreeView
          structure={localStructure}
          errorH1Ids={errorH1Ids}
          onPageClick={handleTreePageClick}
        />
      </div>

      {validation.hasErrors && (
        <p className="structure-error-summary" role="alert">
          Corrige lo que está marcado en rojo para poder continuar.
        </p>
      )}

      <div className="structure-actions">
        <button
          onClick={handleConfirm}
          className="btn-confirm"
          disabled={validation.hasErrors}
          title={validation.hasErrors ? 'Corrige lo marcado en rojo para poder continuar' : undefined}
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
