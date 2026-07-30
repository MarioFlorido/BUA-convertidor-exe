/**
 * Transformador HTML - Aplicación de clases semánticas BUA
 *
 * Responsabilidad: Aplicar clases BUA a elementos HTML basado en delimitadores
 * - [ejemplo]...[fin] → <div class="bua_ejemplo">
 * - [definición]...[fin] → <div class="bua_definicion">
 * - [importante]...[fin] → <div class="bua_importante">
 * - [pie]...[fin] → <div class="bua_pie">  (pie polivalente: tablas e ilustraciones)
 * - [horizontal] + tabla → class="bua_tabla_horizontal"
 * - [vertical] + tabla → class="bua_tabla_vertical"
 *
 * Y las líneas de recurso, que no llevan cierre porque solo afectan a su línea:
 * - [vídeo:] Título     → <p class="bua_recurso bua_recurso_video">
 * - [documento:] Título → <p class="bua_recurso bua_recurso_documento">
 * - [enlace:] Título    → <p class="bua_recurso bua_recurso_enlace">
 *
 * IMPORTANTE: Output HTML debe ser idéntico al original
 * Validación: SHA-256 de content.xml debe ser byte-identical
 */

import { stripDiacritics } from '../utils/html';
import { sniffDataUrlSize } from '../utils/imageSize';
import { RESOURCE_CLASS, type ResourceKind } from '../utils/resourceIcons';

/**
 * Mapea delimitadores a clases BUA
 * Case-insensitive y normaliza tildes
 */
function mapDelimiterToClass(delimitador: string): string | null {
  // Normalizar: convertir a minúsculas y remover tildes/acentos
  const normalized = stripDiacritics(delimitador.toLowerCase().trim());

  const classMap: Record<string, string> = {
    ejemplo: 'bua_ejemplo',
    definicion: 'bua_definicion',
    importante: 'bua_importante',
    pie: 'bua_pie',
  };

  return classMap[normalized] || null;
}

// ─── Normalización compartida de marcadores ──────────────────────────────────

/**
 * Marcadores que ocupan su propia línea (cajas, cierres y marcadores de tabla).
 * Son los únicos que se aíslan en un párrafo propio (paso 5).
 */
const MARKER_SRC =
  '\\[\\s*(?:ejemplo|definici[oó]n|importante|pie|fin[\\s-]*acorde[oó]n|fin|horizontal|vertical)\\s*\\]';

/**
 * Marcadores de línea de recurso: [vídeo:], [documento:], [enlace:].
 *
 * Los dos puntos son OBLIGATORIOS, y son lo único que no admite variantes. El
 * material puede ser un curso sobre IA en el que se transcriban prompts con
 * corchetes —«completa el [texto]», «pega aquí el [enlace]»—, y ese literal
 * tiene que llegar intacto al curso: sin los dos puntos, no es una etiqueta.
 * Del resto (mayúsculas, tildes, espacios) se sigue encargando la normalización.
 *
 * NO entran en el paso 5 (aislar en párrafo propio) A PROPÓSITO: van pegados al
 * texto que etiquetan, y separarlos en su propio <p> es justo lo que hay que
 * evitar. Sí entran en los pasos 2-4, que limpian la suciedad de Word alrededor
 * del marcador.
 */
const RESOURCE_MARKER_SRC = '\\[\\s*(?:v[ií]deo|documento|enlace)\\s*:\\s*\\]';

/** Unión de ambos, para las normalizaciones que valen para todos. */
const ANY_MARKER_SRC = `(?:${MARKER_SRC}|${RESOURCE_MARKER_SRC})`;

/** ¿El texto (ya sin tags) es exactamente un marcador reconocido? */
const MARKER_EXACT = new RegExp(`^${ANY_MARKER_SRC}$`, 'i');

