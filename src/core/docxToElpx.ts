/// <reference types="vite/client" />

/**
 * Orquestador Principal - Convierte documentos DOCX a formato eXeLearning (ELPX)
 *
 * Arquitectura Modular (Phase 8):
 * ┌─────────────────────────────────────────────────────────────┐
 * │ convertDocxToElpx() - Entrada principal (DOCX File)         │
 * │   ↓ DocxParser                                              │
 * │ convertHtmlToElpx() - Parsea HTML a proyecto               │
 * │   ↓ HtmlTransformer + SemanticBuilder                      │
 * │ convertProjectToElpx() - Renderiza proyecto a ELPX         │
 * │   ↓ ElpxRenderer + ThemeService + PreviewService          │
 * │ ELPX Blob + Preview HTML                                   │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Flujo:
 * 1. convertDocxToElpx(): Recibe File DOCX, usa DocxParser, delega a convertHtmlToElpx()
 * 2. convertHtmlToElpx(): Transforma HTML, construye proyecto, delega a convertProjectToElpx()
 * 3. convertProjectToElpx(): Renderiza con ElpxRenderer, carga temas, genera preview
 *
 * Responsabilidades extraídas a módulos especializados:
 * - DocxParser: Parsear DOCX (Fase 1)
 * - HtmlTransformer: Transformar HTML (Fase 2)
 * - SemanticBuilder: Construir página/bloques (Fase 4)
 * - ElpxRenderer: Generar XML/ZIP (Fase 5)
 * - ThemeService: Cargar temas (Fase 6)
 * - PreviewService: Generar preview HTML (Fase 7)
 */

import { DocxParser } from './parsers/DocxParser';
import { ElpxRenderer } from './renderers/ElpxRenderer';
import { ThemeService } from './services/ThemeService';
import { buildProjectFromStructure, applyTableClasses, applyDivClasses } from './buildFromStructure';
// Nota: mammoth se usa indirectamente a través de DocxParser
import type {
  DocxImportProgress,
  ImportToElpxResult,
  DocxImportOptions,
  ImportedProject,
  ImportedPage,
  ImportedBlock,
} from '../types';

/**
 * Convertir archivo DOCX a ELPX (eXeLearning)
 *
 * Flujo:
 * 1. Parsea el archivo DOCX con DocxParser
 * 2. Carga tema personalizado si es necesario (ThemeService)
 * 3. Delega a convertHtmlToElpx() para procesar el HTML
 *
 * @param file - Archivo DOCX a convertir
 * @param options - Opciones de importación (heading modes, tema)
 * @param structure - Estructura optativa (H1 sections para parsing semántico)
 * @param onProgress - Callback para reportar progreso
 * @returns Promise<ImportToElpxResult> con blob ELPX y preview HTML
 *
 * @example
 * ```typescript
 * const result = await convertDocxToElpx(
 *   docxFile,
 *   { heading1Mode: 'page', heading2Mode: 'block', themeId: 'base' },
 *   structure,
 *   (progress) => console.log(progress.message)
 * );
 * downloadFile(result.blob, result.filename);
 * ```
 */
export async function convertDocxToElpx(
  file: File,
  options: DocxImportOptions,
  structure?: any,
  onProgress?: (progress: DocxImportProgress) => void,
): Promise<ImportToElpxResult> {
  onProgress?.({
    phase: 'read',
    message: 'Leyendo el archivo .docx...',
    messageKey: 'progress.readDocx',
  });

  onProgress?.({
    phase: 'parse',
    message: 'Analizando estilos y contenido del DOCX...',
    messageKey: 'progress.parseDocxStyles',
  });
  const parser = new DocxParser();
  const parseResult = await parser.parse(file);
  const htmlValue = parseResult.html;

  let themeEntries: Record<string, Uint8Array> | undefined;
  if (options.themeId && options.themeId !== 'base') {
    onProgress?.({
      phase: 'template',
      message: 'Cargando tema personalizado...',
      messageKey: 'progress.loadTheme',
    });
    themeEntries = await ThemeService.loadTheme(options.themeId);
  }

  return convertHtmlToElpx(
    htmlValue,
    file.name,
    options,
    onProgress,
    'progress.parseDocumentStructure',
    themeEntries,
    structure,
  );
}

