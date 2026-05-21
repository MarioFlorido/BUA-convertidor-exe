import { zipSync } from 'fflate';
import type { ImportedProject, ImportedPage, ImportedBlock } from '../models/SemanticDocument';

export interface ElpxRenderOptions {
  themeId?: string;
}

export interface RenderedElpx {
  blobData: Uint8Array;
  previewPages: Record<string, string>;
  pageCount: number;
  blockCount: number;
}

/**
 * Renderizador ELPX - Genera XML/ZIP de eXeLearning a partir de ImportedProject
 *
 * Responsabilidades:
 * - Generar content.xml (estructura de navegación y bloques)
 * - Generar páginas de preview HTML
 * - Empaquetar todo en ZIP (ELPX)
 */
export class ElpxRenderer {
  constructor(
    private template: { entries: Record<string, Uint8Array> },
    private project: ImportedProject,
  ) {}

  /**
   * Renderizar proyecto completo como ELPX
   */
  render(options: ElpxRenderOptions): RenderedElpx {
    const { entries } = this.template;
    const effectiveThemeId = options.themeId && options.themeId !== 'base' ? options.themeId : 'base';

    // Generar content.xml
    entries['content.xml'] = new TextEncoder().encode(this.generateContentXml(effectiveThemeId));

    // Generar páginas de preview
    const previewPages = this.buildStandalonePreviewPages();
    this.addPreviewHtmlEntries(entries, previewPages);

    // Empaquetar como ZIP
    const blobData = zipSync(entries, { level: 0 });

    return {
      blobData,
      previewPages,
      pageCount: this.project.pages.length,
      blockCount: this.project.pages.reduce((count, page) => count + page.blocks.length, 0),
    };
  }

