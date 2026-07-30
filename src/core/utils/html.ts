/**
 * Escape para contextos XML / atributos: escapa también la comilla simple
 * (`'` → `&#39;`). Lo usan el content.xml del ELPX (escXml) y las preview pages.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape para texto HTML del renderer de impresión (portada, índice, secciones).
 * NO escapa la comilla simple: en contenido de texto HTML es innecesario y así la
 * salida queda idéntica a la histórica. Centraliza las tres copias que vivían en
 * `html-print/` (renderCoverPage, renderTableOfContents, semanticDocumentToPrintHtml).
 */
export function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Pone en MAYÚSCULAS el texto de los encabezados <h2> de un fragmento HTML.
 * eXeLearning y la vista de impresión muestran los H2 en mayúsculas; esta
 * transformación se aplicaba por separado (con la misma regex) en el renderer
 * ELPX y en el de impresión. Centralizada aquí para no duplicarla.
 *
 * Solo toca el TEXTO: las etiquetas de dentro del encabezado (un logo que el
 * autor puso en la misma línea del título llega como `<h2><img …/>Título</h2>`)
 * y las entidades HTML se copian tal cual. Poner en mayúsculas una etiqueta
 * rompería sus atributos, y `&nbsp;` no es lo mismo que `&NBSP;`.
 */
export function upperCaseH2(html: string): string {
  return html.replace(
    /<h2([^>]*)>([\s\S]*?)<\/h2>/gi,
    (_, attrs: string, inner: string) => `<h2${attrs}>${upperCaseTextOnly(inner)}</h2>`,
  );
}

/** Mayúsculas solo en los tramos de texto llano: ni etiquetas ni entidades. */
function upperCaseTextOnly(html: string): string {
  return html.replace(/<[^>]*>|&[a-z][a-z0-9]*;|&#\d+;|[^<&]+|[<&]/gi, (segment) =>
    /^[<&]/.test(segment) ? segment : segment.toUpperCase(),
  );
}

/**
 * Elimina los diacríticos (tildes/acentos) de una cadena vía descomposición NFD.
 * Primitiva común a la normalización de delimitadores ([definición] ≡
 * [definicion]), al slug de páginas, a la agrupación de temas por familia y a la
 * detección de cajas mal cerradas.
 */
export function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Normalizar texto: compacta espacios múltiples a un solo espacio y elimina espacios al inicio/fin
 * Necesario para matching consistente de títulos entre parseStructure y buildFromStructure
 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
