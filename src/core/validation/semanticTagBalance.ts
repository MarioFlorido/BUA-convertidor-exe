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
 */

import { stripDiacritics } from '../utils/html';
import { normalizeSemanticMarkers } from '../transformers/HtmlTransformer';

export type SemanticBoxLabel = 'ejemplo' | 'definición' | 'importante' | 'pie';

export interface SemanticTagIssue {
  /**
   * 'unclosed-box': falta el [fin]. 'stray-fin': un [fin] sin caja abierta.
   * 'heading-inside-box': la caja abarca un encabezado H1–H6.
   * 'table-marker': [horizontal]/[vertical] que no precede a una tabla.
   */
  kind: 'unclosed-box' | 'stray-fin' | 'heading-inside-box' | 'table-marker';
  /** Etiqueta afectada (en 'unclosed-box' y 'heading-inside-box'). */
  label?: SemanticBoxLabel;
  /** Marcador de tabla afectado (solo en 'table-marker'). */
  marker?: 'horizontal' | 'vertical';
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

/**
 * Inspecciona el HTML y devuelve la lista de problemas de cierre de cajas.
 * Lista vacía = todo correcto.
 */
export function detectSemanticTagIssues(html: string): SemanticTagIssue[] {
  if (!html) return [];

  // La MISMA normalización que aplica la transformación (bookmarks, formato
  // parcial de Word dentro/alrededor del marcador, <br/>, aislamiento en
  // párrafo propio): el validador ve exactamente lo que verá el transformador.
  const source = normalizeSemanticMarkers(html);
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

  issues.push(...detectTableMarkerIssues(source));

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
    const wellPlaced = /<p>\s*$/i.test(before) && /^\s*<\/p>\s*<table\b/i.test(after);
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
  if (issue.kind === 'table-marker') {
    return `El marcador [${issue.marker}] no precede a una tabla${near}. Debe ir solo, en su propio párrafo, en la línea inmediatamente anterior a la tabla; si no, se imprimirá como texto.`;
  }
  return `Falta el [fin] que cierra la caja [${issue.label}]${near}.`;
}
