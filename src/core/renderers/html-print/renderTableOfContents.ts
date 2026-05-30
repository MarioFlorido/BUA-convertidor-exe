import type { SemanticDocument, SemanticPage } from '../../models/SemanticDocument';

/**
 * Entrada normalizada del TOC (una fila en el índice).
 */
interface TocEntry {
  id: string;
  title: string;
  level: 1 | 2 | 3 | 4;
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
 * @param doc  Documento semántico fuente
 */
export function renderTableOfContents(doc: SemanticDocument): string {
  const entries = buildTocEntries(doc.pages);

  if (entries.length === 0) {
    return '';
  }

  const itemsHtml = entries.map(renderTocItem).join('\n');

  return `
<section class="toc-page">
  <h2 class="toc-heading">Índice</h2>
  <nav class="toc" aria-label="Tabla de contenidos">
    <ol class="toc-list">
      ${itemsHtml}
    </ol>
  </nav>
</section>`.trim();
}

/**
 * Genera el ID estable de una sección de contenido.
 * Debe coincidir exactamente con el id="" que renderContentPages() pone en el HTML.
 */
export function sectionId(_page: SemanticPage, pageIndex: number): string {
  return `section-${pageIndex}`;
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

function buildTocEntries(pages: SemanticPage[]): TocEntry[] {
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
    }));
}

function renderTocItem(entry: TocEntry): string {
  return `<li class="toc-entry toc-level-${entry.level}">
        <a href="#${entry.id}">${escHtml(entry.title.toUpperCase())}</a>
      </li>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
