/// <reference types="vite/client" />

import { escapeHtml } from './utils/html';

/**
 * Pipeline Semántica - Convierte DOCX/HTML a SemanticDocument (SemanticDocument)
 *
 * RESPONSABILIDAD ÚNICA:
 * Extraer la semántica pura del documento (páginas, bloques, contenido)
 * SIN ningún rendering específico de formato (ELPX, PDF, etc.)
 *
 * Flujo:
 * 1. convertDocxToSemanticDocument(): DOCX File → SemanticDocument
 * 2. convertHtmlToSemanticDocument(): HTML → SemanticDocument
 *
 * El resultado es un SemanticDocument que representa la semántica
 * del documento de forma agnóstica al formato de salida.
 */

import { DocxParser } from './parsers/DocxParser';
import { buildProjectFromStructure } from './buildFromStructure';
import { applyAllTransforms } from './transformers/HtmlTransformer';
import type {
  DocxImportProgress,
  DocxImportOptions,
  SemanticDocument,
  SemanticPage,
  SemanticBlock,
  DocumentStructure,
} from '../types';

/**
 * Convertir archivo DOCX a SemanticDocument (SemanticDocument)
 *
 * Extrae la semántica pura del documento DOCX sin rendering.
 *
 * Flujo:
 * 1. Parsea el archivo DOCX con DocxParser
 * 2. Delega a convertHtmlToSemanticDocument() para procesar el HTML
 *
 * @param file - Archivo DOCX a convertir
 * @param options - Opciones de importación (heading modes)
 * @param structure - Estructura H1/H2 para parsing semántico (opcional)
 * @param onProgress - Callback para reportar progreso
 * @returns Promise<SemanticDocument> con la semántica del documento
 *
 * @example
 * ```typescript
 * const semanticDoc = await convertDocxToSemanticDocument(
 *   docxFile,
 *   { heading1Mode: 'page', heading2Mode: 'block' },
 *   structure,
 *   (progress) => console.log(progress.message)
 * );
 * // Ahora puede convertirse a ELPX, PDF, o cualquier formato
 * ```
 */
export async function convertDocxToSemanticDocument(
  file: File,
  options: DocxImportOptions,
  structure?: DocumentStructure,
  onProgress?: (progress: DocxImportProgress) => void,
  precomputedHtml?: string,
): Promise<SemanticDocument> {
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

  let htmlValue: string;
  if (precomputedHtml !== undefined) {
    htmlValue = precomputedHtml;
  } else {
    const parser = new DocxParser();
    const parseResult = await parser.parse(file);
    htmlValue = parseResult.html;
  }

  return convertHtmlToSemanticDocument(
    htmlValue,
    file.name,
    options,
    onProgress,
    'progress.parseDocumentStructure',
    structure,
  );
}

/**
 * Convertir HTML a SemanticDocument (SemanticDocument)
 *
 * Extrae la semántica pura del HTML sin rendering.
 *
 * Flujo:
 * 1. Transforma HTML (aplica divs, tablas)
 * 2. Construye SemanticDocument desde HTML
 *
 * Usar cuando:
 * - Tienes HTML preprocessado o manual
 * - Quieres testing sin archivos DOCX
 * - Necesitas control fino sobre el HTML de entrada
 *
 * @param htmlValue - HTML a procesar
 * @param filename - Nombre del documento
 * @param options - Opciones de importación
 * @param onProgress - Callback de progreso
 * @param parseMessageKey - Clave de mensaje para progress
 * @param structure - Estructura H1/H2 (opcional)
 * @returns Promise<SemanticDocument>
 */
export async function convertHtmlToSemanticDocument(
  htmlValue: string,
  filename: string,
  options: DocxImportOptions,
  onProgress?: (progress: DocxImportProgress) => void,
  parseMessageKey = 'progress.parseDocumentStructure',
  structure?: DocumentStructure,
): Promise<SemanticDocument> {
  onProgress?.({
    phase: 'parse',
    message: 'Interpretando la estructura del documento...',
    messageKey: parseMessageKey,
  });

  // Procesar iframes, delimitadores y tablas, aplicar clases CSS
  const processedHtml = applyAllTransforms(htmlValue);

  const project = buildProjectFromHtml(processedHtml, filename, options, structure);

  return project;
}

/**
 * Construir SemanticDocument desde HTML (Núcleo Semántico)
 *
 * Responsabilidad: Parsear HTML y extraer la estructura semántica.
 *
 * Flujo:
 * 1. Si hay estructura (structure.h1Sections), delega a buildProjectFromStructure() (SemanticBuilder)
 * 2. Si no, usa state machine: parse H1/H2/H3/H4 según heading modes
 *
 * El resultado es agnóstico al formato de salida (ELPX, PDF, etc.)
 *
 * @param htmlValue - HTML a parsear
 * @param filename - Nombre del documento
 * @param options - Heading modes y opciones
 * @param structure - Estructura H1/H2 (opcional)
 * @returns SemanticDocument con la semántica extraída
 */
function buildProjectFromHtml(
  htmlValue: string,
  filename: string,
  options: DocxImportOptions,
  structure?: DocumentStructure,
): SemanticDocument {
  const document = new DOMParser().parseFromString(
    `<!doctype html><html><body>${htmlValue}</body></html>`,
    'text/html',
  );
  const body = document.body;
  const pages: SemanticPage[] = [];

  // Si hay estructura configurada, usarla
  if (structure && structure.h1Sections && structure.h1Sections.length > 0) {
    return buildProjectFromStructure(htmlValue, filename, structure) as SemanticDocument;
  }

  // Si no hay estructura, usar la lógica antigua
  let resourceTitleAssigned = false;
  let currentPage: SemanticPage | null = null;
  let currentBlock: SemanticBlock | null = null;
  let currentTopLevelPage: SemanticPage | null = null;
  let currentSecondLevelPage: SemanticPage | null = null;
  let currentThirdLevelPage: SemanticPage | null = null;

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

// ============================================================================
// Funciones Auxiliares (Solo para Extracción Semántica)
// ============================================================================

function ensurePage(pages: SemanticPage[], currentPage: SemanticPage | null): SemanticPage {
  if (currentPage) {
    return currentPage;
  }

  return createPage(pages, `Página ${pages.length + 1}`, 1, null);
}

function createPage(
  pages: SemanticPage[],
  title: string,
  level: 1 | 2 | 3 | 4,
  parentIndex: number | null,
): SemanticPage {
  const page: SemanticPage = { title, level, parentIndex, blocks: [] };
  pages.push(page);
  return page;
}

function ensureBlock(page: SemanticPage, currentBlock: SemanticBlock | null): SemanticBlock {
  if (currentBlock) {
    return currentBlock;
  }

  const block: SemanticBlock = { title: 'Contenido', html: '' };
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
    case 'iframe': {
      // Vídeos embebidos (YouTube). Se centra con display:block + margin auto
      // para no depender del contenedor (eXeLearning puede descartar el wrapper).
      const src = (node.getAttribute('src') || '').trim();
      if (!src) {
        return '';
      }
      const width = (node.getAttribute('width') || '560').trim();
      const height = (node.getAttribute('height') || '315').trim();
      const title = (node.getAttribute('title') || '').trim();
      const titleAttribute = title ? ` title="${escapeHtml(title)}"` : '';
      return `<iframe src="${escapeHtml(src)}" width="${escapeHtml(width)}" height="${escapeHtml(height)}"${titleAttribute} frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="display: block; margin: 1em auto; max-width: 100%;"></iframe>`;
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


function stemFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').trim();
}
