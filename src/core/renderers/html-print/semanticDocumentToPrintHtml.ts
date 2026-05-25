import type { SemanticDocument, SemanticPage, SemanticBlock } from '../../models/SemanticDocument';
import { loadPrintThemeAssets, type BuaBoxStyles } from './PrintThemeLoader';
import { renderCoverPage, type CoverPageMeta } from './renderCoverPage';
import { renderTableOfContents, sectionId } from './renderTableOfContents';

// CSS importado como string raw para inyectarlo inline en el HTML generado.
// Necesario porque el HTML se abre como blob: URL — rutas relativas no resuelven.
import printStylesCss from './printStyles.css?raw';

/**
 * Opciones del renderer HTML Print.
 *
 * Viven exclusivamente aquí — no contaminan SemanticDocument ni el pipeline DOCX.
 */
export interface PrintRenderOptions {
  /** ID del tema (ej: "Doctorado_26-27"). undefined → portada base sin imagen. */
  themeId?: string;

  /** Metadatos para la portada */
  cover?: CoverPageMeta;

  /**
   * Incluir portada. Default: true.
   * Desactivar para generar HTML de contenido solamente (útil para testing).
   */
  includeCover?: boolean;

  /**
   * Incluir TOC. Default: true.
   */
  includeToc?: boolean;
}

/**
 * Resultado del renderer print.
 */
export interface PrintHtmlResult {
  /** HTML completo autónomo, listo para abrir en navegador o procesar con Paged.js CLI */
  html: string;
  /** Número de páginas semánticas renderizadas (sin contar portada ni TOC) */
  pageCount: number;
}

/**
 * Renderer principal HTML Print.
 *
 * Pipeline:
 *   SemanticDocument
 *     → loadPrintThemeAssets()   [PrintThemeLoader]
 *     → renderCoverPage()        [renderCoverPage]
 *     → renderTableOfContents()  [renderTableOfContents]
 *     → renderContentPages()     [interno]
 *     → assembleHtmlDocument()   [interno]
 *   → string HTML autónomo
 *
 * El HTML resultante incluye Paged.js vía CDN.
 * Al abrirse en un navegador (o con @pagedjs/cli), Paged.js:
 *   - Aplica CSS @page
 *   - Resuelve target-counter() en el TOC
 *   - Inserta números de página en el footer
 *   - Genera bookmarks PDF
 *
 * AISLAMIENTO ARQUITECTÓNICO:
 *   ✅ No modifica SemanticDocument
 *   ✅ No toca ElpxRenderer ni ThemeService de ELPX
 *   ✅ No interfiere con el pipeline DOCX
 *
 * @param doc      Documento semántico (fuente de toda la estructura)
 * @param options  Opciones de render (tema, metadatos de portada, flags)
 */
export async function semanticDocumentToPrintHtml(
  doc: SemanticDocument,
  options: PrintRenderOptions = {},
): Promise<PrintHtmlResult> {
  const {
    themeId,
    cover = {},
    includeCover = true,
    includeToc = true,
  } = options;

  // 1. Cargar assets del tema (portada_pdf.*, logos, colores)
  const assets = await loadPrintThemeAssets(themeId);

  // 2. Generar secciones
  const coverHtml = includeCover
    ? renderCoverPage(doc, assets, cover)
    : '';

  const tocHtml = includeToc
    ? renderTableOfContents(doc)
    : '';

  const { html: contentHtml, pageCount } = renderContentPages(doc);

  // 3. Ensamblar documento HTML completo
  const html = assembleHtmlDocument({
    title: doc.title,
    coverHtml,
    tocHtml,
    contentHtml,
    primaryColor: assets.primaryColor,
    accentColor: assets.accentColor,
    fontFamilyTitle: assets.fontFamilyTitle,
    fontFamilyBody: assets.fontFamilyBody,
    buaStyles: assets.buaStyles,
    buaLogoDataUrl: assets.buaLogoDataUrl,
    uaLogoDataUrl: assets.uaLogoDataUrl,
  });

  return { html, pageCount };
}