/**
 * Convertir HTML a ELPX (entrada alternativa para testing/APIs)
 *
 * Flujo:
 * 1. Transforma HTML (aplica divs, tablas)
 * 2. Construye ImportedProject desde HTML
 * 3. Delega a convertProjectToElpx() para renderizar
 *
 * Usar cuando:
 * - Tienes HTML preprocessado o manual
 * - Quieres testing sin archivos DOCX
 * - Necesitas control fino sobre el HTML de entrada
 *
 * @param htmlValue - HTML a procesar
 * @param filename - Nombre del archivo (para resultado)
 * @param options - Opciones de importación
 * @param onProgress - Callback de progreso
 * @param parseMessageKey - Clave de mensaje para progress
 * @param themeEntries - Entries de tema precargado (opcional)
 * @param structure - Estructura H1/H2 (opcional)
 * @returns Promise<ImportToElpxResult>
 */
export async function convertHtmlToElpx(
  htmlValue: string,
  filename: string,
  options: DocxImportOptions,
  onProgress?: (progress: DocxImportProgress) => void,
  parseMessageKey = 'progress.parseDocumentStructure',
  themeEntries?: Record<string, Uint8Array>,
  structure?: any,
): Promise<ImportToElpxResult> {
  onProgress?.({
    phase: 'parse',
    message: 'Interpretando la estructura del documento...',
    messageKey: parseMessageKey,
  });

  // Procesar delimitadores y tablas, aplicar clases CSS
  let processedHtml = applyDivClasses(htmlValue);
  processedHtml = applyTableClasses(processedHtml);

  const project = buildProjectFromHtml(processedHtml, filename, options, structure);

  return convertProjectToElpx(project, filename, themeEntries, onProgress, options.themeId);
}

/**
 * Convertir ImportedProject a ELPX (API de bajo nivel)
 *
 * Flujo:
 * 1. Carga plantilla base (ThemeService)
 * 2. Carga tema personalizado si aplica
 * 3. Renderiza XML/ZIP con ElpxRenderer
 * 4. Genera preview HTML con PreviewService
 *
 * Usar cuando:
 * - Tienes un ImportedProject preconstruido
 * - Necesitas máximo control sobre la renderización
 * - Quieres reutilizar un proyecto múltiples veces
 *
 * @param project - Proyecto a renderizar
 * @param filename - Nombre para el resultado ELPX
 * @param extraEntries - Entries adicionales (temas precargados)
 * @param onProgress - Callback de progreso
 * @param themeId - ID del tema a usar
 * @returns Promise<ImportToElpxResult>
 *
 * @example
 * ```typescript
 * const project: ImportedProject = {
 *   title: 'Mi Proyecto',
 *   subtitle: '',
 *   pages: [...]
 * };
 * const result = await convertProjectToElpx(project, 'resultado.elpx');
 * ```
 */
export async function convertProjectToElpx(
  project: ImportedProject,
  filename: string,
  extraEntries?: Record<string, Uint8Array>,
  onProgress?: (progress: DocxImportProgress) => void,
  themeId?: string,
): Promise<ImportToElpxResult> {
  onProgress?.({
    phase: 'template',
    message: 'Aplicando la plantilla base de eXeLearning...',
    messageKey: 'progress.applyTemplate',
  });

  const template = await ThemeService.loadTemplate();

  if (extraEntries) {
    for (const [entryPath, entryData] of Object.entries(extraEntries)) {
      template.entries[entryPath] = entryData;
    }
  }

  // Delegar renderización a ElpxRenderer
  const renderer = new ElpxRenderer(template, project);
  const rendered = renderer.render({ themeId });

  const previewHtml = rendered.previewPages['index.html']
    ? rendered.previewPages['index.html']
    : '<!doctype html><html lang="es"><body><p>Sin contenido para previsualizar.</p></body></html>';

  onProgress?.({
    phase: 'pack',
    message: 'Generando el archivo .elpx...',
    messageKey: 'progress.packElpx',
  });

  const blob = new Blob([new Uint8Array(rendered.blobData)], { type: 'application/zip' });

  return {
    blob,
    filename: toElpxFilename(filename),
    pageCount: rendered.pageCount,
    blockCount: rendered.blockCount,
    previewHtml,
    previewPages: rendered.previewPages,
  };
}

/**
 * Construir ImportedProject desde HTML (Legacy Fallback)
 *
 * Responsabilidad: Parsear HTML usando la lógica antigua de H1/H2/H3.
 *
 * Flujo:
 * 1. Si hay estructura (structure.h1Sections), delega a buildProjectFromStructure() (SemanticBuilder)
 * 2. Si no, usa state machine antigua: parse H1/H2/H3 según heading modes
 *
 * **Nota**: Esta función es un fallback compatibilidad hacia atrás.
 * Para nuevos desarrollos, usar buildProjectFromStructure con estructura definida.
 *
 * @param htmlValue - HTML a parsear
 * @param filename - Nombre del documento
 * @param options - Heading modes y opciones
 * @param structure - Estructura H1/H2 (opcional)
 * @returns ImportedProject
 */
