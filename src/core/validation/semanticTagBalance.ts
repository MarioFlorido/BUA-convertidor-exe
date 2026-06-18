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
 * Nota: [horizontal] y [vertical] (clases de tabla) NO llevan [fin] y por eso
 * no se cuentan aquí como aperturas.
 */

export type SemanticBoxLabel = 'ejemplo' | 'definición' | 'importante' | 'pie';

export interface SemanticTagIssue {
  /** 'unclosed-box': falta el [fin]. 'stray-fin': un [fin] sin caja abierta. */
  kind: 'unclosed-box' | 'stray-fin';
  /** Etiqueta afectada (solo en 'unclosed-box'). */
  label?: SemanticBoxLabel;
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
  return raw
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Limpia las anclas vacías (<a id="…"></a>) que Word inserta como bookmarks
 * DENTRO de los corchetes y partirían el marcador. Réplica de la
 * pre-normalización de HtmlTransformer, para no perder marcadores al contarlos.
 */
function preNormalize(html: string): string {
  return html.replace(/\[([^\]]*?)\]/g, (match) =>
    match.replace(/<a[^>]*>\s*<\/a>/gi, ''),
  );
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

  const source = preNormalize(html);
  const marker = /\[\s*(ejemplo|definici[oó]n|importante|pie|fin)\s*\]/gi;
  const issues: SemanticTagIssue[] = [];

  let open: { label: SemanticBoxLabel; context: string } | null = null;

  for (const match of source.matchAll(marker)) {
    const norm = normalizeLabel(match[1]);
    const afterIndex = (match.index ?? 0) + match[0].length;

    if (norm === 'fin') {
      if (open) {
        open = null; // cierre correcto
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
    open = { label: PRETTY_LABEL[norm], context: contextSnippet(source, afterIndex) };
  }

  // Caja abierta que nunca se cerró antes del final del documento.
  if (open) {
    issues.push({ kind: 'unclosed-box', label: open.label, context: open.context });
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
  return `Falta el [fin] que cierra la caja [${issue.label}]${near}.`;
}
