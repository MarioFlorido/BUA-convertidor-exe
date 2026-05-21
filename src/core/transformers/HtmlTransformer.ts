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
 * Soporta:
 * - [ejemplo]....[fin] → <div class="bua_ejemplo">
 * - [definición]....[fin] → <div class="bua_definicion">
 * - [importante]....[fin] → <div class="bua_importante">
 *
 * Case-insensitive: [EJEMPLO], [Ejemplo], [ejemplo] todos funcionan
 * Normaliza tildes: [definición] y [definicion] son equivalentes
 */
export function applyDivClasses(htmlValue: string): string {
  // Expresión regular case-insensitive para encontrar delimitadores [nombre] y [fin]
  const delimiterRegex = /\[([^\[\]]+?)\]([\s\S]*?)\[fin\]/gi;

  return htmlValue.replace(delimiterRegex, (_match, delimitador, content) => {
    const mappedClass = mapDelimiterToClass(delimitador);

    // Si no coincide con un delimitador válido, devolver sin procesar
    if (!mappedClass) {
      return _match;
    }

    // Retornar el contenido envuelto en un div con la clase BUA correspondiente
    return `<div class="${mappedClass}">${content}</div>`;
  });
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
