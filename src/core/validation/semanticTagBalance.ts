/**
 * semanticTagBalance — detección de cajas semánticas mal cerradas.
 *
 * Las cajas BUA se delimitan con una etiqueta de apertura y un cierre [fin]:
 *
 *   [ejemplo]      …contenido…   [fin]
 *   [definición]   …contenido…   [fin]
 *   [importante]   …contenido…   [fin]
 *   [pie]          …contenido…   [fin]
 *
 * Si el autor olvida un [fin], la transformación por regex de HtmlTransformer
 * empareja la apertura con el [fin] de la SIGUIENTE caja: se "traga" la etiqueta
 * intermedia (que acaba impresa como texto) y, en el caso inline, genera HTML
 * inválido. El fallo es silencioso: no hay forma de saberlo hasta abrir el ELPX.
 *
 * Este módulo NO transforma nada: solo inspecciona el HTML y devuelve avisos
 * para mostrarlos al autor ANTES de convertir, de modo que corrija el documento.
 * Es libre de DOM (regex + string), por lo que se puede testear en Node.
 *
 * Las cajas no se anidan, así que como mucho hay UNA caja abierta a la vez:
 * una nueva etiqueta de apertura mientras hay otra sin cerrar es justamente
 * el síntoma de un [fin] olvidado.
 *
 * Además de los cierres, se detectan otros dos fallos silenciosos:
 *
 * - 'heading-inside-box': una caja que abarca un encabezado (H1–H6). El
 *   troceado por encabezados corre DESPUÉS de formar las cajas, así que un
 *   título envuelto en un div dejaría de ser frontera de sección y
 *   desalinearía la estructura del wizard.
 *
 * - 'table-marker': un [horizontal]/[vertical] que no está solo en su párrafo
 *   inmediatamente antes de una <table>. No llevan [fin] (por eso no cuentan
 *   como aperturas), pero si el patrón no casa, el marcador se imprime como
 *   texto literal sin ningún aviso.
 *
 * - 'table-without-marker': una <table> sin [horizontal] ni [vertical] en el
 *   párrafo inmediatamente anterior. Es el simétrico de 'table-marker' y el
 *   fallo más caro de los dos: el tema de eXeLearning solo estiliza
 *   `.bua_tabla_horizontal` / `.bua_tabla_vertical`, así que una tabla sin clase
 *   sale sin bordes ni relleno —las celdas pegadas unas a otras— mientras que en
 *   el PDF se ve correcta. Sin aviso, el autor no tenía forma de enterarse.
 *
 * - 'box-not-formable': una caja bien cerrada pero repartida entre bloques que
 *   la transformación no puede envolver (dos ítems de lista distintos, un <p> y
 *   un <li>…). Antes salía de ahí un <div> a caballo entre bloques: HTML
 *   inválido que el navegador deshacía dejando la caja vacía.
 *
 * - 'accordion-marker': un [fin acordeón] que no está solo en su párrafo. Se
 *   limpia igual (nunca sale impreso), pero el grupo no se parte y el contenido
 *   posterior queda atrapado dentro del último panel, sin ninguna señal.
 *
 * - 'resource-marker': un [vídeo:]/[documento:]/[enlace:] que no abre su línea
 *   o que no tiene ningún recurso detrás. Mismo fallo silencioso que el
 *   anterior: sin aviso, el marcador acaba impreso tal cual. Exige los dos
 *   puntos, igual que la transformación: un [enlace] suelto no es una etiqueta.
 */

import { stripDiacritics } from '../utils/html';
import {
  normalizeSemanticMarkers,
  splitResourceLineBreaks,
  applyDivClasses,
  withoutCodeBlocks,
  P_OPEN_SRC,
} from '../transformers/HtmlTransformer';

export type SemanticBoxLabel = 'ejemplo' | 'definición' | 'importante' | 'pie';