/**
 * Normaliza los marcadores [etiqueta] frente a la "suciedad" invisible que
 * Word deja alrededor. Es la causa del clásico "la etiqueta está bien escrita
 * pero sale [fin] como texto": parte del marcador quedó con formato (negrita,
 * cursiva, bookmark…) y Mammoth genera tags que el autor no ve — borrar y
 * reescribir la etiqueta limpiaba esos restos. Pasos:
 *
 *  1. Anclas vacías (<a id="…"></a>, bookmarks) dentro de los corchetes.
 *  2. Cualquier otro tag DENTRO de los corchetes ([f<em>in</em>]), solo si al
 *     quitarlo el texto resultante es un marcador reconocido.
 *  3. Formato que envuelve exactamente el marcador (<strong>[fin]</strong>),
 *     incluso anidado (<strong><em>[fin]</em></strong>).
 *  4. <br/> pegados al marcador (Shift+Enter en Word).
 *  5. Aislar el marcador en su propio párrafo cuando comparte <p> con
 *     contenido: "<p>[pie]Figura 1[fin]</p>" → 3 párrafos. Así los casos
 *     inline y mixtos (apertura en párrafo propio + cierre inline, o al
 *     revés) se reducen todos al Caso A y nunca se genera un <div> dentro
 *     de un <p> (HTML inválido).
 *
 * Idempotente: aplicarla dos veces no cambia el resultado. La usa también
 * semanticTagBalance, para que el validador vea EXACTAMENTE lo mismo que la
 * transformación y no dé avisos falsos (ni se calle avisos reales).
 */
export function normalizeSemanticMarkers(html: string): string {
  // 1. Anclas vacías dentro de corchetes (en cualquier [texto], como siempre)
  let out = html.replace(/\[([^\]]*?)\]/g, (match) =>
    match.replace(/<a[^>]*>\s*<\/a>/gi, ''),
  );

  // 2. Tags dentro de los corchetes, si el texto resultante es un marcador
  out = out.replace(/\[([^\]]*?)\]/g, (match, inner: string) => {
    if (!/</.test(inner)) return match;
    const candidate = `[${inner.replace(/<[^>]*>/g, '')}]`;
    return MARKER_EXACT.test(candidate) ? candidate : match;
  });

  // 3. Formato que envuelve exactamente el marcador (repetir por anidamiento)
  const WRAPPED = new RegExp(
    `<(strong|em|u|del|sup|sub|span|a)\\b[^>]*>\\s*(${ANY_MARKER_SRC})\\s*</\\1>`,
    'gi',
  );
  let prev: string;
  do {
    prev = out;
    out = out.replace(WRAPPED, '$2');
  } while (out !== prev);

  // 4. <br/> pegados al marcador — con el paso 5 basta con eliminarlos:
  //    "<p>[importante]<br/>Contenido</p>" acaba igualmente en párrafos propios.
  //    Para un marcador de recurso el <br/> POSTERIOR también sobra (el autor
  //    partió la línea justo detrás de la etiqueta, pero el texto es suyo).
  out = out.replace(new RegExp(`(${ANY_MARKER_SRC})\\s*(?:<br\\s*/?>\\s*)+`, 'gi'), '$1');
  //    El <br/> ANTERIOR solo se quita a los marcadores de caja: ahí el paso 5
  //    los devuelve a su propio párrafo. Un marcador de recurso quedaría pegado
  //    al final de la línea de antes, así que ese <br/> se conserva y lo trata
  //    applyResourceLinks partiendo el párrafo.
  out = out.replace(new RegExp(`(?:<br\\s*/?>\\s*)+(${MARKER_SRC})`, 'gi'), '$1');

  // 5. Marcador a párrafo propio (solo al inicio o final del <p>; un marcador
  //    en mitad del texto no se puede aislar sin partir el formato que lo rodea)
  const ONLY = new RegExp(`^\\s*${MARKER_SRC}\\s*$`, 'i');
  const LEADING = new RegExp(`^\\s*(${MARKER_SRC})\\s*`, 'i');
  const TRAILING = new RegExp(`\\s*(${MARKER_SRC})\\s*$`, 'i');
  out = out.replace(/<p>([\s\S]*?)<\/p>/gi, (full, inner: string) => {
    if (ONLY.test(inner)) return full;
    let rest = inner;
    let prefix = '';
    let suffix = '';
    const lead = LEADING.exec(rest);
    if (lead) {
      prefix = `<p>${lead[1]}</p>`;
      rest = rest.slice(lead[0].length);
    }
    const trail = TRAILING.exec(rest);
    if (trail) {
      suffix = `<p>${trail[1]}</p>`;
      rest = rest.slice(0, trail.index);
    }
    if (!prefix && !suffix) return full;
    return rest.trim() ? `${prefix}<p>${rest}</p>${suffix}` : `${prefix}${suffix}`;
  });

  return out;
}