// ─── Renderer de contenido ────────────────────────────────────────────────────

/**
 * Renderiza todas las páginas semánticas del documento como HTML.
 * Cada SemanticPage se convierte en un <section> con id="section-{index}".
 * Ese ID es el que usa el TOC para target-counter().
 */
function renderContentPages(doc: SemanticDocument): { html: string; pageCount: number } {
  const sectionsHtml = doc.pages.map((page, idx) =>
    renderSection(page, idx),
  ).join('\n');

  return {
    html: `<div class="content-pages">\n${sectionsHtml}\n</div>`,
    pageCount: doc.pages.length,
  };
}

function renderSection(page: SemanticPage, idx: number): string {
  const id = sectionId(page, idx);
  const blocksHtml = page.blocks.map(renderBlock).join('\n');
  const titleClass = `section-title-${page.level}`;
  const sectionClass = `section-level-${page.level}`;

  return `<section id="${id}" class="${sectionClass}">
  <h${page.level} class="${titleClass}">${escHtml(page.title)}</h${page.level}>
  ${blocksHtml}
</section>`;
}

function renderBlock(block: SemanticBlock): string {
  // Omitir bloques vacíos
  if (!block.html || block.html.trim() === '<p></p>') {
    return '';
  }

  // "Contenido" es el título genérico por defecto asignado a bloques sin H2/H3.
  const isDefaultTitle = !block.title || block.title === 'Contenido';

  if (isDefaultTitle) {
    // Bloque sin título de iDevice: sólo contenido
    return `<div class="content-block">
  <div class="block-html">${expandAccordions(block.html)}</div>
</div>`;
  }

  // iDevice con título: cabecera coloreada + borde perimetral (igual que en eXeLearning)
  return `<div class="content-block idevice-with-title">
  <header class="idevice-header">
    <h4 class="idevice-title">${escHtml(block.title)}</h4>
  </header>
  <div class="block-html">${expandAccordions(block.html)}</div>
</div>`;
}

/**
 * Expande los <details> para que estén abiertos en print.
 * No hacemos DOM parsing — usamos regex simple porque el HTML
 * de los bloques es controlado y predecible.
 */
function expandAccordions(html: string): string {
  return html.replace(/<details(\s|>)/gi, '<details open$1');
}

// ─── Ensamblador final ────────────────────────────────────────────────────────

interface AssemblyOptions {
  title: string;
  coverHtml: string;
  tocHtml: string;
  contentHtml: string;
  primaryColor: string;
  accentColor: string;
  fontFamilyTitle: string;
  fontFamilyBody: string;
  buaStyles: BuaBoxStyles;
  /** Data URL del logo BUA — aparece en encabezado de cada página */
  buaLogoDataUrl: string | null;
  /** Data URL del logo UA — aparece en pie de cada página */
  uaLogoDataUrl: string | null;
}

/**
 * Inyecta los running elements (header/footer) dentro de la sección cover.
 *
 * ESTRATEGIA: Los running elements deben estar dentro de una named-page
 * para que Paged.js no cree una página anónima antes de la cover.
 * Al inyectarlos dentro del <section class="cover-page"> (que tiene page: cover),
 * quedan registrados desde la primera página. @page cover los suprime con
 * content: none, y @page / @page toc los muestran donde corresponde.
 *
 * position: running() los extrae del flujo, así que no afectan al layout
 * visual de la portada.
 */