function buildProjectFromHtml(
  htmlValue: string,
  filename: string,
  options: DocxImportOptions,
  structure?: any,
): ImportedProject {
  const document = new DOMParser().parseFromString(
    `<!doctype html><html><body>${htmlValue}</body></html>`,
    'text/html',
  );
  const body = document.body;
  const pages: ImportedPage[] = [];

  // Si hay estructura configurada, usarla
  if (structure && structure.h1Sections && structure.h1Sections.length > 0) {
    return buildProjectFromStructure(htmlValue, filename, structure) as ImportedProject;
  }

  // Si no hay estructura, usar la lógica antigua
  let resourceTitleAssigned = false;
  let currentPage: ImportedPage | null = null;
  let currentBlock: ImportedBlock | null = null;
  let currentTopLevelPage: ImportedPage | null = null;
  let currentSecondLevelPage: ImportedPage | null = null;
  let currentThirdLevelPage: ImportedPage | null = null;

  for (const node of Array.from(body.childNodes)) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    const tag = node.tagName.toLowerCase();
    const cleanedHtml = sanitizeImportedHtml(node.outerHTML);
    const trimmed = normalizeWhitespace(node.textContent || '');

    if (!trimmed && !hasMeaningfulHtml(cleanedHtml)) {
      continue;
    }

    const headingMatch = /^h([1-6])$/.exec(tag);
    if (headingMatch) {
      const rawLevel = Number(headingMatch[1]);
      const useResourceTitle = options.heading1Mode === 'resource';

      if (useResourceTitle && rawLevel === 1 && !resourceTitleAssigned) {
        resourceTitleAssigned = true;
        continue;
      }

      const effectiveLevel = useResourceTitle && rawLevel > 1 ? rawLevel - 1 : rawLevel;
      if (effectiveLevel < 1 || effectiveLevel > 4) {
        currentPage = ensurePage(pages, currentPage);
        currentBlock = ensureBlock(currentPage, currentBlock);
        currentBlock.html = appendParagraphHtml(currentBlock.html, cleanedHtml);
        continue;
      }

      if (effectiveLevel === 1) {
        currentPage = createPage(pages, trimmed, 1, null);
        currentTopLevelPage = currentPage;
        currentSecondLevelPage = null;
        currentThirdLevelPage = null;
        currentBlock = null;
        continue;
      }

      if (effectiveLevel === 2) {
        if (options.heading2Mode === 'page') {
          const parentPage = currentTopLevelPage ?? ensurePage(pages, currentPage);
          currentPage = createPage(pages, trimmed, 2, pages.indexOf(parentPage));
          currentSecondLevelPage = currentPage;
          currentThirdLevelPage = null;
          currentBlock = null;
          continue;
        }

        currentPage = ensurePage(pages, currentPage);
        currentBlock = { title: trimmed, html: '' };
        currentPage.blocks.push(currentBlock);
        continue;
      }

      if (effectiveLevel === 3) {
        if (options.heading2Mode !== 'page') {
          currentPage = ensurePage(pages, currentPage);
          currentBlock = ensureBlock(currentPage, currentBlock);
          currentBlock.html = appendParagraphHtml(currentBlock.html, cleanedHtml);
          continue;
        }

        if (options.heading3Mode === 'page') {
          const parentPage = currentSecondLevelPage ?? currentTopLevelPage ?? ensurePage(pages, currentPage);
          currentPage = createPage(pages, trimmed, 3, pages.indexOf(parentPage));
          currentThirdLevelPage = currentPage;
          currentBlock = null;
          continue;
        }

        currentPage = ensurePage(pages, currentPage);
        currentBlock = { title: trimmed, html: '' };
        currentPage.blocks.push(currentBlock);
        continue;
      }

      if (options.heading2Mode !== 'page' || options.heading3Mode !== 'page') {
        currentPage = ensurePage(pages, currentPage);
        currentBlock = ensureBlock(currentPage, currentBlock);
        currentBlock.html = appendParagraphHtml(currentBlock.html, cleanedHtml);
        continue;
      }

      if (options.heading4Mode === 'page') {
        const parentPage =
          currentThirdLevelPage ?? currentSecondLevelPage ?? currentTopLevelPage ?? ensurePage(pages, currentPage);
        currentPage = createPage(pages, trimmed, 4, pages.indexOf(parentPage));
        currentBlock = null;
        continue;
      }

      currentPage = ensurePage(pages, currentPage);
      currentBlock = { title: trimmed, html: '' };
      currentPage.blocks.push(currentBlock);
      continue;
    }

    currentPage = ensurePage(pages, currentPage);
    currentBlock = ensureBlock(currentPage, currentBlock);
    currentBlock.html = appendParagraphHtml(currentBlock.html, cleanedHtml);
  }

  if (pages.length === 0) {
    pages.push({
      title: stemFromFilename(filename) || 'Página 1',
      level: 1,
      parentIndex: null,
      blocks: [{ title: 'Contenido', html: '<p>Documento importado sin encabezados detectados.</p>' }],
    });
  }

  for (const page of pages) {
    if (page.blocks.length === 0) {
      page.blocks.push({ title: 'Contenido', html: '<p></p>' });
      continue;
    }

    for (const block of page.blocks) {
      if (!block.html) {
        block.html = '<p></p>';
      }
    }
  }

  return {
    title: stemFromFilename(filename) || 'Documento importado',
    subtitle: '',
    pages,
  };
}