  /**
   * Generar XML de contenido (content.xml)
   */
  private generateContentXml(themeId: string = 'base'): string {
    const odeId = createResourceId();
    const odeVersionId = createResourceId();
    const modified = String(Date.now());
    const pageIds = this.project.pages.map(() => createPageId());
    const navStructuresXml = this.project.pages
      .map((page, index) => this.generateOdeNavStructureXml(page, index, pageIds))
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<userPreferences>
  <userPreference>
    <key>theme</key>
    <value>${escapeXml(themeId)}</value>
  </userPreference>
</userPreferences>
<odeResources>
  <odeResource><key>odeId</key><value>${escapeXml(odeId)}</value></odeResource>
  <odeResource><key>odeVersionId</key><value>${escapeXml(odeVersionId)}</value></odeResource>
  <odeResource><key>exe_version</key><value>3.0</value></odeResource>
</odeResources>
<odeProperties>
  <odeProperty><key>pp_title</key><value>${escapeXml(this.project.title || 'Documento importado')}</value></odeProperty>
  <odeProperty><key>pp_subtitle</key><value>${escapeXml(this.project.subtitle || '')}</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>es</value></odeProperty>
  <odeProperty><key>pp_license</key><value>creative commons: attribution - share alike 4.0</value></odeProperty>
  <odeProperty><key>pp_licenseUrl</key><value>https://creativecommons.org/licenses/by-sa/4.0/</value></odeProperty>
  <odeProperty><key>pp_theme</key><value>${escapeXml(themeId)}</value></odeProperty>
  <odeProperty><key>pp_exelearning_version</key><value>v4.0.0-rc3</value></odeProperty>
  <odeProperty><key>pp_modified</key><value>${escapeXml(modified)}</value></odeProperty>
  <odeProperty><key>pp_addExeLink</key><value>false</value></odeProperty>
  <odeProperty><key>pp_addPagination</key><value>false</value></odeProperty>
  <odeProperty><key>pp_addSearchBox</key><value>false</value></odeProperty>
  <odeProperty><key>pp_addAccessibilityToolbar</key><value>false</value></odeProperty>
  <odeProperty><key>pp_addMathJax</key><value>false</value></odeProperty>
  <odeProperty><key>exportSource</key><value>true</value></odeProperty>
  <odeProperty><key>pp_globalFont</key><value>default</value></odeProperty>
</odeProperties>
<odeNavStructures>
${navStructuresXml}</odeNavStructures>
</ode>`;
  }

  /**
   * Generar estructura de navegación (página) en XML
   */
  private generateOdeNavStructureXml(page: ImportedPage, order: number, pageIds: string[]): string {
    const pageId = pageIds[order];
    const parentPageId = page.parentIndex === null ? '' : pageIds[page.parentIndex] || '';
    const title = page.title || `Página ${order + 1}`;
    const blocksXml = page.blocks
      .map((block, index) => this.generateOdePagStructureXml(block, pageId, index))
      .join('');

    return `<odeNavStructure>
  <odePageId>${escapeXml(pageId)}</odePageId>
  <odeParentPageId>${escapeXml(parentPageId)}</odeParentPageId>
  <pageName>${escapeXml(title)}</pageName>
  <odeNavStructureOrder>${order}</odeNavStructureOrder>
  <odeNavStructureProperties>
${this.generateNavStructurePropertyEntry('titlePage', title)}${this.generateNavStructurePropertyEntry('titleNode', title)}${this.generateNavStructurePropertyEntry('hidePageTitle', 'false')}${this.generateNavStructurePropertyEntry('titleHtml', '')}${this.generateNavStructurePropertyEntry('editableInPage', 'false')}${this.generateNavStructurePropertyEntry('visibility', 'true')}${this.generateNavStructurePropertyEntry('highlight', 'false')}${this.generateNavStructurePropertyEntry('description', '')}  </odeNavStructureProperties>
  <odePagStructures>
${blocksXml}  </odePagStructures>
</odeNavStructure>
`;
  }

  /**
   * Generar entrada de propiedad de navegación
   */
  private generateNavStructurePropertyEntry(key: string, value: string): string {
    return `    <odeNavStructureProperty>
      <key>${escapeXml(key)}</key>
      <value>${escapeXml(value)}</value>
    </odeNavStructureProperty>
`;
  }

  /**
   * Generar estructura de bloque (iDevice) en XML
   */
  private generateOdePagStructureXml(block: ImportedBlock, pageId: string, order: number): string {
    const blockId = createBlockId();
    const ideviceId = createIdeviceId();
    const blockName = block.title;
    const html = block.html || '<p></p>';
    const wrappedHtml = `<div class="exe-text-template">\n${html}\n</div>`;
    const jsonProperties = JSON.stringify({
      ideviceId,
      textInfoDurationInput: '',
      textInfoDurationTextInput: 'Duración',
      textInfoParticipantsInput: '',
      textInfoParticipantsTextInput: 'Agrupamiento',
      textTextarea: html,
      textFeedbackInput: 'Mostrar retroalimentación',
      textFeedbackTextarea: '',
    });

    return `    <odePagStructure>
      <odePageId>${escapeXml(pageId)}</odePageId>
      <odeBlockId>${escapeXml(blockId)}</odeBlockId>
      <blockName>${escapeXml(blockName)}</blockName>
      <iconName></iconName>
      <odePagStructureOrder>${order}</odePagStructureOrder>
      <odePagStructureProperties>
${this.generatePagStructurePropertyEntry('visibility', 'true')}${this.generatePagStructurePropertyEntry('teacherOnly', 'false')}${this.generatePagStructurePropertyEntry('allowToggle', 'true')}${this.generatePagStructurePropertyEntry('minimized', 'false')}${this.generatePagStructurePropertyEntry('cssClass', '')}      </odePagStructureProperties>
      <odeComponents>
        <odeComponent>
          <odePageId>${escapeXml(pageId)}</odePageId>
          <odeBlockId>${escapeXml(blockId)}</odeBlockId>
          <odeIdeviceId>${escapeXml(ideviceId)}</odeIdeviceId>
          <odeIdeviceTypeName>text</odeIdeviceTypeName>
          <htmlView><![CDATA[${escapeCdata(wrappedHtml)}]]></htmlView>
          <jsonProperties><![CDATA[${escapeCdata(jsonProperties)}]]></jsonProperties>
          <odeComponentsOrder>0</odeComponentsOrder>
          <odeComponentsProperties>
          </odeComponentsProperties>
        </odeComponent>
      </odeComponents>
    </odePagStructure>
`;
  }

  /**
   * Generar entrada de propiedad de bloque
   */
  private generatePagStructurePropertyEntry(key: string, value: string): string {
    return `        <odePagStructureProperty>
          <key>${escapeXml(key)}</key>
          <value>${escapeXml(value)}</value>
        </odePagStructureProperty>
`;
  }

  /**
   * Construir páginas de preview HTML
   */
  private buildStandalonePreviewPages(): Record<string, string> {
    const pages = this.getPreviewPages();
    const output: Record<string, string> = {};

    for (const [index, pageInfo] of pages.entries()) {
      const html = this.generatePreviewPageHtml(pages, index);
      output[pageInfo.href] = html;
    }

    return output;
  }

  /**
   * Obtener información de páginas para preview
   */
  private getPreviewPages(): Array<{
    title: string;
    href: string;
    pageNumber: number;
    level: 1 | 2 | 3 | 4;
    parentIndex: number | null;
  }> {
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
   * Generar HTML de página de preview
   */
  private generatePreviewPageHtml(
    pages: Array<{ title: string; href: string; pageNumber: number; level: 1 | 2 | 3 | 4; parentIndex: number | null }>,
    activeIndex: number,
  ): string {
    const activePageInfo = pages[activeIndex];
    const activePage = this.project.pages[activeIndex];
    const assetPrefix = activeIndex === 0 ? '' : '../';
    const prevPage = activeIndex > 0 ? pages[activeIndex - 1] : null;
    const nextPage = activeIndex < pages.length - 1 ? pages[activeIndex + 1] : null;
    const navItems = this.generatePreviewNavHtml(pages, activePageInfo.pageNumber, activeIndex);
    const blocks = activePage.blocks
      .map((block, blockIndex) => this.generatePreviewBlockHtml(block, activePageInfo.pageNumber, blockIndex))
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
   * Generar navegación HTML para preview
   */
  private generatePreviewNavHtml(
    pages: Array<{ title: string; href: string; pageNumber: number; level: 1 | 2 | 3 | 4; parentIndex: number | null }>,
    activePageNumber: number,
    activeIndex: number,
  ): string {
    const buildHref = (pageInfo: (typeof pages)[number]): string => {
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
   * Generar bloque HTML para preview
   */
  private generatePreviewBlockHtml(block: ImportedBlock, pageNumber: number, blockIndex: number): string {
    const blockId = `block-preview-${pageNumber}-${blockIndex + 1}`;
    const ideviceId = `idevice-preview-${pageNumber}-${blockIndex + 1}`;
    const sanitizedHtml = sanitizePreviewBlockHtml(block.html || '<p></p>');

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

  /**
   * Agregar entradas HTML de preview al ZIP
   */
  private addPreviewHtmlEntries(entries: Record<string, Uint8Array>, previewPages: Record<string, string>): void {
    // Eliminar páginas HTML antiguas
    for (const existingPath of Object.keys(entries)) {
      if (existingPath.startsWith('html/') && existingPath.endsWith('.html')) {
        delete entries[existingPath];
      }
    }

    // Agregar nuevas páginas de preview
    for (const [href, html] of Object.entries(previewPages)) {
      entries[href] = new TextEncoder().encode(html);
    }
  }
}

// ============================================================================
// Funciones auxiliares
// ============================================================================

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(value: string): string {
  return escapeHtml(value);
}

function escapeCdata(value: string): string {
  return value.replaceAll(']]>', ']]]]><![CDATA[>');
}

function createPageId(): string {
  return crypto.randomUUID();
}

function createBlockId(): string {
  return `block-${Date.now()}-${randomSuffix()}`;
}

function createIdeviceId(): string {
  return `idevice-${Date.now()}-${randomSuffix()}`;
}

function createResourceId(): string {
  return `${timestampStamp()}${randomUppercase(6)}`;
}

function timestampStamp(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
}

function randomSuffix(length = 9): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += chars[Math.floor(Math.random() * chars.length)];
  }
  return output;
}

function randomUppercase(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += chars[Math.floor(Math.random() * chars.length)];
  }
  return output;
}

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
    replacement.textContent = 'Contenido incrustado omitido en la vista previa.';
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
