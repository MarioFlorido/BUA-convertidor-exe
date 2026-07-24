import type { SemanticDocument, SemanticPage } from '../../models/SemanticDocument';
import type { PrintLanguage } from './PrintThemeLoader';
import { escHtml } from '../../utils/html';

/**
 * Título de la página de índice por idioma del tema.
 * Mismo patrón que CC_TEXT en renderCoverPage: se elige con `assets.language`,
 * que PrintThemeLoader ya detecta (config.xml → etiquetas BUA → ID → 'es').
 */
const TOC_HEADING: Record<PrintLanguage, string> = {
  es: 'Índice',
  ca: 'Índex',
  en: 'Table of Contents',
};

/**
 * Entrada normalizada del TOC (una fila en el índice).
 */
interface TocEntry {
  id: string;
  title: string;
  level: 1 | 2 | 3 | 4;
  number?: string;
}

/**
 * Genera el HTML de la página de índice (TOC).
 *
 * Estrategia de numeración de página:
 *   No incrustamos números manualmente — usamos CSS Paged Media:
 *
 *     .toc-entry a::after {
 *       content: leader(dotted) target-counter(attr(href url), page);
 *     }
 *
 *   Paged.js resuelve target-counter() automáticamente al paginar,
 *   conectando cada href="#section-{id}" con el número de página
 *   donde aparece el elemento con id="section-{id}" en el contenido.
 *
 * Generado DESDE SemanticDocument, NO parseando HTML renderizado.
 *
 * @param doc      Documento semántico fuente
 * @param options  `numbered`: prefijar cada entrada con su numeración jerárquica (1, 1.1, 1.1.1…)
 */
export function renderTableOfContents(
  doc: SemanticDocument,
  options: { numbered?: boolean; language?: PrintLanguage } = {},
): string {
  const numbers = options.numbered ? computeHeadingNumbers(doc.pages) : undefined;
  const entries = buildTocEntries(doc.pages, numbers);

  if (entries.length === 0) {
    return '';
  }

  const itemsHtml = entries.map(renderTocItem).join('\n');
  const heading = TOC_HEADING[options.language ?? 'es'];

  return `
<section class="toc-page">
  <h2 class="toc-heading">${heading}</h2>
  <nav class="toc" aria-label="Tabla de contenidos">
    <ol class="toc-list">
      ${itemsHtml}
    </ol>
  </nav>
</section>`.trim();
}

/**
 * Calcula la numeración jerárquica (1, 1.1, 1.1.1…) de las páginas de nivel 1-3,
 * indexada por el índice original del array (el mismo que usa sectionId()).
 *
 * Asume orden de documento (pre-order): cada página de nivel N reinicia los
 * contadores de los niveles N+1 en adelante.
 */
export function computeHeadingNumbers(pages: SemanticPage[]): Map<number, string> {
  const counters = [0, 0, 0]; // niveles 1, 2, 3
  const numbers = new Map<number, string>();

  pages.forEach((page, idx) => {
    if (page.level < 1 || page.level > 3) return;
    const levelIdx = page.level - 1;
    counters[levelIdx]++;
    for (let l = levelIdx + 1; l < counters.length; l++) counters[l] = 0;
    numbers.set(idx, counters.slice(0, levelIdx + 1).join('.'));
  });

  return numbers;
}

/**
 * Genera el ID estable de una sección de contenido.
 * Debe coincidir exactamente con el id="" que renderContentPages() pone en el HTML.
 */
export function sectionId(_page: SemanticPage, pageIndex: number): string {
  return `section-${pageIndex}`;
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

function buildTocEntries(pages: SemanticPage[], numbers?: Map<number, string>): TocEntry[] {
  // CRÍTICO: usar el índice original del array completo, NO el del array filtrado.
  // El content renderer usa doc.pages[idx] para asignar id="section-{idx}".
  // Si filtramos primero y luego usamos el idx del array filtrado, los IDs no coinciden.
  return pages
    .map((page, originalIdx) => ({ page, originalIdx }))
    .filter(({ page }) => page.level <= 3)
    .map(({ page, originalIdx }) => ({
      id: sectionId(page, originalIdx),
      title: page.title,
      level: page.level as 1 | 2 | 3 | 4,
      number: numbers?.get(originalIdx),
    }));
}

function renderTocItem(entry: TocEntry): string {
  const prefix = entry.number ? `${entry.number} ` : '';
  return `<li class="toc-entry toc-level-${entry.level}">
        <a href="#${entry.id}">${prefix}${escHtml(entry.title.toUpperCase())}</a>
      </li>`;
}
