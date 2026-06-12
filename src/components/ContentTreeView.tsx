import type { DocumentStructure } from '../types';

interface ContentTreeViewProps {
  structure: DocumentStructure;
}

/* Geometría del árbol (unidades del viewBox) */
const W = 320;          // ancho lógico del SVG
const PAGE_ROW = 26;    // alto de la fila de una página
const H2_ROW = 21;      // alto de la fila de un H2
const SECTION_GAP = 12; // separación entre secciones
const INDENT = 22;      // sangrado por nivel de página

const OPTION_LABELS: Record<string, string | null> = {
  'html': null,
  'idevice-title': 'iDevice',
  'accordion': 'acordeón',
  'tabs': 'pestañas',
};

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(1, maxChars - 1)).trimEnd() + '…';
}

/**
 * Árbol del contenido: espejo en solo-lectura de la estructura que se está
 * configurando. Las páginas se sangran por nivel y se unen al padre con un
 * conector en L acabado en flecha; los H2 cuelgan como lista bajo su página,
 * con una píldora solo cuando tienen tratamiento especial.
 *
 * El alto se calcula fila a fila, así el SVG crece o encoge con el documento
 * y reacciona en vivo a los cambios de nivel y de opción de H2.
 */
export function ContentTreeView({ structure }: ContentTreeViewProps) {
  const elements: JSX.Element[] = [];
  /** Última página dibujada en cada nivel: ancla de los conectores. */
  const lastAtLevel: Partial<Record<number, { x: number; y: number }>> = {};
  let y = 6;

  structure.h1Sections.forEach((section) => {
    const level = Math.min(Math.max(section.level ?? 1, 1), 3) as 1 | 2 | 3;
    const px = 14 + (level - 1) * INDENT;
    const py = y + 9;

    // Conector en L desde la página padre (si la hay)
    const parent = level > 1 ? lastAtLevel[level - 1] : undefined;
    if (parent) {
      elements.push(
        <path
          key={`c-${section.id}`}
          d={`M ${parent.x} ${parent.y + 9} V ${py} H ${px - 11}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1.5"
        />,
        <polygon
          key={`a-${section.id}`}
          points={`${px - 11},${py - 4} ${px - 11},${py + 4} ${px - 4},${py}`}
          fill="var(--text-3)"
        />,
      );
    }

    lastAtLevel[level] = { x: px, y: py };
    if (level < 2) delete lastAtLevel[2];
    if (level < 3) delete lastAtLevel[3];

    // Nodo de página
    const titleMax = Math.floor((W - px - 17) / 6.6);
    elements.push(
      <circle key={`p-${section.id}`} cx={px} cy={py} r="5" fill="var(--text-2)" opacity="0.45" />,
      <text
        key={`t-${section.id}`}
        x={px + 13}
        y={py + 4.5}
        fontSize="13"
        fontWeight="600"
        fill="var(--text)"
      >
        {truncate(section.title, titleMax)}
      </text>,
    );
    y += PAGE_ROW;

    // H2s de la sección
    section.h2Items.forEach((h2) => {
      const cy = y + 7;
      const cx = px + 18;
      const textX = px + 28;
      const label = OPTION_LABELS[h2.option] ?? null;

      let textMax: number;
      if (label) {
        const badgeW = Math.round(label.length * 5.6) + 14;
        const badgeX = W - badgeW - 4;
        textMax = Math.floor((badgeX - textX - 10) / 6.1);
        elements.push(
          <rect
            key={`bb-${h2.id}`}
            x={badgeX}
            y={cy - 8}
            width={badgeW}
            height="16"
            rx="8"
            fill="var(--bg)"
            stroke="var(--border-light)"
            strokeWidth="1"
          />,
          <text
            key={`bt-${h2.id}`}
            x={badgeX + 7}
            y={cy + 3.5}
            fontSize="10.5"
            fill="var(--text-2)"
          >
            {label}
          </text>,
        );
      } else {
        textMax = Math.floor((W - textX - 4) / 6.1);
      }

      elements.push(
        <circle key={`hc-${h2.id}`} cx={cx} cy={cy} r="2.5" fill="var(--text-3)" opacity="0.6" />,
        <text
          key={`ht-${h2.id}`}
          x={textX}
          y={cy + 4}
          fontSize="12"
          fill="var(--text-2)"
        >
          {truncate(h2.text, textMax)}
        </text>,
      );
      y += H2_ROW;
    });

    y += SECTION_GAP;
  });

  const totalHeight = y + 4;

  return (
    <aside className="content-tree-view" aria-label="Árbol del contenido">
      <p className="content-tree-header">Árbol del contenido</p>
      <svg
        viewBox={`0 0 ${W} ${totalHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        className="content-tree-svg"
        role="img"
        aria-label="Representación jerárquica de páginas, subpáginas y apartados del documento"
      >
        {elements}
      </svg>
    </aside>
  );
}