/**
 * Procesa delimitadores [nombre] y [fin] en el HTML
 * Envuelve el contenido entre ellos en un <div class="bua_nombre">
 *
 * Tras normalizeSemanticMarkers, todos los usos razonables (etiqueta en
 * párrafo propio, inline, mixtos, con formato accidental de Word) quedan
 * reducidos al Caso A. El Caso B se conserva como red de seguridad para
 * marcadores en mitad de un párrafo.
 *
 * Caso A — etiqueta en su propio párrafo:
 *   <p>[Importante]</p><p>Contenido...</p><p>[fin]</p>
 *   → <div class="bua_importante"><p>Contenido...</p></div>
 *
 * Caso B — marcadores en mitad del texto de un párrafo (residual):
 *   <p>a [importante]Contenido[fin] b</p>
 *   → <p>a <div class="bua_importante">Contenido</div> b</p>
 *
 * Case-insensitive: [EJEMPLO], [Ejemplo], [ejemplo] todos funcionan
 * Normaliza tildes: [definición] y [definicion] son equivalentes
 */
export function applyDivClasses(htmlValue: string): string {
  const wrap = (cls: string, content: string) => `<div class="${cls}">${content}</div>`;

  const normalized = normalizeSemanticMarkers(htmlValue);

  // Etiquetas semánticas reconocidas. Limitar el regex a esta lista evita que
  // delimitadores no-semánticos como [horizontal] o [vertical] (que se procesan
  // después en applyTableClasses) consuman el siguiente [fin] y "se coman" la
  // siguiente caja semántica del documento.
  const SEMANTIC_LABEL = /(ejemplo|definici[oó]n|importante|pie)/i;

  // Contenido de caja que NO puede atravesar un encabezado (H1–H6). Si el autor
  // abre una caja antes de un título y la cierra después, el troceado por
  // encabezados (posterior a esta transformación) dejaría de ver ese título y
  // la estructura del wizard se desalinearía en silencio. Al no matchear, los
  // marcadores quedan como texto literal (fallo visible) y semanticTagBalance
  // lo avisa antes de convertir ('heading-inside-box').
  const CONTENT = `((?:(?!<h[1-6][\\s>])[\\s\\S])*?)`;

  // Caso A: etiqueta en párrafo propio → consume los <p> de apertura y cierre
  let result = normalized.replace(
    new RegExp(
      `<p>\\s*\\[\\s*${SEMANTIC_LABEL.source}\\s*\\]\\s*</p>${CONTENT}<p>\\s*\\[fin\\]\\s*</p>`,
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
      `\\[\\s*${SEMANTIC_LABEL.source}\\s*\\]${CONTENT}\\[fin\\]`,
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

// ─── Líneas de recurso: [vídeo:] · [documento:] · [enlace:] ──────────────────

/**
 * Marcador de recurso al PRINCIPIO del contenido de un párrafo o ítem de lista.
 * Tolera el `&nbsp;` que Word deja con frecuencia pegado a la etiqueta. Los dos
 * puntos son obligatorios (ver RESOURCE_MARKER_SRC).
 */
const RESOURCE_LEADING = new RegExp(
  `^(?:&nbsp;|\\s)*\\[(?:&nbsp;|\\s)*(v[ií]deo|documento|enlace)(?:&nbsp;|\\s)*:(?:&nbsp;|\\s)*\\](?:&nbsp;|\\s)*`,
  'i',
);

/** ¿Hay algún marcador de recurso en el HTML? (atajo barato) */
const RESOURCE_ANYWHERE = new RegExp(RESOURCE_MARKER_SRC, 'i');

/** Forma normalizada del tipo de recurso, o null si no es de los nuestros. */
function normalizeResourceKind(raw: string): ResourceKind | null {
  const norm = stripDiacritics(raw.toLowerCase().trim());
  return norm === 'video' || norm === 'documento' || norm === 'enlace' ? norm : null;
}

/**
 * Convierte las líneas de recurso en párrafos marcados con su clase BUA.
 *
 *   <p>[vídeo:] <a href="…">Título</a></p>
 *   → <p class="bua_recurso bua_recurso_video"><a href="…">Título</a></p>
 *
 * El icono y la cursiva los pone el CSS (resourceIcons.ts para ELPX y preview,
 * printStyles.css para el PDF): en el contenido solo queda la clase, así que lo
 * que el autor edita después en eXeLearning sigue siendo su texto limpio.
 *
 * A diferencia de las cajas, estas etiquetas NO se cierran: afectan a la línea
 * en la que están y a nada más. Da igual cómo se escriban ([Vídeo:], [VIDEO:],
 * [ enlace : ]…): mayúsculas, tildes y espacios son indiferentes. Los dos
 * puntos no: sin ellos no hay etiqueta, para que un [enlace] transcrito dentro
 * de un prompt llegue al curso tal cual.
 *
 * Vale en párrafos y en ítems de lista (una lista de recursos es lo natural).
 * Si el autor partió la línea con Shift+Enter, cada trozo que empiece por un
 * marcador se convierte en su propio párrafo, igual que hacen las cajas.
 *
 * Un marcador SIN texto detrás se deja intacto a propósito: no hay recurso que
 * etiquetar, y verlo impreso es la pista de que algo falta.
 */
export function applyResourceLinks(htmlValue: string): string {
  if (typeof DOMParser === 'undefined') return htmlValue;
  if (!RESOURCE_ANYWHERE.test(htmlValue)) return htmlValue;

  const normalized = splitResourceLineBreaks(normalizeSemanticMarkers(htmlValue));

  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><body>${normalized}</body></html>`,
    'text/html',
  );
  const body = doc.body;
  let changed = false;

  for (const el of Array.from(body.querySelectorAll('p,li'))) {
    const match = RESOURCE_LEADING.exec(el.innerHTML);
    if (!match) continue;

    const kind = normalizeResourceKind(match[1]);
    if (!kind) continue;

    const rest = el.innerHTML.slice(match[0].length);
    if (!rest.trim()) continue; // marcador suelto: sin recurso que etiquetar

    el.innerHTML = rest;
    el.classList.add(RESOURCE_CLASS, `${RESOURCE_CLASS}_${kind}`);
    changed = true;
  }

  return changed ? body.innerHTML : htmlValue;
}

/**
 * Parte en párrafos independientes las líneas de recurso que el autor separó
 * con Shift+Enter dentro de un mismo párrafo. Solo actúa cuando detrás del
 * <br/> hay realmente un marcador de recurso; el resto de <br/> se conservan.
 */
export function splitResourceLineBreaks(html: string): string {
  const AFTER_BR = new RegExp(`<br\\s*/?>(?:&nbsp;|\\s)*${RESOURCE_MARKER_SRC}`, 'i');

  return html.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (full, attrs: string, inner: string) => {
    if (!AFTER_BR.test(inner)) return full;

    const segments = inner.split(/<br\s*\/?>/i);
    const paragraphs: string[] = [];
    for (const segment of segments) {
      // Un trozo que no empieza por marcador se vuelve a unir al anterior con
      // su <br/>: solo se separan las líneas que sí son un recurso.
      if (paragraphs.length > 0 && !RESOURCE_LEADING.test(segment)) {
        paragraphs[paragraphs.length - 1] += `<br />${segment}`;
        continue;
      }
      paragraphs.push(segment);
    }

    return paragraphs
      .filter((segment) => segment.trim())
      .map((segment) => `<p${attrs}>${segment}</p>`)
      .join('');
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
  // Normalización compartida: bookmarks/formato dentro y alrededor del marcador,
  // <br/> contiguos y aislamiento del marcador en su propio párrafo (permite
  // "<p>Texto [horizontal]</p><table>", que antes fallaba en silencio).
  const normalized = normalizeSemanticMarkers(htmlValue);

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

/** Clase que marca una imagen como "en línea" (logo, icono, imagen-enlace). */
export const INLINE_IMAGE_CLASS = 'bua_img_inline';

/** Contenedores de bloque que delimitan "el párrafo" de una imagen. */
const IMAGE_BLOCK_SELECTOR = 'p,li,td,th,h1,h2,h3,h4,h5,h6,blockquote,pre,figcaption,dt,dd';

/**
 * Distingue las imágenes EN LÍNEA (logos junto a un título o abriendo un
 * párrafo, imágenes que son un hiperenlace) de las ILUSTRACIONES de bloque
 * (capturas de pantalla), y marca las primeras con `bua_img_inline`.
 *
 * Criterio: una imagen es "en línea" cuando comparte su bloque (párrafo, ítem
 * de lista, celda, encabezado…) con OTRO contenido — texto visible u otra
 * imagen. Una captura sola en su párrafo no cumple la condición, así que
 * conserva íntegro el tratamiento de siempre: bloque centrado, con marco en el
 * PDF y con sombra en el ELPX. El cambio es aditivo por diseño.
 *
 * A las imágenes marcadas se les fija su tamaño para que NO se redimensionen:
 *   1. el tamaño de presentación real del DOCX, anotado por DocxParser en
 *      `data-bua-w`/`data-bua-h` (lo que el autor ve en Word);
 *   2. si no está disponible, el tamaño intrínseco leído de la cabecera del
 *      archivo — que es exactamente lo que pintaría el navegador por su cuenta.
 * Va como atributos width/height (los lee elpToDocx en el viaje de vuelta) y
 * como `style` inline, que es el único vehículo que gana al CSS del tema de
 * eXeLearning sin necesidad de !important.
 *
 * Los atributos `data-bua-*` se eliminan siempre, también de las imágenes de
 * bloque: no llegan a la salida.
 */
export function classifyInlineImages(htmlValue: string): string {
  if (typeof DOMParser === 'undefined') return htmlValue;
  if (!htmlValue.includes('<img')) return htmlValue;

  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><body>${htmlValue}</body></html>`,
    'text/html',
  );
  const body = doc.body;
  let changed = false;

  for (const img of Array.from(body.querySelectorAll('img'))) {
    const width = img.getAttribute('data-bua-w');
    const height = img.getAttribute('data-bua-h');
    if (width || height) {
      img.removeAttribute('data-bua-w');
      img.removeAttribute('data-bua-h');
      changed = true;
    }

    if (!sharesBlockWithOtherContent(img)) continue;

    img.classList.add(INLINE_IMAGE_CLASS);
    applyIntrinsicSize(img, width, height);
    changed = true;
  }

  return changed ? body.innerHTML : htmlValue;
}

/**
 * ¿La imagen convive en su bloque con otro contenido (texto visible u otra
 * imagen)? Es la señal de que actúa como logo/icono dentro del flujo y no como
 * ilustración independiente.
 */
function sharesBlockWithOtherContent(img: Element): boolean {
  const block = img.closest(IMAGE_BLOCK_SELECTOR);
  if (!block) return false; // imagen suelta en el body: ilustración de bloque

  if ((block.textContent || '').trim().length > 0) return true;
  return block.querySelectorAll('img').length > 1;
}

/** Fija el tamaño de la imagen para que no se redimensione en ninguna salida. */
function applyIntrinsicSize(img: Element, width: string | null, height: string | null): void {
  let size =
    width && height ? { width: Number(width), height: Number(height) } : null;

  if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height)) {
    const sniffed = sniffDataUrlSize(img.getAttribute('src') || '');
    size = sniffed ? { width: sniffed.width, height: sniffed.height } : null;
  }

  if (!size || size.width < 1 || size.height < 1) return;

  img.setAttribute('width', String(size.width));
  img.setAttribute('height', String(size.height));
  const existing = img.getAttribute('style');
  const declarations = `width:${size.width}px;height:${size.height}px`;
  img.setAttribute('style', existing ? `${existing};${declarations}` : declarations);
}

