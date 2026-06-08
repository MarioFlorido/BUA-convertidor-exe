import type { SemanticDocument, SemanticBlock } from '../models/SemanticDocument';
import { escapeHtml } from '../utils/html';
import { RESOURCE_DIR } from '../transformers/ImageExtractor';

export interface PreviewPageInfo {
  title: string;
  href: string;
  pageNumber: number;
  level: 1 | 2 | 3 | 4;
  parentIndex: number | null;
}

/**
 * PreviewService - Genera HTML preview standalone para eXeLearning
 *
 * Responsabilidades:
 * - Generar páginas HTML de preview (navegables)
 * - Generar navegación entre páginas
 * - Generar bloques/iDevices como HTML
 * - Sanitizar HTML para evitar scripts maliciosos
 * - Agregar páginas al ZIP del ELPX
 *
 * El preview es una representación HTML simplificada y navegable del proyecto.
 * No es la representación interna de eXeLearning (que usa XML).
 */
export class PreviewService {
  constructor(private project: SemanticDocument) {}

  /**
   * Construir todas las páginas de preview HTML
   *
   * @returns Record donde clave es href (ej "index.html", "html/pagina-1.html") y valor es HTML completo
   */
  buildPages(): Record<string, string> {
    const pages = this.getPageInfo();
    const output: Record<string, string> = {};

    for (const [index, _pageInfo] of pages.entries()) {
      const html = this.generatePageHtml(pages, index);
      output[pages[index].href] = html;
    }

    return output;
  }

  /**
   * Agregar páginas de preview al ZIP del ELPX
   *
   * @param entries Record de entries del ZIP - se modifica in-place
   */
  addToZipEntries(entries: Record<string, Uint8Array>, prebuiltPages?: Record<string, string>): void {
    // Eliminar páginas HTML antiguas
    for (const existingPath of Object.keys(entries)) {
      if (existingPath.startsWith('html/') && existingPath.endsWith('.html')) {
        delete entries[existingPath];
      }
    }

    // Usar páginas ya construidas si se pasan, o construirlas ahora
    const previewPages = prebuiltPages ?? this.buildPages();
    for (const [href, html] of Object.entries(previewPages)) {
      entries[href] = new TextEncoder().encode(html);
    }
  }

  /**
   * Obtener información de páginas para preview
   *
   * @returns Array de objetos con metadatos de cada página
   */
  private getPageInfo(): PreviewPageInfo[] {
    const used = new Set<string>();

    return this.project.pages.map((page, index) => {
      if (index === 0) {
        return {
          title: page.title || 'Página 1',
          href: 'index.html',
          pageNumber: 1,
          level: page.level,
          parentIndex: page.parentIndex,
        };
      }

      let slug = slugifyPageTitle(page.title || `pagina-${index + 1}`);
      if (!slug) {
        slug = `pagina-${index + 1}`;
      }

      let candidate = slug;
      let suffix = 2;
      while (used.has(candidate)) {
        candidate = `${slug}-${suffix}`;
        suffix += 1;
      }
      used.add(candidate);

      return {
        title: page.title || `Página ${index + 1}`,
        href: `html/${candidate}.html`,
        pageNumber: index + 1,
        level: page.level,
        parentIndex: page.parentIndex,
      };
    });
  }