function injectRunningElements(
  coverHtml: string,
  opts: { buaLogoDataUrl: string | null; uaLogoDataUrl: string | null; title: string },
): string {
  const runningHtml = [
    `<div id="page-header-logo">${opts.buaLogoDataUrl ? `<img src="${opts.buaLogoDataUrl}" alt="BUA">` : ''}</div>`,
    `<div id="page-header-title"><span>${escHtml(opts.title)}</span></div>`,
    opts.uaLogoDataUrl ? `<div id="page-footer-logo"><img src="${opts.uaLogoDataUrl}" alt="UA"></div>` : '',
  ].filter(Boolean).join('\n');

  // Insertar justo antes del cierre de la sección cover
  if (coverHtml.includes('</section>')) {
    return coverHtml.replace(/(<\/section>)(?![\s\S]*<\/section>)/, `${runningHtml}\n$1`);
  }

  // Fallback: si no hay </section>, añadir al final del cover
  return coverHtml + '\n' + runningHtml;
}

/**
 * Ensambla el documento HTML completo autónomo con:
 * - Variables CSS del tema (colores, tipografías)
 * - Referencia al printStyles.css
 * - Script de Paged.js (CDN)
 * - Contenido: portada + TOC + secciones
 */
function assembleHtmlDocument(opts: AssemblyOptions): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(opts.title)}</title>

  <!-- Variables del tema inyectadas por el renderer -->
  <style>
    :root {
      --color-primary:    ${opts.primaryColor};
      --color-accent:     ${opts.accentColor};
      --font-title:       ${opts.fontFamilyTitle};
      --font-body:        ${opts.fontFamilyBody};

      /* Cajas semánticas BUA — colores y etiquetas extraídos del CSS del tema */
      --bua-color-ejemplo:    ${opts.buaStyles.ejemplo.borderColor};
      --bua-bg-ejemplo:       ${opts.buaStyles.ejemplo.bgColor};
      --bua-label-ejemplo:    "${opts.buaStyles.ejemplo.label.replace(/"/g, '\\"')}";

      --bua-color-definicion: ${opts.buaStyles.definicion.borderColor};
      --bua-bg-definicion:    ${opts.buaStyles.definicion.bgColor};
      --bua-label-definicion: "${opts.buaStyles.definicion.label.replace(/"/g, '\\"')}";

      --bua-color-importante: ${opts.buaStyles.importante.borderColor};
      --bua-bg-importante:    ${opts.buaStyles.importante.bgColor};
      --bua-label-importante: "${opts.buaStyles.importante.label.replace(/"/g, '\\"')}";
    }

    /* Aplicar variables del tema a los elementos del renderer */
    body {
      font-family: var(--font-body);
      color: #2a2a2a;
      font-size: 10.5pt;
      line-height: 1.65;
    }

    .toc-heading,
    .section-title-1,
    .section-title-2,
    .section-title-3,
    .section-title-4,
    .block-title,
    .cover-title {
      font-family: var(--font-title);
    }

    .section-title-1,
    .section-title-2,
    .section-title-3 {
      color: var(--color-primary);
      border-color: var(--color-accent);
    }

    .toc-heading {
      color: var(--color-primary);
      border-color: var(--color-accent);
    }
  </style>

  <!-- Estilos Paged Media del renderer print (inline — funciona desde blob: URL) -->
  <style>${printStylesCss}</style>

  <!-- Paged.js — polyfill CSS Paged Media en el navegador -->
  <!-- Registrar hook ANTES de que Paged.js empiece a paginar (DOMContentLoaded) -->
  <script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"></script>
  <script>
    // Abrir el diálogo de impresión automáticamente cuando Paged.js termine de paginar.
    // afterRendered() se llama una sola vez, justo cuando la paginación está completa.
    class PrintAfterRender extends Paged.Handler {
      afterRendered() {
        window.print();
      }
    }
    Paged.registerHandlers(PrintAfterRender);
  </script>
</head>
<body>

${injectRunningElements(opts.coverHtml, {
  buaLogoDataUrl: opts.buaLogoDataUrl,
  uaLogoDataUrl: opts.uaLogoDataUrl,
  title: opts.title,
})}

${opts.tocHtml}

${opts.contentHtml}

</body>
</html>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
