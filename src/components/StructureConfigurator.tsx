import React from 'react';
import type { DocumentStructure, H2StructureOption } from '../types';

interface StructureConfiguratorProps {
  structure: DocumentStructure;
  onConfirm: (structure: DocumentStructure) => void;
  onCancel: () => void;
}

export function StructureConfigurator({ structure, onConfirm, onCancel }: StructureConfiguratorProps) {
  const [localStructure, setLocalStructure] = React.useState(structure);

  const handleH1LevelChange = (h1Id: string, level: 1 | 2 | 3) => {
    setLocalStructure({
      h1Sections: localStructure.h1Sections.map((h1) => {
        if (h1.id === h1Id) {
          return { ...h1, level };
        }
        return h1;
      }),
    });
  };

  const handleH2OptionChange = (h1Id: string, h2Id: string, option: H2StructureOption) => {
    setLocalStructure({
      h1Sections: localStructure.h1Sections.map((h1) => {
        if (h1.id === h1Id) {
          return {
            ...h1,
            h2Items: h1.h2Items.map((h2) => {
              if (h2.id === h2Id) {
                return { ...h2, option };
              }
              return h2;
            }),
          };
        }
        return h1;
      }),
    });
  };

  const optionLabels: Record<H2StructureOption, string> = {
    'idevice-title': 'Nombre de iDevice',
    'html': 'H2 en HTML',
    'accordion': 'Acordeón',
  };

  return (
    <div className="structure-configurator">
      <h2>Configurar estructura del documento</h2>
      <p className="help-text">
        Cada H1 crea una página nueva. Para cada H2, selecciona cómo deseas que se estructure:
      </p>

      <div className="structure-sections">
        {localStructure.h1Sections.map((h1) => (
          <div key={h1.id} className="h1-section">
            <div className="h1-title">
              <h3>📄 {h1.title}</h3>
              <div className="h1-level-selector">
                <label className="radio-option">
                  <input
                    type="radio"
                    name={`${h1.id}-level`}
                    value="1"
                    checked={h1.level === 1}
                    onChange={() => handleH1LevelChange(h1.id, 1)}
                  />
                  <span className="radio-label">Página principal</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name={`${h1.id}-level`}
                    value="2"
                    checked={h1.level === 2}
                    onChange={() => handleH1LevelChange(h1.id, 2)}
                  />
                  <span className="radio-label">Subpágina</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name={`${h1.id}-level`}
                    value="3"
                    checked={h1.level === 3}
                    onChange={() => handleH1LevelChange(h1.id, 3)}
                  />
                  <span className="radio-label">Nivel 3</span>
                </label>
              </div>
            </div>

            {h1.h2Items.length > 0 ? (
              <div className="h2-items">
                {h1.h2Items.map((h2) => (
                  <div key={h2.id} className="h2-item">
                    <div className="h2-title">{h2.text}</div>
                    <div className="h2-options">
                      {(Object.keys(optionLabels) as H2StructureOption[]).map((option) => (
                        <label key={option} className="radio-option">
                          <input
                            type="radio"
                            name={h2.id}
                            value={option}
                            checked={h2.option === option}
                            onChange={() => handleH2OptionChange(h1.id, h2.id, option)}
                          />
                          <span className="radio-label">{optionLabels[option]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-h2">No contiene encabezamientos H2</p>
            )}
          </div>
        ))}
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