/**
 * Aplica todas las transformaciones HTML en orden:
 * 1. iframes embebidos (vídeos) → <iframe> real centrado
 * 2. clases semánticas [ejemplo], [definición], [importante], [pie]
 * 3. clases de tabla [horizontal], [vertical]
 * 4. líneas de recurso [vídeo:], [documento:], [enlace:]
 * 5. listas numeradas interrumpidas → continuar numeración con start="N"
 * 6. autolink de URLs en texto plano (al final: re-serializa el DOM)
 * 7. enlaces externos → abrir en pestaña nueva
 * 8. imágenes en línea (logos) → clase bua_img_inline + tamaño fijado
 *
 * Las líneas de recurso van DESPUÉS de las cajas y las tablas (así el marcador
 * ya llega limpio de la suciedad de Word) y ANTES del autolink, para que una URL
 * pegada como texto plano en la línea acabe igualmente enlazada.
 */
export function applyAllTransforms(htmlValue: string): string {
  let transformed = htmlValue;
  transformed = processIframes(transformed);
  transformed = applyDivClasses(transformed);
  transformed = applyTableClasses(transformed);
  transformed = applyResourceLinks(transformed);
  transformed = continueInterruptedOrderedLists(transformed);
  transformed = autolinkUrls(transformed);
  transformed = openExternalLinksInNewTab(transformed);
  transformed = classifyInlineImages(transformed);
  return transformed;
}
