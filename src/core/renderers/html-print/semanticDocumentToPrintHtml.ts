import type { SemanticDocument, SemanticPage, SemanticBlock } from '../../models/SemanticDocument';
import { loadPrintThemeAssets, type BuaBoxStyles } from './PrintThemeLoader';
import { renderCoverPage, type CoverPageMeta } from './renderCoverPage';
import { renderTableOfContents, sectionId } from './renderTableOfContents';
import { optimizeImagesForPrint } from './optimizeImagesForPrint';

// CSS importado como string raw para inyectarlo inline en el HTML generado.
// Necesario porque el HTML se abre como blob: URL — rutas relativas no resuelven.
import printStylesCss from './printStyles.css?raw';

// Paged.js (polyfill minificado) embebido como string. Inline en el HTML generado
// → PDF 100 % offline, sin CDN ni JS de terceros en runtime. Este import arrastra
// ~491 KB a este módulo; DownloadButton lo carga de forma diferida (import dinámico).
// Ruta relativa a node_modules: el `exports` de pagedjs no expone dist/ como bare
// specifier, pero un import de fichero relativo sí resuelve (y lo embebe vía ?raw).
import pagedPolyfillMin from '../../../../node_modules/pagedjs/dist/paged.polyfill.min.js?raw';

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

  /**
   * Usar imagen de portada del tema (portada_pdf.*). Default: true.
   * Si es false, la portada se muestra sin imagen de fondo aunque el tema la tenga.
   */
  useCoverImage?: boolean;

  /**
   * Optimizar (redimensionar/recomprimir) las imágenes embebidas del contenido
   * para reducir peso y acelerar la paginación. Default: true.
   */
  optimizeImages?: boolean;
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
 * El HTML resultante incluye Paged.js embebido inline (sin CDN; ver nota de cabecera).
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
    useCoverImage = true,
    optimizeImages = true,
  } = options;

  // 1. Cargar assets del tema (portada_pdf.*, logos, colores)
  const rawAssets = await loadPrintThemeAssets(themeId);
  const assets = useCoverImage
    ? rawAssets
    : { ...rawAssets, coverImageDataUrl: null };

  // 2. Generar secciones
  const coverHtml = includeCover
    ? renderCoverPage(doc, assets, cover)
    : '';

  const tocHtml = includeToc
    ? renderTableOfContents(doc)
    : '';

  const { html: rawContentHtml, pageCount } = renderContentPages(doc);

  // 2b. Optimizar imágenes embebidas (redimensionar/recomprimir) para reducir
  //     peso del HTML/PDF y acelerar la paginación. No-op si no hay DOM.
  const contentHtml = optimizeImages
    ? await optimizeImagesForPrint(rawContentHtml)
    : rawContentHtml;

  // 3. Ensamblar documento HTML completo (Paged.js embebido inline, sin CDN)
  const html = assembleHtmlDocument({
    title: doc.title,
    coverHtml,
    tocHtml,
    contentHtml,
    pagedPolyfillJs: pagedPolyfillMin,
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
  <h${page.level} class="${titleClass}">${escHtml(page.title.toUpperCase())}</h${page.level}>
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
    const htmlUpperH2 = markHorizontalTableHeaderRows(convertIframesToLinks(expandAccordions(block.html))).replace(
      /<h2([^>]*)>([^<]*)<\/h2>/gi,
      (_, attrs, text) => `<h2${attrs}>${text.toUpperCase()}</h2>`,
    );
    return `<div class="content-block">
  <div class="block-html">${htmlUpperH2}</div>
</div>`;
  }

  // iDevice con título: cabecera coloreada + borde perimetral (igual que en eXeLearning)
  const blockHtmlUpperH2 = markHorizontalTableHeaderRows(convertIframesToLinks(expandAccordions(block.html))).replace(
    /<h2([^>]*)>([^<]*)<\/h2>/gi,
    (_, attrs, text) => `<h2${attrs}>${text.toUpperCase()}</h2>`,
  );
  return `<div class="content-block idevice-with-title">
  <header class="idevice-header">
    <h4 class="idevice-title">${escHtml(block.title.toUpperCase())}</h4>
  </header>
  <div class="block-html">${blockHtmlUpperH2}</div>
</div>`;
}

/**
 * Convierte iframes en enlaces para el PDF.
 * Los iframes no se renderizan en Paged.js — se sustituyen por la URL de destino.
 * Para embeds de YouTube extrae la URL de watch a partir del src del embed.
 */
