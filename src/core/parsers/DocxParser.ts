import mammoth from 'mammoth';
import { readDocxImageSizes, assignDocxImageSizes } from './docxImageSizes';

/**
 * Parser para archivos DOCX
 *
 * Responsabilidad única: Convertir DOCX → HTML semántico
 * Usa Mammoth.js como librería de parsing con configuración estándar
 *
 * IMPORTANTE: salvo la conservación de sangrías y la anotación del tamaño de las
 * imágenes (ambas más abajo), el HTML de salida es idéntico al de Mammoth.js
 * puro. Un párrafo sin sangría manual y un documento sin imágenes salen
 * byte-identical con Mammoth.
 */

export interface DocxParseResult {
  html: string;
  metadata?: {
    title?: string;
    author?: string;
  };
}

/**
 * Mapa de estilos DOCX a HTML
 * Define cómo se convierten los estilos específicos del DOCX
 */
const DOCX_STYLE_MAP: string[] = [
  "p[style-name='Code'] => pre:fresh",
  "p[style-name='Código'] => pre:fresh",
  "p[style-name='Codigo'] => pre:fresh",
  "p[style-name='HTML'] => pre:fresh",
  "p[style-name='Preformatted'] => pre:fresh",
  "p[style-name='Preformatted Text'] => pre:fresh",
  "r[style-name='Code'] => code",
  "r[style-name='Código'] => code",
  "r[style-name='Codigo'] => code",
  "r[style-name='HTML'] => code",
  // Estilos de lista en español (Word instalado en español usa estos nombres)
  "p[style-name='Lista con viñetas'] => ul > li:fresh",
  "p[style-name='Lista con viñetas 2'] => ul > li:fresh",
  "p[style-name='Lista con viñetas 3'] => ul > li:fresh",
  "p[style-name='Lista numerada'] => ol > li:fresh",
  "p[style-name='Lista numerada 2'] => ol > li:fresh",
  "p[style-name='Lista numerada 3'] => ol > li:fresh",
  "p[style-name='Párrafo de lista'] => ul > li:fresh",
];

/**
 * Conservación de SANGRÍAS de párrafo (sangría izquierda y sangría francesa)
 * ---------------------------------------------------------------------------
 * Mammoth SÍ lee la sangría de Word (`w:ind`) en su modelo de documento
 * (`paragraph.indent.{start,firstLine,hanging}`), pero su escritor de HTML NUNCA
 * la vuelca. Por eso una sangría hecha a mano en Word (habitual en estilos
 * bibliográficos: MLA obliga a sangrar, APA usa sangría francesa) desaparecía al
 * convertir a ELPX y a PDF.
 *
 * Estrategia (robusta, sin emparejar posiciones a mano):
 *  1. `transformDocument` corre DENTRO de Mammoth, antes de generar el HTML, donde
 *     la correspondencia párrafo↔salida es exacta. Ahí insertamos un marcador
 *     invisible (caracteres de uso privado) al principio de cada párrafo sangrado,
 *     codificando la sangría ya calculada en puntos CSS.
 *  2. Tras `convertToHtml`, `applyIndentMarkers` sustituye cada marcador por un
 *     `style` inline en la etiqueta de apertura del párrafo, SIN reprocesar el
 *     resto del HTML (el resto del pipeline depende de la salida exacta de Mammoth,
 *     p. ej. `<br />`). Si no hay ningún marcador, el HTML se devuelve intacto.
 *
 * El interlineado (doble espacio de APA) NO se conserva: Mammoth ni siquiera
 * parsea `w:spacing`, así que exigiría leer document.xml a mano (más frágil). Se
 * deja fuera a propósito.
 */
const INDENT_MARK_OPEN = '\uE000';
const INDENT_MARK_CLOSE = '\uE001';

// Los typings de mammoth no declaran `transforms` aunque existe en runtime.
const mammothTransforms = (mammoth as unknown as {
  transforms: { paragraph: (fn: (p: any) => any) => (element: any) => any };
}).transforms;

/** Convierte twips de Word (1/20 de punto) a puntos CSS, redondeados. */
function twipsToPt(value: string | null | undefined): number {
  if (!value) return 0;
  const twips = parseInt(value, 10);
  if (!Number.isFinite(twips)) return 0;
  return Math.round(twips / 20);
}

/** ¿El nodo (párrafo/run/texto) contiene texto visible? */
function hasVisibleText(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n.type === 'text') return !!(n.value && n.value.trim());
  return Array.isArray(n.children) && n.children.some(hasVisibleText);
}

/** Run neutro (sin formato) que solo transporta el texto marcador. */
function makeMarkerRun(text: string) {
  return {
    type: 'run',
    children: [{ type: 'text', value: text }],
    styleId: null,
    styleName: null,
    isBold: false,
    isUnderline: false,
    isItalic: false,
    isStrikethrough: false,
    isAllCaps: false,
    isSmallCaps: false,
    verticalAlignment: 'baseline',
    font: null,
    fontSize: null,
    highlight: null,
  };
}

/**
 * Transform de Mammoth: marca los párrafos con sangría manual para que
 * `applyIndentMarkers` pueda reconstruirla como `style` inline.
 */