  /**
   * Generar HTML completo de una página de preview
   */
  private generatePageHtml(pages: PreviewPageInfo[], activeIndex: number): string {
    const activePageInfo = pages[activeIndex];
    const activePage = this.project.pages[activeIndex];
    const assetPrefix = activeIndex === 0 ? '' : '../';
    const prevPage = activeIndex > 0 ? pages[activeIndex - 1] : null;
    const nextPage = activeIndex < pages.length - 1 ? pages[activeIndex + 1] : null;
    const navItems = this.generateNavHtml(pages, activePageInfo.pageNumber, activeIndex);
    const blocks = activePage.blocks
      .map((block, blockIndex) => this.generateBlockHtml(block, activePageInfo.pageNumber, blockIndex, assetPrefix))
      .join('\n');
    const prevHref = prevPage
      ? activeIndex === 1
        ? '../index.html'
        : activeIndex > 1
          ? prevPage.href.replace(/^html\//, '')
          : prevPage.href
      : '';
    const nextHref = nextPage
      ? activeIndex === 0
        ? nextPage.href
        : nextPage.pageNumber === 1
          ? '../index.html'
          : nextPage.href.replace(/^html\//, '')
      : '';

    return `<!DOCTYPE html>
<html lang="es" id="exe-index">
<head>
<meta charset="utf-8">
<meta name="generator" content="ConvertidoreXe v1.0">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="license" type="text/html" href="https://creativecommons.org/licenses/by-sa/4.0/">
<title>${escapeHtml(this.project.title || 'eXeLearning')}</title>
<link rel="icon" type="image/x-icon" href="${assetPrefix}libs/favicon.ico">
<script>document.querySelector("html").classList.add("js");</script><script src="${assetPrefix}libs/jquery/jquery.min.js"> </script><script src="${assetPrefix}libs/common_i18n.js"> </script><script src="${assetPrefix}libs/common.js"> </script><script src="${assetPrefix}libs/exe_export.js"> </script><script src="${assetPrefix}libs/bootstrap/bootstrap.bundle.min.js"> </script><link rel="stylesheet" href="${assetPrefix}libs/bootstrap/bootstrap.min.css">
<script src="${assetPrefix}idevices/text/text.js"></script><link rel="stylesheet" href="${assetPrefix}idevices/text/text.css">
<link rel="stylesheet" href="${assetPrefix}content/css/base.css"><script src="${assetPrefix}theme/style.js"> </script><link rel="stylesheet" href="${assetPrefix}theme/style.css">
<style>
body.exe-export.exe-web-site{min-width:0}
.idevice_node.text .exe-text-template>:first-child{margin-top:0}
.idevice_node.text .exe-text-template>:last-child{margin-bottom:0}
.page-content .box+.box{margin-top:1.25rem}
</style>
</head>
<body class="exe-export exe-web-site">
<script>document.body.className+=" js"</script>
<div class="exe-content exe-export pre-js siteNav-hidden"> <nav id="siteNav">
<ul>
${navItems}
</ul>
</nav><main id="${escapeHtml(createPageDomId(activePageInfo.pageNumber))}" class="page">
<header class="main-header"> <p class="page-counter"> <span class="page-counter-label">Página </span><span class="page-counter-content"> <strong class="page-counter-current-page">${activePageInfo.pageNumber}</strong><span class="page-counter-sep">/</span><strong class="page-counter-total">${pages.length}</strong></span></p>

<div class="package-header"><h1 class="package-title">${escapeHtml(this.project.title || 'Documento importado')}</h1></div>
<div class="page-header"><h2 class="page-title">${escapeHtml(activePage.title || `Página ${activePageInfo.pageNumber}`)}</h2></div>
</header><div id="page-content-${escapeHtml(createPageDomId(activePageInfo.pageNumber))}" class="page-content">
${blocks}
</div></main><div class="nav-buttons">
${prevPage ? `<a href="${escapeHtml(prevHref)}" title="Previous" class="nav-button nav-button-left"><span>Previous</span></a>` : '<span class="nav-button nav-button-left" aria-hidden="true"><span>Previous</span></span>'}
${nextPage ? `<a href="${escapeHtml(nextHref)}" title="Next" class="nav-button nav-button-right"><span>Next</span></a>` : '<span class="nav-button nav-button-right" aria-hidden="true"><span>Next</span></span>'}
</div>
<footer id="siteFooter"><div id="siteFooterContent"> <div id="packageLicense" class="cc cc-by-sa"> <p> <span class="license-label">Licencia: </span><a href="https://creativecommons.org/licenses/by-sa/4.0/" class="license">creative commons: attribution - share alike 4.0 (BY-SA)</a></p>
</div>
</div></footer>
</div>

</body>
</html>`;
  }

  /**
   * Generar navegación HTML (árbol de páginas)
   */
  private generateNavHtml(pages: PreviewPageInfo[], activePageNumber: number, activeIndex: number): string {
    const buildHref = (pageInfo: PreviewPageInfo): string => {
      if (activeIndex === 0) {
        return pageInfo.href;
      }
      return pageInfo.pageNumber === 1 ? `../${pageInfo.href}` : pageInfo.href.replace(/^html\//, '');
    };

    const renderBranch = (parentIndex: number | null): string => {
      const branchPages = pages.filter((page, index) => page.parentIndex === parentIndex && index !== parentIndex);

      return branchPages
        .map((pageInfo) => {
          const pageIndex = pages.findIndex((candidate) => candidate.pageNumber === pageInfo.pageNumber);
          const active = pageInfo.pageNumber === activePageNumber;
          const classes = [
            active ? 'active' : '',
            pageInfo.pageNumber === 1 ? 'root-node' : '',
            `nav-level-${pageInfo.level}`,
          ]
            .filter(Boolean)
            .join(' ');
          const childrenHtml = renderBranch(pageIndex);
          const childList = childrenHtml ? `\n<ul>\n${childrenHtml}\n</ul>` : '';
          return `<li${active ? ' class="active"' : ''}><a href="${escapeHtml(buildHref(pageInfo))}" class="${escapeHtml(`${classes} no-ch`.trim())}">${escapeHtml(pageInfo.title)}</a>${childList}</li>`;
        })
        .join('\n');
    };

    return renderBranch(null);
  }

  /**
   * Generar HTML de un bloque/iDevice
   */
  private generateBlockHtml(block: SemanticBlock, pageNumber: number, blockIndex: number, assetPrefix = ''): string {
    const blockId = `block-preview-${pageNumber}-${blockIndex + 1}`;
    const ideviceId = `idevice-preview-${pageNumber}-${blockIndex + 1}`;
    let sanitizedHtml = sanitizePreviewBlockHtml(block.html || '<p></p>');
    // Las imágenes extraídas viven en content/resources/. En páginas anidadas
    // (html/*.html) hay que prefijar con ../ para que la ruta resuelva.
    if (assetPrefix) {
      sanitizedHtml = sanitizedHtml.split(`"${RESOURCE_DIR}/`).join(`"${assetPrefix}${RESOURCE_DIR}/`);
    }

    return `<article id="${escapeHtml(blockId)}" class="box">
<header class="box-head no-icon">
<h1 class="box-title">${escapeHtml(block.title || 'Contenido')}</h1>
<button class="box-toggle box-toggle-on" title="Toggle content">
<span>Toggle content</span>
</button></header>
<div class="box-content">
<div id="${escapeHtml(ideviceId)}" class="idevice_node text" data-idevice-path="idevices/text/" data-idevice-type="text" data-idevice-component-type="json" data-idevice-json-data="{&quot;ideviceId&quot;:&quot;${escapeHtml(ideviceId)}&quot;}">
<div class="exe-text"><div class="exe-text-template">
${sanitizedHtml}
</div></div>
</div>
</div>
</article>`;
  }
}

// ============================================================================
// Funciones auxiliares
// ============================================================================


function createPageDomId(pageNumber: number): string {
  return `page-preview-${pageNumber}`;
}

function slugifyPageTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizePreviewBlockHtml(html: string): string {
  const document = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, 'text/html');
  const body = (document as Document & { body?: HTMLElement | null }).body;
  if (!body || !('querySelectorAll' in body)) {
    return html;
  }
  for (const element of Array.from(body.querySelectorAll('script, iframe, object, embed'))) {
    const replacement = document.createElement('div');
    replacement.className = 'preview-embed-placeholder';
    // Para iframes de vídeo mostramos la URL: más útil que un texto genérico
    const src = (element.getAttribute('src') || '').trim();
    if (element.tagName.toLowerCase() === 'iframe' && src) {
      const ytMatch = src.match(/youtube(?:-nocookie)?\.com\/embed\/([^?&"]+)/i);
      const url = ytMatch ? `https://www.youtube.com/watch?v=${ytMatch[1]}` : src;
      replacement.textContent = `▶ Vídeo: ${url}`;
    } else {
      replacement.textContent = 'Contenido incrustado omitido en la vista previa.';
    }
    element.replaceWith(replacement);
  }

  for (const anchor of Array.from(body.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const href = (anchor.getAttribute('href') || '').trim();
    if (!href || href.startsWith('#') || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) {
      continue;
    }
    anchor.setAttribute('href', '#');
    anchor.removeAttribute('target');
  }

  return body.innerHTML || '<p></p>';
}
