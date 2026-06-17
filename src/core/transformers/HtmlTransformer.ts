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
  // Pre-normalización: limpiar anclas vacías y <br/> dentro de [horizontal] y [vertical]
  // Word puede insertar bookmarks vacíos o saltos de línea dentro de los delimitadores
  let normalized = htmlValue.replace(
    /\[([^\]]*?(?:horizontal|vertical)[^\]]*?)\]/gi,
    (match) => {
      // Remover anclas vacías
      let cleaned = match.replace(/<a[^>]*><\/a>/g, '');
      // Remover <br/> y saltos de línea
      cleaned = cleaned.replace(/<br\s*\/?>/gi, '');
      cleaned = cleaned.replace(/\n/g, ' ');
      return cleaned;
    },
  );

  // Pre-normalización 2: remover <br/> contiguo a los delimitadores (después del ])
  // para que el párrafo quede completamente vacío
  normalized = normalized.replace(
    /(\[\s*(?:horizontal|vertical)\s*\])\s*<br\s*\/?>\s*</gi,
    '$1<',
  );

  const delimiters = [
    {
      // Busca <p>[horizontal]</p> seguido de tabla
      pattern: /<p>\s*\[\s*horizontal\s*\]\s*<\/p>\s*(<table[^>]*>)/gi,
      class: 'bua_tabla_horizontal',
      replacement: '<p><br /></p>$1',
    },
    {
      // Busca <p>[vertical]</p> seguido de tabla
      pattern: /<p>\s*\[\s*vertical\s*\]\s*<\/p>\s*(<table[^>]*>)/gi,
      class: 'bua_tabla_vertical',
      replacement: '<p><br /></p>$1',
    },
  ];

  let processedHtml = normalized;

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
 * Des-escapa las entidades HTML básicas que Mammoth genera al volcar texto.
 */
function unescapeBasicHtml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Procesa iframes embebidos (vídeos de YouTube pegados en Word).
 *
 * Word/Mammoth NO entregan el iframe como elemento real: lo vuelcan como
 * TEXTO ESCAPADO (&lt;iframe...&gt;...&lt;/iframe&gt;). Sin procesar, el
 * navegador lo muestra como código visible en vez de como vídeo.
 *
 * Esta función lo convierte en un <iframe> real dentro de un contenedor
 * centrado:
 *   - En ELPX  → eXeLearning muestra el vídeo embebido y centrado
 *   - En PDF   → convertIframesToLinks() lo transforma en enlace clickeable
 *   - En preview → PreviewService lo sustituye por un placeholder
 */
export function processIframes(htmlValue: string): string {
  const transform = (escaped: string): string => {
    // Des-escapar y centrar el iframe directamente (display:block + margin auto),
    // así el centrado no depende del contenedor. Además se envuelve en
    // .bua_video por si el tema quiere estilizarlo.
    const iframe = unescapeBasicHtml(escaped).replace(
      /<iframe\b/i,
      '<iframe style="display: block; margin: 1em auto; max-width: 100%;"',
    );
    return `<div class="bua_video">${iframe}</div>`;
  };

  // Caso A: el iframe escapado es el único contenido de un <p>.
  // Se reemplaza el <p> completo para no dejar un <div> dentro de un <p>
  // (HTML inválido que el navegador rompe).
  let result = htmlValue.replace(
    /<p>\s*(&lt;iframe\b[\s\S]*?&lt;\/iframe&gt;)\s*<\/p>/gi,
    (_m, escaped: string) => transform(escaped),
  );

  // Caso B: iframe escapado en cualquier otro contexto (suelto o junto a texto).
  result = result.replace(
    /&lt;iframe\b[\s\S]*?&lt;\/iframe&gt;/gi,
    (escaped: string) => transform(escaped),
  );

  return result;
}

/**
 * Convierte URLs en texto plano en enlaces clickeables.
 *
 * Word solo crea hipervínculos reales cuando el usuario los inserta como tal;
 * una URL escrita o pegada como texto llega sin enlace. Esta función la detecta
 * y la envuelve en <a href>, sin tocar:
 *   - URLs ya dentro de un <a> (hipervínculos existentes)
 *   - URLs en atributos como src o href (p. ej. el iframe de un vídeo)
 *
 * Trabaja sobre el DOM para procesar solo nodos de texto que estén fuera de <a>.
 */