function ensurePage(pages: ImportedPage[], currentPage: ImportedPage | null): ImportedPage {
  if (currentPage) {
    return currentPage;
  }

  return createPage(pages, `Página ${pages.length + 1}`, 1, null);
}

function createPage(
  pages: ImportedPage[],
  title: string,
  level: 1 | 2 | 3 | 4,
  parentIndex: number | null,
): ImportedPage {
  const page: ImportedPage = { title, level, parentIndex, blocks: [] };
  pages.push(page);
  return page;
}

function ensureBlock(page: ImportedPage, currentBlock: ImportedBlock | null): ImportedBlock {
  if (currentBlock) {
    return currentBlock;
  }

  const block: ImportedBlock = { title: 'Contenido', html: '' };
  page.blocks.push(block);
  return block;
}

function appendParagraphHtml(existing: string, paragraphHtml: string): string {
  return existing ? `${existing}\n${paragraphHtml}` : paragraphHtml;
}

function sanitizeImportedHtml(html: string): string {
  const document = new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, 'text/html');
  return Array.from(document.body.childNodes)
    .map((node) => normalizeImportedNode(node))
    .join('')
    .trim();
}

function normalizeImportedNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent || '');
  }

  if (!(node instanceof HTMLElement)) {
    return '';
  }

  const tag = node.tagName.toLowerCase();
  const normalizedChildren = Array.from(node.childNodes)
    .map((child) => normalizeImportedNode(child))
    .join('');

  switch (tag) {
    case 'div':
    case 'span':
      return normalizedChildren;
    case 'b':
      return wrapTag('strong', normalizedChildren);
    case 'i':
      return wrapTag('em', normalizedChildren);
    case 'strike':
      return wrapTag('del', normalizedChildren);
    case 'p':
    case 'ul':
    case 'ol':
    case 'li':
    case 'table':
    case 'thead':
    case 'tbody':
    case 'tr':
    case 'th':
    case 'td':
    case 'strong':
    case 'em':
    case 'u':
    case 'sup':
    case 'sub':
    case 'blockquote':
    case 'pre':
    case 'code':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return wrapTag(tag, normalizedChildren);
    case 'br':
      return '<br />';
    case 'a': {
      const href = (node.getAttribute('href') || '').trim();
      if (!href) {
        return normalizedChildren;
      }
      return `<a href="${escapeHtml(href)}">${normalizedChildren}</a>`;
    }
    case 'img': {
      const src = (node.getAttribute('src') || '').trim();
      if (!src) {
        return '';
      }
      const alt = (node.getAttribute('alt') || '').trim();
      const altAttribute = alt ? ` alt="${escapeHtml(alt)}"` : '';
      return `<img src="${escapeHtml(src)}"${altAttribute} />`;
    }
    default:
      return normalizedChildren;
  }
}

function wrapTag(tag: string, innerHtml: string): string {
  if (!innerHtml && tag !== 'p' && tag !== 'td' && tag !== 'th') {
    return '';
  }

  return `<${tag}>${innerHtml}</${tag}>`;
}

function hasMeaningfulHtml(html: string): boolean {
  if (!html) {
    return false;
  }

  const text = normalizeWhitespace(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<img\b[^>]*>/gi, ' [img] ')
      .replace(/<table\b[\s\S]*?<\/table>/gi, ' [table] ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' '),
  );

  return text.length > 0;
}


function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stemFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').trim();
}

function toElpxFilename(inputFilename: string): string {
  const stem = stemFromFilename(inputFilename) || 'proyecto';
  return `${stem}.elpx`;
}

