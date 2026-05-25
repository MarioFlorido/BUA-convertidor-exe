import { useState } from 'react';
import type { DocumentStructure, H2StructureOption } from '../types';

interface StructureConfiguratorProps {
  structure: DocumentStructure;
  onConfirm: (structure: DocumentStructure) => void;
  onCancel: () => void;
}

const LEVEL_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Página principal',
  2: 'Subpágina',
  3: 'Sub-subpágina',
};

const BLOCK1: { option: H2StructureOption; label: string }[] = [
  { option: 'idevice-title', label: 'Nombre de iDevice' },
  { option: 'html',          label: 'Cabecera 2 en texto' },
];

const BLOCK2: { option: H2StructureOption; label: string }[] = [
  { option: 'accordion', label: 'Acordeón' },
  { option: 'tabs',      label: 'Pestañas' },
];

export function StructureConfigurator({ structure, onConfirm, onCancel }: StructureConfiguratorProps) {
  const [localStructure, setLocalStructure] = useState(structure);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

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
      <h2>Configurar estructura del documento</h2>
      <p className="help-text">
        Cada H1 genera una página. Abre cada sección para configurar sus apartados H2.
      </p>

      <div className="structure-sections">
        {localStructure.h1Sections.map((h1, index) => {
          const isFirst = index === 0;
          const isOpen = openSections.has(h1.id);

          return (
            <div key={h1.id} className={`h1-card${isOpen ? ' h1-card--open' : ''}`}>

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
                    <span className="h1-toggle-count">
                      {h1.h2Items.length} H2
                    </span>
                    <span className="h1-toggle-arrow">{isOpen ? '▲' : '▼'}</span>
                  </button>
                </div>
              </div>

              {/* LISTA DE H2 — expandible */}
              {isOpen && (
                <div className="h2-list">
                  {h1.h2Items.length === 0 ? (
                    <p className="no-h2">No contiene encabezamientos H2</p>
                  ) : (
                    h1.h2Items.map((h2) => (
                      <div key={h2.id} className="h2-item">
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
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="structure-actions">
        <button onClick={() => onConfirm(localStructure)} className="btn-confirm">
          Continuar con esta estructura
        </button>
        <button onClick={onCancel} className="btn-cancel">
          Volver
        </button>
      </div>
    </div>
  );
}
