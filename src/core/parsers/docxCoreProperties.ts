/**
 * Propiedades del documento de un DOCX (Archivo → Información → Propiedades).
 *
 * Por qué hace falta: el título de un documento sale del nombre del fichero, y
 * un nombre de fichero no admite ni dos puntos ni más de 255 caracteres. Las
 * propiedades del documento viven en `docProps/core.xml`, no tienen ninguna de
 * esas restricciones y viajan dentro del .docx aunque alguien lo renombre.
 * Mammoth solo convierte `word/document.xml`, así que hay que leerlas aparte.
 *
 * Se lee «Comentarios» (`dc:description`) y no «Título» (`dc:title`) para
 * sustituir al nombre del fichero: Word rellena Título solo, lo hereda de la
 * plantilla y lo arrastra en cada «Guardar como», así que un documento copiado
 * de otro trae con frecuencia un título ajeno sin que el autor lo sepa.
 * Comentarios nunca se rellena solo: si tiene algo, alguien lo ha escrito.
 */

import { unzipSync, strFromU8 } from 'fflate';

export interface DocxCoreProperties {
  /** «Título» (`dc:title`). Se lee, pero no sustituye al nombre del fichero. */
  title?: string;
  /** «Autor» (`dc:creator`). */
  author?: string;
  /** «Comentarios» (`dc:description`). */
  description?: string;
}

/**
 * Lee las propiedades del documento de `docProps/core.xml`. Las que estén
 * vacías o no existan no aparecen en el resultado. Un ZIP ilegible o sin
 * `core.xml` devuelve un objeto vacío: se renuncia al dato, no se rompe nada.
 */
export function readDocxCoreProperties(buffer: ArrayBuffer): DocxCoreProperties {
  let xml: string;
  try {
    const unzipped = unzipSync(new Uint8Array(buffer), {
      filter: (entry) => entry.name === 'docProps/core.xml',
    });
    const entry = unzipped['docProps/core.xml'];
    if (!entry) return {};
    xml = strFromU8(entry);
  } catch {
    return {};
  }

  const result: DocxCoreProperties = {};
  const title = readElement(xml, 'dc:title');
  const author = readElement(xml, 'dc:creator');
  const description = readElement(xml, 'dc:description');
  if (title) result.title = title;
  if (author) result.author = author;
  if (description) result.description = description;
  return result;
}

/**
 * Texto de un elemento de `core.xml`, con las entidades XML resueltas y los
 * espacios normalizados. Word, LibreOffice y la librería `docx` usan siempre
 * el prefijo `dc:`, así que no hace falta resolver espacios de nombres.
 */
function readElement(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml);
  if (!match) return '';
  return normalizeText(decodeXmlEntities(match[1]));
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Comentarios es un cuadro multilínea: Word guarda cada salto como `_x000d_`
 * seguido de un salto de línea real. Un título es una sola línea, así que
 * todo eso se convierte en un espacio.
 */
function normalizeText(value: string): string {
  return value
    .replace(/_x000d_/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