function convertIframesToLinks(html: string): string {
  return html.replace(
    /<iframe[^>]*\bsrc="([^"]*)"[^>]*>[\s\S]*?<\/iframe>/gi,
    (_, src: string) => {
      const ytMatch = src.match(/youtube(?:-nocookie)?\.com\/embed\/([^?&"]+)/i);
      const url = ytMatch
        ? `https://www.youtube.com/watch?v=${ytMatch[1]}`
        : src;
      return url ? `<div style="text-align: center; margin: 1em 0;"><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></div>` : '';
    },
  );
}

/**
 * Expande los <details> para que estén abiertos en print.
 * No hacemos DOM parsing — usamos regex simple porque el HTML
 * de los bloques es controlado y predecible.
 */
function expandAccordions(html: string): string {
  return html.replace(/<details(\s|>)/gi, '<details open$1');
}

/**
 * Marca la primera fila (<tr>) de cada tabla horizontal BUA con la clase
 * `bua-hrow`, para que la cabecera se estile por CLASE y no por `tr:first-child`.
 *
 * Motivo: Paged.js, al partir una tabla larga entre páginas, clona la <table>
 * en la continuación; con `tr:first-child` la primera fila de DATOS de esa
 * continuación se teñía como cabecera (gris oscuro). Con una clase en la fila
 * real, eso ya no ocurre.
 */
function markHorizontalTableHeaderRows(html: string): string {
  return html.replace(
    /(<table\b[^>]*\bbua_tabla_horizontal\b[^>]*>(?:\s*<(?:tbody|thead|colgroup)\b[^>]*>)*\s*)<tr>/gi,
    '$1<tr class="bua-hrow">',
  );
}

// ─── Ensamblador final ────────────────────────────────────────────────────────

interface AssemblyOptions {
  title: string;
  coverHtml: string;
  tocHtml: string;
  contentHtml: string;
  /** Código de Paged.js (paged.polyfill.min.js) inyectado inline, sin CDN. */
  pagedPolyfillJs: string;
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
 * - Script de Paged.js (embebido inline, sin CDN)
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
      line-height: 1.5;
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

  <!-- IMPORTANTE: Paged.js descarta las <style> de autor durante la paginación,
       así que los estilos del overlay y la barra van INLINE en cada elemento
       (ver más abajo). Aquí solo el @keyframes del spinner y un @media print de
       respaldo (la ocultación real en impresión se hace por JS con beforeprint). -->
  <style>
    @keyframes bua-spin{to{transform:rotate(360deg)}}
    @media print{#bua-print-overlay,#bua-print-bar{display:none !important;}}
  </style>

  <!-- Paged.js — polyfill CSS Paged Media, INLINE (sin CDN: offline + sin terceros) -->
  <!-- Registrar hook ANTES de que Paged.js empiece a paginar (DOMContentLoaded) -->
  <script>${opts.pagedPolyfillJs.replace(/<\/script/gi, '<\\/script')}</script>
  <script>
    // Overlay de progreso mientras Paged.js paginá. Se monta en <html> (no en
    // <body>) para que Paged.js, que paginá el body, no lo incluya en las páginas.
    (function () {
      var FONT = '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif';
      var ov = document.createElement('div');
      ov.id = 'bua-print-overlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;gap:14px;background:#eef1f5;color:#1d2733;font-family:' + FONT;
      ov.innerHTML =
        '<div style="width:34px;height:34px;border:3px solid #cfd6df;border-top-color:#1B6EC2;' +
        'border-radius:50%;animation:bua-spin .7s linear infinite;"></div>' +
        '<p style="margin:0;font-size:16px;font-weight:600;">Preparando el documento…</p>' +
        '<small style="color:#5b6776;font-size:12.5px;">Se abrirá el diálogo de impresión automáticamente.</small>';
      var mount = function () { document.documentElement.appendChild(ov); };
      if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
    })();

    // Barra de reintento + impresión segura.
    // CLAVE: la barra NUNCA está en el DOM mientras se imprime — se retira antes
    // de llamar a window.print() y se restaura al cerrar el diálogo. Así es
    // IMPOSIBLE que salga en el PDF, sin depender de @media print (Paged.js lo
    // descarta) ni de beforeprint (no siempre se dispara en print programático).
    var BUA_FONT = '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif';
    function buaShowBar() {
      if (document.getElementById('bua-print-bar')) return;
      var bar = document.createElement('div');
      bar.id = 'bua-print-bar';
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;display:flex;' +
        'align-items:center;justify-content:center;gap:14px;padding:8px 14px;background:#16365c;' +
        'color:#fff;font-family:' + BUA_FONT + ';font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.2);';
      bar.innerHTML = '<span>Documento listo.</span>' +
        '<button type="button" id="bua-print-btn" style="background:#1B6EC2;color:#fff;border:none;' +
        'border-radius:6px;padding:7px 16px;font-size:13px;font-weight:600;cursor:pointer;">' +
        'Imprimir / Guardar como PDF</button>';
      document.documentElement.appendChild(bar);
      bar.querySelector('#bua-print-btn').addEventListener('click', buaPrint);
    }
    function buaPrint() {
      var bar = document.getElementById('bua-print-bar');
      if (bar) bar.remove();                 // imprimir SIN barra en el DOM
      var done = false;
      var restore = function () {
        if (done) return; done = true;
        window.removeEventListener('afterprint', restore);
        window.removeEventListener('focus', restore);
        buaShowBar();
      };
      // Restaurar la barra al cerrar el diálogo: afterprint (estándar) o focus
      // (al volver el foco a la pestaña). Nunca por temporizador, para que no
      // reaparezca mientras el diálogo sigue abierto.
      window.addEventListener('afterprint', restore);
      window.addEventListener('focus', restore);
      window.print();
    }

    class PrintAfterRender extends Paged.Handler {
      afterRendered() {
        var ov = document.getElementById('bua-print-overlay');
        if (ov) ov.remove();
        buaPrint();                          // primer print, ya sin barra en el DOM
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