export interface SemanticTagIssue {
  /**
   * 'unclosed-box': falta el [fin]. 'stray-fin': un [fin] sin caja abierta.
   * 'heading-inside-box': la caja abarca un encabezado H1–H6.
   * 'table-marker': [horizontal]/[vertical] que no precede a una tabla.
   * 'table-without-marker': una tabla sin [horizontal] ni [vertical] delante.
   * 'resource-marker': [vídeo:]/[documento:]/[enlace:] que no abre su línea.
   */
  kind:
    | 'unclosed-box'
    | 'stray-fin'
    | 'heading-inside-box'
    | 'box-not-formable'
    | 'accordion-marker'
    | 'table-marker'
    | 'table-without-marker'
    | 'resource-marker';
  /** Etiqueta afectada (en 'unclosed-box', 'heading-inside-box' y 'box-not-formable'). */
  label?: SemanticBoxLabel;
  /** Marcador afectado (en 'table-marker', 'accordion-marker' y 'resource-marker'). */
  marker?: 'horizontal' | 'vertical' | 'fin acordeón' | 'vídeo' | 'documento' | 'enlace';
  /** Fragmento de texto cercano para que el autor lo localice (puede ir vacío). */
  context: string;
}

/** Forma legible (con tilde) a partir de la etiqueta normalizada sin tildes. */
const PRETTY_LABEL: Record<string, SemanticBoxLabel> = {
  ejemplo: 'ejemplo',
  definicion: 'definición',
  importante: 'importante',
  pie: 'pie',
};

/** minúsculas + sin tildes/diacríticos, igual que mapDelimiterToClass. */
function normalizeLabel(raw: string): string {
  return stripDiacritics(raw.toLowerCase().trim());
}

/** Texto plano (sin etiquetas) inmediatamente posterior a una posición. */
function contextSnippet(source: string, from: number, maxChars = 60): string {
  const text = source
    .slice(from, from + 400)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length > maxChars ? `${text.slice(0, maxChars).trimEnd()}…` : text;
}

/** Texto plano (sin etiquetas) del final de un fragmento: el final de la línea. */
function contextBefore(source: string, maxChars = 60): string {
  const text = source
    .slice(-400)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length > maxChars ? `…${text.slice(-maxChars).trimStart()}` : text;
}

/**
 * Inspecciona el HTML y devuelve la lista de problemas de cierre de cajas.
 * Lista vacía = todo correcto.
 */
export function detectSemanticTagIssues(html: string): SemanticTagIssue[] {
  if (!html) return [];

  // La MISMA normalización que aplica la transformación (bookmarks, formato
  // parcial de Word dentro/alrededor del marcador, <br/>, aislamiento en
  // párrafo propio): el validador ve exactamente lo que verá el transformador.
  // Lo que va dentro de <pre>/<code> es código del autor: sus corchetes se
  // conservan a propósito (ver protectingCode), así que tampoco deben generar
  // avisos. Sin esto, un ejemplo de código con «[fin]» dentro se denunciaba
  // como [fin] suelto.
  const source = withoutCodeBlocks(normalizeSemanticMarkers(html));
  const marker = /\[\s*(ejemplo|definici[oó]n|importante|pie|fin)\s*\]/gi;
  const issues: SemanticTagIssue[] = [];

  let open: { label: SemanticBoxLabel; context: string; contentStart: number } | null = null;

  for (const match of source.matchAll(marker)) {
    const norm = normalizeLabel(match[1]);
    const afterIndex = (match.index ?? 0) + match[0].length;

    if (norm === 'fin') {
      if (open) {
        // Cierre correcto — pero si la caja abarca un encabezado, el troceado
        // por secciones (posterior) dejaría de verlo: avisar.
        const inner = source.slice(open.contentStart, match.index ?? 0);
        const heading = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(inner);
        if (heading) {
          issues.push({
            kind: 'heading-inside-box',
            label: open.label,
            context: headingText(heading[1]),
          });
        }
        open = null;
      } else {
        issues.push({ kind: 'stray-fin', context: contextSnippet(source, afterIndex) });
      }
      continue;
    }

    // Etiqueta de apertura
    if (open) {
      // Había una caja sin cerrar: una nueva apertura delata el [fin] olvidado.
      issues.push({ kind: 'unclosed-box', label: open.label, context: open.context });
    }
    open = {
      label: PRETTY_LABEL[norm],
      context: contextSnippet(source, afterIndex),
      contentStart: afterIndex,
    };
  }

  // Caja abierta que nunca se cerró antes del final del documento.
  if (open) {
    issues.push({ kind: 'unclosed-box', label: open.label, context: open.context });
  }

  // Solo si no hay ya un aviso más preciso sobre las MISMAS cajas: una sin
  // cerrar, un [fin] suelto o una que abarca un encabezado impiden igualmente
  // formarla, y avisar dos veces del mismo problema solo despista.
  const yaAvisado = issues.some(
    (i) => i.kind === 'unclosed-box' || i.kind === 'stray-fin' || i.kind === 'heading-inside-box',
  );
  if (!yaAvisado) issues.push(...detectUnformableBoxes(source));

  issues.push(...detectTableMarkerIssues(source));
  issues.push(...detectTablesWithoutMarker(source));
  issues.push(...detectAccordionMarkerIssues(source));
  issues.push(...detectResourceMarkerIssues(source));

  return issues;
}

