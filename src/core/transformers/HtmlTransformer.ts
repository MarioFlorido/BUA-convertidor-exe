/**
 * Transformador HTML - Aplicación de clases semánticas BUA
 *
 * Responsabilidad: Aplicar clases BUA a elementos HTML basado en delimitadores
 * - [ejemplo]...[fin] → <div class="bua_ejemplo">
 * - [definición]...[fin] → <div class="bua_definicion">
 * - [importante]...[fin] → <div class="bua_importante">
 * - [horizontal] + tabla → class="bua_tabla_horizontal"
 * - [vertical] + tabla → class="bua_tabla_vertical"
 *
 * IMPORTANTE: Output HTML debe ser idéntico al original
 * Validación: SHA-256 de content.xml debe ser byte-identical
 */

/**
 * Mapea delimitadores a clases BUA
 * Case-insensitive y normaliza tildes
 */
function mapDelimiterToClass(delimitador: string): string | null {
  // Normalizar: convertir a minúsculas y remover tildes/acentos
  const normalized = delimitador
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // Remover diacríticos

  const classMap: Record<string, string> = {
    ejemplo: 'bua_ejemplo',
    definicion: 'bua_definicion',
    importante: 'bua_importante',
  };

  return classMap[normalized] || null;
}

/**
 * Procesa delimitadores [nombre] y [fin] en el HTML
 * Envuelve el contenido entre ellos en un <div class="bua_nombre">
 *
 * Soporta dos estructuras:
 *
 * Caso A — párrafos separados (etiqueta en su propio párrafo):
 *   <p>[Importante]</p>
 *   <p>Contenido...</p>
 *   <p>[fin]</p>
 *   → <div class="bua_importante"><p>Contenido...</p></div>
 *
 * Caso B — inline (etiqueta y contenido en el mismo párrafo):
 *   <p>[importante]Contenido[fin]</p>
 *   → <p><div class="bua_importante">Contenido</div></p>
 *
 * Case-insensitive: [EJEMPLO], [Ejemplo], [ejemplo] todos funcionan
 * Normaliza tildes: [definición] y [definicion] son equivalentes
 */
export function applyDivClasses(htmlValue: string): string {
  const wrap = (cls: string, content: string) => `<div class="${cls}">${content}</div>`;

  // Pre-normalización 1: eliminar anclas vacías (<a id="..."></a>) que Mammoth inserta
  // como bookmarks de Word dentro de posibles [etiquetas]. Word puede insertar varios
  // bookmarks consecutivos, por eso se hace dentro de cada [...] individualmente.
  let normalized = htmlValue.replace(
    /\[([^\]]*?)\]/g,
    (match) => match.replace(/<a[^>]*><\/a>/g, ''),
  );

  // Pre-normalización 2: si el usuario en Word usó Shift+Enter (salto de línea)
  // en vez de Enter (salto de párrafo) cerca de un marcador, Mammoth produce
  // <br/> en lugar de </p><p>. Eso impide que la regex de Caso A matchee y
  // genera HTML inválido (<div> dentro de <p>) cuando entra Caso B. Convertimos
  // todo <br/> contiguo a un marcador en una ruptura real de párrafo.
  const MARKER = /\[\s*(?:ejemplo|definici[oó]n|importante|fin)\s*\]/.source;
  const BR = /<br\s*\/?>/.source;
  normalized = normalized.replace(
    new RegExp(`${BR}\\s*(${MARKER})`, 'gi'),
    '</p><p>$1',
  );
  normalized = normalized.replace(
    new RegExp(`(${MARKER})\\s*${BR}`, 'gi'),
    '$1</p><p>',
  );

  // Etiquetas semánticas reconocidas. Limitar el regex a esta lista evita que
  // delimitadores no-semánticos como [horizontal] o [vertical] (que se procesan
  // después en applyTableClasses) consuman el siguiente [fin] y "se coman" la
  // siguiente caja semántica del documento.
  const SEMANTIC_LABEL = /(ejemplo|definici[oó]n|importante)/i;

  // Caso A: etiqueta en párrafo propio → consume los <p> de apertura y cierre
  let result = normalized.replace(
    new RegExp(
      `<p>\\s*\\[\\s*${SEMANTIC_LABEL.source}\\s*\\]\\s*</p>([\\s\\S]*?)<p>\\s*\\[fin\\]\\s*</p>`,
      'gi',
    ),
    (_match, delimitador, content) => {
      const mappedClass = mapDelimiterToClass(delimitador);
      if (!mappedClass) return _match;
      return wrap(mappedClass, content);
    },
  );

  // Caso B: etiqueta inline dentro del mismo párrafo
  result = result.replace(
    new RegExp(
      `\\[\\s*${SEMANTIC_LABEL.source}\\s*\\]([\\s\\S]*?)\\[fin\\]`,
      'gi',
    ),
    (_match, delimitador, content) => {
      const mappedClass = mapDelimiterToClass(delimitador);
      if (!mappedClass) return _match;
      return wrap(mappedClass, content);
    },
  );

  return result;
}

/**
 * Procesa delimitadores [horizontal] y [vertical] antes de tablas
 * Los delimitadores están dentro de párrafos <p>[horizontal]</p>
 * El párrafo se reemplaza por un párrafo vacío y se aplica la clase a la tabla
 *
 * Ejemplo en Word:
 * [horizontal]
 * <table>...</table>
 *
 * Resultado HTML:
 * <table class="bua_tabla_horizontal">...</table>
 */
export function applyTableClasses(htmlValue: string): string {
  const delimiters = [
    {
      // Busca <p>[horizontal]</p> seguido de tabla
      pattern: /<p>\s*\[\s*horizontal\s*\]\s*<\/p>\s*(<table[^>]*>)/gi,
      class: 'bua_tabla_horizontal',
      replacement: '<p><br /></p><$1',
    },
    {
      // Busca <p>[vertical]</p> seguido de tabla
      pattern: /<p>\s*\[\s*vertical\s*\]\s*<\/p>\s*(<table[^>]*>)/gi,
      class: 'bua_tabla_vertical',
      replacement: '<p><br /></p><$1',
    },
  ];

  let processedHtml = htmlValue;

  for (const { pattern, class: className, replacement } of delimiters) {
    processedHtml = processedHtml.replace(pattern, (_match, tableTag) => {
      // Construir el reemplazo con la clase agregada a la tabla
      let newTableTag = tableTag;

      // Verificar si ya tiene atributo class
      const classMatch = tableTag.match(/class=["']([^"']*)["']/);
      if (classMatch) {
        // Tabla ya tiene clases, agregar la nueva
        const existingClasses = classMatch[1];
        newTableTag = tableTag.replace(
          /class=["']([^"']*)["']/,
          `class="${existingClasses} ${className}"`,
        );
      } else {
        // Tabla no tiene clases, agregar clase
        newTableTag = tableTag.replace('>', ` class="${className}">`);
      }

      // Reemplazar el párrafo con línea vacía y la tabla con clase
      return replacement.replace('$1', newTableTag);
    });
  }

  return processedHtml;
}

/**
 * Aplica todas las transformaciones HTML en orden
 * - Primero: clases semánticas [ejemplo], [definición], [importante]
 * - Segundo: clases de tabla [horizontal], [vertical]
 */
export function applyAllTransforms(htmlValue: string): string {
  let transformed = htmlValue;
  transformed = applyDivClasses(transformed);
  transformed = applyTableClasses(transformed);
  return transformed;
}
