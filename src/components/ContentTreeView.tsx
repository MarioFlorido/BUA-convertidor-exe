import type { DocumentStructure } from '../types';

interface ContentTreeViewProps {
  structure: DocumentStructure;
}

const OPTION_LABELS: Record<string, string> = {
  'html': '',
  'idevice-title': 'iDevice',
  'accordion': 'acordeón',
  'tabs': 'pestañas',
};

export function ContentTreeView({ structure }: ContentTreeViewProps) {
  const viewBoxHeight = Math.max(600, structure.h1Sections.length * 180 + 100);

  return (
    <div className="content-tree-view">
      <p className="content-tree-header">Árbol del contenido</p>
      <svg
        viewBox={`0 0 420 ${viewBoxHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        className="content-tree-svg"
      >
        <defs>
          <style>
            {`
              .tree-line { stroke: var(--color-border-secondary); stroke-width: 1.5; fill: none; }
              .tree-circle { fill: var(--color-text-secondary); opacity: 0.4; }
              .tree-circle-h2 { fill: var(--color-text-secondary); opacity: 0.3; }
              .page-text { font-size: 13px; font-weight: 500; fill: var(--color-text-primary); }
              .h2-text { font-size: 12px; fill: var(--color-text-secondary); }
              .badge { font-size: 10px; fill: var(--color-text-tertiary); }
              .badge-bg { fill: var(--color-background-secondary); }
            `}
          </style>
        </defs>

        {structure.h1Sections.map((h1, h1Index) => {
          let yOffset = h1Index * 180;

          return (
            <g key={h1.id}>
              {/* H1 — Página */}
              <circle cx="30" cy={yOffset + 30} r="6" className="tree-circle" />
              <text x="45" y={yOffset + 35} className="page-text">
                {h1.title}
              </text>

              {/* H2s directos de la página */}
              {h1.h2Items.map((h2, h2Index) => {
                const baseY = yOffset + 60 + h2Index * 25;
                const label = OPTION_LABELS[h2.option];

                return (
                  <g key={h2.id}>
                    <circle cx="50" cy={baseY} r="3" className="tree-circle-h2" />
                    <text x="65" y={baseY + 4} className="h2-text">
                      {h2.text}
                    </text>
                    {label && (
                      <>
                        <rect x="225" y={baseY - 6} width={label === 'iDevice' ? 50 : 60} height="16" rx="4" className="badge-bg" />
                        <text x="230" y={baseY + 5} className="badge">
                          {label}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}

              {/* Línea vertical solo si hay subpáginas */}
              {h1.h2Items.length > 0 && (
                <line
                  x1="30"
                  y1={yOffset + 45}
                  x2="30"
                  y2={yOffset + 60 + h1.h2Items.length * 25 - 10}
                  className="tree-line"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
