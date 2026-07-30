import type { SemanticDocument } from '../models/SemanticDocument';
import { SemanticBuilder } from '../builders/SemanticBuilder';
import type { DocumentStructure } from '../../types';
import { escapeHtml, normalizeText } from '../utils/html';

// Re-exportar funciones de transformación HTML
export { applyDivClasses, applyTableClasses } from '../transformers/HtmlTransformer';

interface DocumentSection {
  level: number;
  text: string;
  html: string;
  /** Logos que el autor puso DENTRO del párrafo del encabezado (ver más abajo). */
  inlineHtml?: string;
  /** Texto del encabezado con sus hiperenlaces conservados (ver más abajo). */
  textHtml?: string;
}

/**
 * Logos incrustados en el párrafo de un encabezado.
 *
 * Es habitual en el material BUA: el autor pone un logo delante del texto del
 * título, en la misma línea. Mammoth lo entrega como `<h2><img/>Título</h2>`,
 * pero de un encabezado aquí solo se conservaba el texto (los títulos alimentan
 * el nombre de página del content.xml, el índice del PDF y titlePage/titleNode,
 * que tienen que seguir siendo texto plano) — así que el logo se DESCARTABA y no
 * llegaba ni al ELPX ni al PDF.
 *
 * Esta función lo rescata: devuelve el HTML de esas imágenes para que
 * SemanticBuilder las recoloque (delante del texto cuando el encabezado sigue
 * siendo HTML; al principio del contenido cuando el título se convierte en
 * nombre de página o de iDevice). Si la imagen era un hiperenlace, se conserva
 * el <a> envolvente para que siga siendo clicable.
 */
export function extractHeadingMedia(heading: HTMLElement): string {
  const images = Array.from(heading.querySelectorAll('img'));
  if (images.length === 0) return '';

  const parts: string[] = [];
  const emittedLinks = new Set<Element>();

  for (const image of images) {
    // El <a> solo se arrastra si envuelve la imagen y nada de texto: si también
    // envuelve el título, arrastrarlo duplicaría el texto del encabezado.
    const link = image.closest('a[href]');
    if (link && (link.textContent || '').trim().length === 0) {
      if (emittedLinks.has(link)) continue; // varias imágenes bajo el mismo enlace
      emittedLinks.add(link);
      parts.push(link.outerHTML);
      continue;
    }
    parts.push(image.outerHTML);
  }

  return parts.join('');
}

/**
 * Texto de un encabezado CON sus hiperenlaces conservados.
 *
 * Un título de Word puede ser además un enlace (todo el título, o solo unas
 * palabras). De un encabezado aquí solo se guardaba `textContent`, porque los
 * títulos alimentan el nombre de página y el de iDevice, que en el content.xml
 * son texto plano obligatoriamente — así que el `<a>` se DESCARTABA incluso
 * cuando el encabezado sí seguía siendo HTML en la salida (H2 en modo HTML, H3,
 * H4) y el título enlazado llegaba al curso y al PDF como texto muerto.
 *
 * Devuelve el contenido del encabezado con los `<a href>` intactos y el resto de
 * etiquetas disueltas: un título es texto y enlaces, nada más. Las imágenes se
 * omiten porque de ellas ya se encarga `extractHeadingMedia` (si no, el logo
 * saldría dos veces). Si el encabezado no lleva ningún enlace con texto devuelve
 * `''`, y quien lo use se queda con el camino de siempre (`escapeHtml(text)`):
 * los documentos sin títulos enlazados salen byte a byte como antes.
 */
export function extractHeadingTextHtml(heading: HTMLElement): string {
  const hasTextLink = Array.from(heading.querySelectorAll('a[href]')).some(
    (anchor) => (anchor.textContent || '').trim().length > 0,
  );
  if (!hasTextLink) return '';

  // Las únicas etiquetas de la cadena las escribimos aquí (y no llevan
  // espacios significativos), así que normalizar el conjunto es seguro y deja
  // el mismo espaciado que `normalizeText` da al texto plano del título.
  return normalizeText(
    Array.from(heading.childNodes)
      .map((node) => serializeHeadingNode(node))
      .join(''),
  );
}

/** Un nodo del encabezado: texto escapado, enlaces conservados, resto disuelto. */
function serializeHeadingNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent || '');
  }

  if (!(node instanceof HTMLElement)) {
    return '';
  }

  const tag = node.tagName.toLowerCase();
  if (tag === 'img') {
    return ''; // las imágenes del título viajan por extractHeadingMedia
  }

  const inner = Array.from(node.childNodes)
    .map((child) => serializeHeadingNode(child))
    .join('');

  if (tag !== 'a') {
    return inner; // negrita, cursiva, spans de Word…: se disuelven en su texto
  }

  const href = (node.getAttribute('href') || '').trim();
  // Enlace sin destino, o que solo envolvía la imagen (ya rescatada aparte):
  // queda el texto, si lo hubiera.
  if (!href || !inner.trim()) {
    return inner;
  }

  // Mismo criterio que la ruta sin estructura (normalizeImportedNode): los
  // enlaces externos se abren en pestaña nueva.
  const externalAttrs = /^https?:\/\//i.test(href)
    ? ' target="_blank" rel="noopener noreferrer"'
    : '';
  return `<a href="${escapeHtml(href)}"${externalAttrs}>${inner}</a>`;
}

/**
 * Construir proyecto SemanticDocument a partir de HTML de DOCX
 *
 * Responsabilidades:
 * 1. Parsear HTML en secciones (H1, H2, H3, contenido)
 * 2. Delegar construcción de páginas/bloques a SemanticBuilder
 * 3. Retornar SemanticDocument completo
 */
export function buildProjectFromStructure(
  htmlValue: string,
  filename: string,
  structure: DocumentStructure,
): SemanticDocument {
  const document = new DOMParser().parseFromString(
    `<!doctype html><html><body>${htmlValue}</body></html>`,
    'text/html',
  );
  const body = document.body;

  // Extraer todas las secciones (H1, H2, H3, contenido)
  const sections: DocumentSection[] = [];
  let currentHtml = '';

  for (const node of Array.from(body.childNodes)) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    const tag = node.tagName.toLowerCase();
    const match = /^h([1-6])$/.exec(tag);

    if (match) {
      const level = Number(match[1]);
      const text = normalizeText(node.textContent || '');

      // Encabezado vacío (restos de Word): se ignora, igual que en
      // parseDocumentStructure — así los índices posicionales coinciden.
      if (!text) continue;

      if (currentHtml.trim()) {
        sections.push({
          level: 999, // contenido (también el anterior al primer encabezado)
          text: '',
          html: currentHtml.trim(),
        });
      }

      sections.push({
        level,
        text,
        html: '',
        inlineHtml: extractHeadingMedia(node),
        textHtml: extractHeadingTextHtml(node),
      });

      currentHtml = '';
    } else {
      currentHtml += node.outerHTML;
    }
  }

  if (currentHtml.trim()) {
    sections.push({
      level: 999,
      text: '',
      html: currentHtml.trim(),
    });
  }

  // Delegar construcción de páginas a SemanticBuilder
  const builder = new SemanticBuilder(sections, structure);
  const pages = builder.buildPages(filename);

  // Retornar proyecto
  const stemmed = filename.replace(/\.[^.]+$/, '').trim() || 'Documento importado';
  return {
    title: stemmed,
    subtitle: '',
    pages,
  };
}