/**
 * Detecta un [fin acordeón] que no está solo en su propio párrafo.
 *
 * SemanticBuilder solo parte el grupo por un `<p>[fin acordeón]</p>`; en
 * cualquier otro sitio (un ítem de lista, una celda) el marcador se limpia igual
 * —para que nunca salga impreso— pero el grupo NO se parte, y el contenido que
 * debía quedar FUERA del acordeón se queda atrapado dentro del último panel. Es
 * el fallo más callado de todos: ni marcador visible, ni aviso, ni rastro.
 *
 * No se parte por un <li> a propósito: dejaría el `<ul>` de apertura en una
 * mitad y el `</ul>` en la otra. Mejor avisar y que el autor lo mueva.
 */
function detectAccordionMarkerIssues(source: string): SemanticTagIssue[] {
  const issues: SemanticTagIssue[] = [];
  const marker = /\[\s*fin[\s-]*acorde[oó]n\s*\]/gi;

  for (const match of source.matchAll(marker)) {
    const idx = match.index ?? 0;
    const before = source.slice(0, idx);
    const after = source.slice(idx + match[0].length);
    const solo = new RegExp(`${P_OPEN_SRC}\\s*$`, 'i').test(before) && /^\s*<\/p>/i.test(after);
    if (solo) continue;

    issues.push({
      kind: 'accordion-marker',
      marker: 'fin acordeón',
      context: contextSnippet(source, idx + match[0].length) || contextBefore(before),
    });
  }

  return issues;
}

/**
 * Detecta cajas BIEN CERRADAS que la transformación no va a poder formar: la
 * apertura y su [fin] en bloques que no son párrafos hermanos —cada una en un
 * ítem de lista distinto, o una en un <p> y otra en un <li>—. Antes salía de
 * ahí un <div> a caballo entre dos bloques: HTML inválido que el navegador
 * deshacía dejando la caja vacía, y sin un solo aviso.
 *
 * NO se replica aquí el patrón del transformador. Duplicar la regla es
 * exactamente lo que desincronizó validador y transformación (el fallo de los
 * párrafos con sangría): en vez de eso se ejecuta applyDivClasses y se mira qué
 * marcadores sobreviven. Lo que quede dentro de <pre>/<code> no cuenta: ahí los
 * corchetes son contenido del autor y se conservan a propósito.
 */