function markParagraphIndent(paragraph: any) {
  // Las listas ya llevan su propia sangría estructural: no tocarlas.
  if (!paragraph || paragraph.numbering) return paragraph;

  const indent = paragraph.indent;
  if (!indent) return paragraph;

  const marginLeft = twipsToPt(indent.start);
  const hanging = twipsToPt(indent.hanging);
  const firstLine = twipsToPt(indent.firstLine);
  // En Word `hanging` y `firstLine` son excluyentes; `hanging` (sangría francesa)
  // manda y se expresa como text-indent negativo.
  const textIndent = hanging > 0 ? -hanging : firstLine;

  if (marginLeft === 0 && textIndent === 0) return paragraph;
  // No resucitar párrafos vacíos (Mammoth los descarta con ignoreEmptyParagraphs).
  if (!hasVisibleText(paragraph)) return paragraph;

  const payload = `${marginLeft || ''}|${textIndent || ''}`;
  return {
    ...paragraph,
    children: [
      makeMarkerRun(`${INDENT_MARK_OPEN}${payload}${INDENT_MARK_CLOSE}`),
      ...paragraph.children,
    ],
  };
}

/** Traduce el payload del marcador (`"36|-36"`) a declaraciones CSS. */
function payloadToStyle(payload: string): string {
  const [ml, ti] = payload.split('|');
  const decls: string[] = [];
  if (ml) decls.push(`margin-left:${ml}pt`);
  if (ti) decls.push(`text-indent:${ti}pt`);
  return decls.join(';');
}

/** Inserta (o fusiona) las declaraciones de sangría en una etiqueta de apertura. */
function injectStyle(openTag: string, style: string): string {
  if (/\sstyle="/.test(openTag)) {
    return openTag.replace(/style="([^"]*)"/, (_m, existing) => `style="${existing};${style}"`);
  }
  return openTag.replace(/>$/, ` style="${style}">`);
}

/**
 * Sustituye los marcadores de sangría por `style` inline en la etiqueta de apertura
 * del párrafo. Solo toca los párrafos marcados; el resto del HTML queda intacto.
 */
function applyIndentMarkers(html: string): string {
  if (!html.includes(INDENT_MARK_OPEN)) return html;

  const markRe = new RegExp(
    `(<(?:p|pre|blockquote|h[1-6])(?:\\s[^>]*)?>)${INDENT_MARK_OPEN}([^${INDENT_MARK_CLOSE}]*)${INDENT_MARK_CLOSE}`,
    'g',
  );
  let result = html.replace(markRe, (_full, openTag: string, payload: string) => {
    const style = payloadToStyle(payload);
    return style ? injectStyle(openTag, style) : openTag;
  });

  // Red de seguridad: eliminar cualquier marcador huérfano que no encajara.
  const orphanRe = new RegExp(`${INDENT_MARK_OPEN}[^${INDENT_MARK_CLOSE}]*${INDENT_MARK_CLOSE}`, 'g');
  result = result.replace(orphanRe, '');

  return result;
}

/**
 * Conservación del TAMAÑO DE LAS IMÁGENES
 * ---------------------------------------------------------------------------
 * Mammoth descarta `wp:extent` (el tamaño con el que la imagen se ve en Word),
 * así que el HTML llega sin dimensiones y el navegador pinta cada imagen a su
 * tamaño intrínseco en píxeles. Para las capturas a ancho de columna da igual,
 * pero un logo insertado en línea con el texto salía enorme.
 *
 * Aquí se leen esos tamaños del propio DOCX y se anotan en cada <img> como
 * `data-bua-w` / `data-bua-h`. Los consume `classifyInlineImages` (en
 * HtmlTransformer), que los aplica a los logos en línea y los borra del resto:
 * las imágenes de bloque salen exactamente igual que antes.
 */

/**
 * Parser DOCX
 * Convierte archivos DOCX a HTML
 */
export class DocxParser {
  /**
   * Convierte archivo DOCX a HTML
   *
   * @param file Archivo DOCX (File API)
   * @returns Resultado con HTML extraído y metadatos
   *
   * @throws Error si no se puede leer o procesar el DOCX
   */
  async parse(file: File): Promise<DocxParseResult> {
    const inputBuffer = await file.arrayBuffer();
    const imageSizes = readDocxImageSizes(inputBuffer);

    // Detectar si estamos en Node.js o en el navegador
    const mammothInput =
      typeof Buffer !== 'undefined'
        ? { buffer: Buffer.from(inputBuffer) }
        : { arrayBuffer: inputBuffer };

    const result = await mammoth.convertToHtml(mammothInput, {
      includeEmbeddedStyleMap: true,
      includeDefaultStyleMap: true,
      ignoreEmptyParagraphs: true,
      styleMap: DOCX_STYLE_MAP,
      transformDocument: mammothTransforms.paragraph(markParagraphIndent),
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${await image.readAsBase64String()}`,
      })),
    });

    return {
      html: assignDocxImageSizes(applyIndentMarkers(result.value), imageSizes),
      metadata: {}
    };
  }
}