export function autolinkUrls(htmlValue: string): string {
  if (typeof DOMParser === 'undefined') return htmlValue;

  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><body>${htmlValue}</body></html>`,
    'text/html',
  );
  const body = doc.body;
  const urlPattern = /(https?:\/\/[^\s<>"'`)\]]+|www\.[^\s<>"'`)\]]+)/g;

  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    textNodes.push(node as Text);
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent || '';
    if (!/https?:\/\/|www\./i.test(text)) continue;

    // Saltar URLs que ya están dentro de un enlace
    let ancestor: HTMLElement | null = textNode.parentElement;
    let insideAnchor = false;
    while (ancestor && ancestor !== body) {
      if (ancestor.tagName === 'A') {
        insideAnchor = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (insideAnchor) continue;

    const fragment = doc.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    urlPattern.lastIndex = 0;
    while ((match = urlPattern.exec(text)) !== null) {
      let url = match[0];
      const start = match.index;

      // No incluir signos de puntuación finales que no forman parte de la URL
      const trailingMatch = url.match(/[.,;:!?]+$/);
      const trailing = trailingMatch ? trailingMatch[0] : '';
      if (trailing) url = url.slice(0, -trailing.length);

      if (start > lastIndex) {
        fragment.appendChild(doc.createTextNode(text.slice(lastIndex, start)));
      }

      const anchor = doc.createElement('a');
      anchor.setAttribute('href', url.startsWith('www.') ? `https://${url}` : url);
      anchor.textContent = url;
      fragment.appendChild(anchor);

      if (trailing) fragment.appendChild(doc.createTextNode(trailing));
      lastIndex = start + url.length + trailing.length;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }

  return body.innerHTML;
}

/**
 * Hace que los enlaces externos se abran en una pestaña nueva.
 *
 * Añade target="_blank" y rel="noopener noreferrer" a los <a> cuyo href
 * apunta a una URL externa (http/https). No toca enlaces internos como
 * anclas (#...), mailto:, tel: ni rutas relativas.
 *
 * Cubre tanto los enlaces creados por autolinkUrls como los hipervínculos
 * que ya traía el documento de Word.
 */
export function openExternalLinksInNewTab(htmlValue: string): string {
  if (typeof DOMParser === 'undefined') return htmlValue;

  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><body>${htmlValue}</body></html>`,
    'text/html',
  );
  const body = doc.body;
  let changed = false;

  for (const anchor of Array.from(body.querySelectorAll('a[href]'))) {
    const href = (anchor.getAttribute('href') || '').trim();
    if (!/^https?:\/\//i.test(href)) continue; // solo enlaces externos
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
    changed = true;
  }

  // Si no hubo cambios, devolver el HTML original sin re-serializar
  return changed ? body.innerHTML : htmlValue;
}

/**
 * Detecta listas ordenadas (<ol>) que Mammoth ha partido en varios elementos
 * separados por contenido intercalado (párrafos, imágenes, tablas…) y añade
 * start="N" para que la numeración continúe sin reiniciarse.
 *
 * En Word, una lista con "no reiniciar numeración" comparte el mismo numId;
 * Mammoth pierde esa información y produce múltiples <ol> empezando todos
 * desde 1. Esta función lo restaura contando los <li> directos del grupo
 * anterior y ajustando el start del siguiente <ol>.
 *
 * Fronteras que reinician el grupo: h1-h6 (cambio de sección) y <ul>
 * (lista de viñetas intercalada). Cualquier otro contenido no rompe el grupo.
 */
export function continueInterruptedOrderedLists(htmlValue: string): string {
  if (typeof DOMParser === 'undefined') return htmlValue;

  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><body>${htmlValue}</body></html>`,
    'text/html',
  );
  const body = doc.body;

  let accumulated = 0; // ítems acumulados en el grupo ol activo
  let inGroup = false;
  let changed = false;

  for (const node of Array.from(body.children)) {
    const tag = node.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag) || tag === 'ul') {
      accumulated = 0;
      inGroup = false;
      continue;
    }

    if (tag === 'ol') {
      if (inGroup && accumulated > 0 && !node.hasAttribute('start')) {
        node.setAttribute('start', String(accumulated + 1));
        changed = true;
      }
      // Contar solo los <li> directos (no los de sublistas anidadas)
      const effectiveStart = parseInt(node.getAttribute('start') || '1', 10);
      const directLi = Array.from(node.children).filter(
        (c) => c.tagName.toLowerCase() === 'li',
      ).length;
      accumulated = (effectiveStart - 1) + directLi;
      inGroup = true;
      continue;
    }

    // p, table, div (cajas semánticas, vídeos)… no rompen el grupo
  }

  return changed ? body.innerHTML : htmlValue;
}

/**
 * Aplica todas las transformaciones HTML en orden:
 * 1. iframes embebidos (vídeos) → <iframe> real centrado
 * 2. clases semánticas [ejemplo], [definición], [importante]
 * 3. clases de tabla [horizontal], [vertical]
 * 4. listas numeradas interrumpidas → continuar numeración con start="N"
 * 5. autolink de URLs en texto plano (al final: re-serializa el DOM)
 * 6. enlaces externos → abrir en pestaña nueva
 */
export function applyAllTransforms(htmlValue: string): string {
  let transformed = htmlValue;
  transformed = processIframes(transformed);
  transformed = applyDivClasses(transformed);
  transformed = applyTableClasses(transformed);
  transformed = continueInterruptedOrderedLists(transformed);
  transformed = autolinkUrls(transformed);
  transformed = openExternalLinksInNewTab(transformed);
  return transformed;
}