function detectUnformableBoxes(source: string): SemanticTagIssue[] {
  const restos = withoutCodeBlocks(applyDivClasses(source));
  const issues: SemanticTagIssue[] = [];

  for (const match of restos.matchAll(/\[\s*(ejemplo|definici[oó]n|importante|pie)\s*\]/gi)) {
    issues.push({
      kind: 'box-not-formable',
      label: PRETTY_LABEL[normalizeLabel(match[1])],
      context: contextSnippet(restos, (match.index ?? 0) + match[0].length),
    });
  }

  return issues;
}

/** Texto plano del contenido de un encabezado, para usarlo como contexto. */
function headingText(innerHtml: string): string {
  return innerHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/**
 * Detecta marcadores [horizontal]/[vertical] que la transformación NO va a
 * reconocer: tras la normalización compartida, el patrón exige que el marcador
 * esté SOLO en su párrafo, inmediatamente antes de la <table>.
 * Recibe el HTML ya pasado por normalizeSemanticMarkers.
 */
function detectTableMarkerIssues(source: string): SemanticTagIssue[] {
  const issues: SemanticTagIssue[] = [];
  const tableMarker = /\[\s*(horizontal|vertical)\s*\]/gi;

  for (const match of source.matchAll(tableMarker)) {
    const idx = match.index ?? 0;
    const before = source.slice(0, idx);
    const after = source.slice(idx + match[0].length);
    const wellPlaced =
      new RegExp(`${P_OPEN_SRC}\\s*$`, 'i').test(before) && /^\s*<\/p>\s*<table\b/i.test(after);
    if (!wellPlaced) {
      issues.push({
        kind: 'table-marker',
        marker: match[1].toLowerCase() as 'horizontal' | 'vertical',
        context: contextSnippet(source, idx + match[0].length),
      });
    }
  }

  return issues;
}

/**
 * Detecta tablas SIN marcador [horizontal] ni [vertical] delante.
 *
 * Simétrico de detectTableMarkerIssues: aquel avisa del marcador que no
 * encuentra su tabla; este, de la tabla que no encuentra su marcador. La norma
 * de redacción BUA exige uno de los dos en toda tabla, porque es el marcador
 * —no Word— quien decide dónde está la cabecera.
 *
 * Recibe el HTML ya pasado por normalizeSemanticMarkers, así que la condición
 * es exactamente la que aplicará applyTableClasses: el marcador, solo, en el
 * párrafo inmediatamente anterior a la <table>.
 */
function detectTablesWithoutMarker(source: string): SemanticTagIssue[] {
  const issues: SemanticTagIssue[] = [];
  const markedBefore = new RegExp(
    `${P_OPEN_SRC}\\s*\\[\\s*(?:horizontal|vertical)\\s*\\]\\s*</p>\\s*$`,
    'i',
  );

  for (const match of source.matchAll(/<table\b[^>]*>/gi)) {
    const idx = match.index ?? 0;
    const before = source.slice(0, idx);
    if (markedBefore.test(before)) continue;

    // El autor SÍ escribió un marcador, pero mal colocado: de eso ya avisa
    // 'table-marker' con instrucciones concretas, y repetirlo aquí solo
    // despista. Se mira desde el final de la tabla anterior para no confundir
    // el marcador de OTRA tabla con el de esta.
    const sincePreviousTable = before.slice(before.toLowerCase().lastIndexOf('</table>') + 1);
    if (/\[\s*(?:horizontal|vertical)\s*\]/i.test(sincePreviousTable)) continue;

    issues.push({
      kind: 'table-without-marker',
      context: contextSnippet(source, idx + match[0].length),
    });
  }

  return issues;
}

/**
 * Detecta marcadores de recurso ([vídeo:], [documento:], [enlace:]) que la
 * transformación NO va a reconocer. applyResourceLinks solo los acepta al
 * PRINCIPIO de un párrafo o de un ítem de lista y con algo detrás que etiquetar;
 * en cualquier otra posición el marcador se imprimiría como texto literal.
 * Recibe el HTML ya pasado por normalizeSemanticMarkers.
 */
function detectResourceMarkerIssues(source: string): SemanticTagIssue[] {
  const issues: SemanticTagIssue[] = [];
  // La MISMA partición por <br/> que aplica applyResourceLinks: una línea de
  // recurso escrita con Shift+Enter es válida y no debe dar aviso.
  const split = splitResourceLineBreaks(source);
  // Los dos puntos son obligatorios: un [enlace] o un [texto] sin ellos no es
  // una etiqueta (puede ser un prompt transcrito), así que ni se transforma ni
  // se avisa de nada.
  const marker = /\[\s*(v[ií]deo|documento|enlace)\s*:\s*\]/gi;

  for (const match of split.matchAll(marker)) {
    const idx = match.index ?? 0;
    const before = split.slice(0, idx);
    const after = split.slice(idx + match[0].length);

    const opensLine = /<(?:p|li)\b[^>]*>(?:&nbsp;|\s)*$/i.test(before);
    const hasResource = !/^(?:&nbsp;|\s)*(?:<\/(?:p|li)>|$)/i.test(after);
    if (opensLine && hasResource) continue;

    issues.push({
      kind: 'resource-marker',
      marker: normalizeLabel(match[1]) === 'video'
        ? 'vídeo'
        : (normalizeLabel(match[1]) as 'documento' | 'enlace'),
      // Lo que sigue al marcador sitúa mejor el problema; si no hay nada detrás
      // (marcador suelto), se muestra lo que lo precede.
      context: contextSnippet(split, idx + match[0].length) || contextBefore(before),
    });
  }

  return issues;
}

/** Helper booleano. */
export function hasSemanticTagIssues(html: string): boolean {
  return detectSemanticTagIssues(html).length > 0;
}

/** Mensaje legible para mostrar en la UI a partir de un problema detectado. */
export function describeSemanticTagIssue(issue: SemanticTagIssue): string {
  const near = issue.context ? ` (cerca de: «${issue.context}»)` : '';
  if (issue.kind === 'stray-fin') {
    return `Hay un [fin] que no cierra ninguna caja abierta${near}. ¿Sobra, o falta su etiqueta de apertura?`;
  }
  if (issue.kind === 'heading-inside-box') {
    return `La caja [${issue.label}] abarca el encabezado «${issue.context}». Un título no puede quedar dentro de una caja: cierra con [fin] antes del encabezado.`;
  }
  if (issue.kind === 'box-not-formable') {
    return `La caja [${issue.label}] no se puede formar donde está${near}. La etiqueta y su [fin] deben ir en el mismo párrafo, o cada una en su propio párrafo: repartidas entre ítems de lista o entre bloques distintos, se imprimirán como texto.`;
  }
  if (issue.kind === 'accordion-marker') {
    return `El marcador [fin acordeón] no está solo en su propio párrafo${near}. Sácalo de la lista (o del texto que lo acompaña) y déjalo en una línea para él: si no, el acordeón no se cierra ahí y lo que va después se queda dentro del último panel.`;
  }
  if (issue.kind === 'table-marker') {
    return `El marcador [${issue.marker}] no precede a una tabla${near}. Debe ir solo, en su propio párrafo, en la línea inmediatamente anterior a la tabla; si no, se imprimirá como texto.`;
  }
  if (issue.kind === 'table-without-marker') {
    return `Hay una tabla sin marcador${near}. Escribe [horizontal] o [vertical], solo, en el párrafo inmediatamente anterior a la tabla: es lo que decide dónde está la cabecera. Mientras falte, se tratará como [horizontal] y la primera fila hará de cabecera.`;
  }
  if (issue.kind === 'resource-marker') {
    return `La etiqueta [${issue.marker}:] no abre una línea de recurso${near}. Debe ir al principio de la línea y con el texto del recurso detrás; si no, se imprimirá como texto.`;
  }
  return `Falta el [fin] que cierra la caja [${issue.label}]${near}.`;
}
