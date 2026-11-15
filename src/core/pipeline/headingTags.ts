/**
 * Etiquetas de estructura al final de los títulos del Word.
 *
 * Para quien trabaja con plantillas: todos los documentos comparten estructura
 * y el paso 2 se rehacía a mano en cada conversión (`structureMemory` solo
 * recuerda en el navegador de cada uno). Con una etiqueta entre corchetes al
 * FINAL del título, la estructura viaja dentro del propio Word:
 *
 *   Título 1:  «Los gestores bibliográficos [Subpágina]»
 *              [Página principal] · [Subpágina] · [3er nivel]
 *   Título 2:  «Qué son [Acordeón]»
 *              [Título de iDevice] · [Cabecera 2 en texto] · [Acordeón] · [Pestañas]
 *
 * Son los mismos literales del paso 2. Se admiten mayúsculas, tildes, espacios
 * de más, singular/plural y `3er`/`3.er`/`3º`/`tercer`, y un punto final detrás.
 *
 * ÚNICO PUNTO DE RETIRADA. `stripHeadingTags` corre dentro de `DocxParser`,
 * antes de que nadie más vea el HTML: quita la etiqueta del texto del título y
 * la deja anotada en el encabezado como atributo (`data-bua-estructura`). A
 * partir de ahí estructura (parseStructure) y contenido (buildFromStructure)
 * ven el MISMO título limpio, así que la etiqueta no puede salir en nombres de
 * página, rótulos de acordeón/pestaña, índice, PDF ni huella de memoria, ni
 * desalinear el emparejado posicional que vigila structureContentSymmetry.test.
 *
 * Sin etiquetas, nada cambia: el HTML se devuelve byte a byte como entró. Solo
 * se reescribe el encabezado que lleva una etiqueta reconocida.
 *
 * Las etiquetas son solo el valor inicial del paso 2: el usuario tiene siempre
 * la última palabra allí.
 *
 * Libre de DOM (regex + string), como semanticTagBalance: se testea en Node y
 * no reserializa el HTML de Mammoth, del que depende el resto del pipeline.
 */

import type { DocumentStructure, H2StructureOption } from '../../types';
import { stripDiacritics } from '../utils/html';

/** Atributo con el que la etiqueta viaja en el encabezado, ya sin corchetes. */
export const HEADING_TAG_ATTR = 'data-bua-estructura';

export type HeadingTag =
  | { heading: 1; level: 1 | 2 | 3 }
  | { heading: 2; option: H2StructureOption };

interface TagDefinition {
  /** Valor del atributo. */
  key: string;
  /** Literal del paso 2, para los avisos. */
  label: string;
  tag: HeadingTag;
  /** Formas normalizadas (minúsculas, sin tildes, sin espacios ni puntos). */
  forms: string[];
}

const TAGS: TagDefinition[] = [
  {
    key: 'pagina-principal',
    label: 'Página principal',
    tag: { heading: 1, level: 1 },
    forms: ['paginaprincipal', 'paginasprincipales'],
  },
  {
    key: 'subpagina',
    label: 'Subpágina',
    tag: { heading: 1, level: 2 },
    forms: ['subpagina', 'subpaginas'],
  },
  {
    key: '3er-nivel',
    label: '3er nivel',
    tag: { heading: 1, level: 3 },
    forms: ['3ernivel', '3onivel', '3nivel', 'tercernivel'],
  },
  {
    key: 'titulo-idevice',
    label: 'Título de iDevice',
    tag: { heading: 2, option: 'idevice-title' },
    forms: ['titulodeidevice', 'titulosdeidevice', 'tituloidevice', 'titulodeidevices'],
  },
  {
    key: 'cabecera-2',
    label: 'Cabecera 2 en texto',
    tag: { heading: 2, option: 'html' },
    forms: ['cabecera2entexto', 'cabeceras2entexto', 'cabecera2'],
  },
  {
    key: 'acordeon',
    label: 'Acordeón',
    tag: { heading: 2, option: 'accordion' },
    forms: ['acordeon', 'acordeones'],
  },
  {
    key: 'pestanas',
    label: 'Pestañas',
    tag: { heading: 2, option: 'tabs' },
    forms: ['pestanas', 'pestana'],
  },
];

const TAG_BY_KEY = new Map(TAGS.map((def) => [def.key, def]));

export type HeadingTagIssueKind =
  /** Corchete final casi igual a una etiqueta: probable errata. Se deja como texto. */
  | 'heading-tag-typo'
  /** Etiqueta de otro nivel ([Acordeón] en un Título 1…). Se quita y no se aplica. */
  | 'heading-tag-wrong-level'
  /** El título solo tiene la etiqueta. Se deja como está. */
  | 'heading-tag-only'
  /** Etiqueta distinta de [Página principal] en el primer Título 1. Se ignora. */
  | 'heading-tag-first-page';

export interface HeadingTagIssue {
  kind: HeadingTagIssueKind;
  /** Lo que el autor escribió entre los corchetes (o el literal de la etiqueta). */
  written: string;
  /** Etiqueta a la que se parece o que se reconoció (literal del paso 2). */
  label: string;
  /** Nivel del título en Word (1 = Título 1…). */
  heading: number;
  /** Texto del título, para que el autor lo localice. */
  context: string;
}

export interface StrippedHeadingTags {
  html: string;
  issues: HeadingTagIssue[];
}

/** minúsculas, sin tildes, sin espacios ni signos: «3.er  Nivel» → «3ernivel». */
function normalizeTagText(raw: string): string {
  return stripDiacritics(raw.replace(/º/g, 'o').replace(/ª/g, 'a').toLowerCase()).replace(
    /[^a-z0-9]/g,
    '',
  );
}

function findTag(raw: string): TagDefinition | undefined {
  const norm = normalizeTagText(raw);
  if (!norm) return undefined;
  return TAGS.find((def) => def.forms.includes(norm));
}

/** Etiqueta más parecida si el corchete es una errata plausible de alguna. */
function findNearTag(raw: string): TagDefinition | undefined {
  const norm = normalizeTagText(raw);
  // Corchetes cortos o numéricos («[2024]», «[PDF]») no son erratas de nada.
  if (norm.length < 5 || /^\d+$/.test(norm)) return undefined;
  let best: { def: TagDefinition; distance: number } | undefined;
  for (const def of TAGS) {
    for (const form of def.forms) {
      const distance = editDistance(norm, form);
      // Hasta 2 erratas, y nunca más de un tercio de la palabra.
      if (distance <= 2 && distance * 3 <= form.length && (!best || distance < best.distance)) {
        best = { def, distance };
      }
    }
  }
  return best?.def;
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/** Espacio en el HTML crudo: blanco real o `&nbsp;` en cualquiera de sus formas. */
const SPACE_SRC = '(?:\\s|&nbsp;|&#160;|&#xa0;)';

/** Corchete final del título, con espacios y un punto final tolerados detrás. */
const TRAILING_BRACKET = new RegExp(
  `\\[([^\\[\\]]*)\\]${SPACE_SRC}*\\.?${SPACE_SRC}*$`,
  'i',
);
const TRAILING_SPACE = new RegExp(`${SPACE_SRC}+$`, 'i');

/** Texto visible de un fragmento de HTML crudo, para avisos y comprobaciones. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Quita del HTML interior de un encabezado sus últimos `count` caracteres de
 * TEXTO (las etiquetas HTML no cuentan y se conservan), y después los espacios
 * que quedaran colgando. Word puede haber partido la etiqueta entre runs
 * («[Sub<strong>página</strong>]»): por eso no basta un replace sobre el HTML.
 */
function dropTrailingText(inner: string, count: number): string {
  const parts = inner.split(/(<[^>]+>)/);
  let remaining = count;
  for (let i = parts.length - 1; i >= 0 && remaining > 0; i--) {
    if (parts[i].startsWith('<')) continue;
    const take = Math.min(remaining, parts[i].length);
    parts[i] = parts[i].slice(0, parts[i].length - take);
    remaining -= take;
  }
  // Espacios que separaban el título de la etiqueta.
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].startsWith('<')) continue;
    parts[i] = parts[i].replace(TRAILING_SPACE, '');
    if (parts[i]) break;
  }
  return parts.join('');
}

/**
 * Lee y retira las etiquetas de estructura de los encabezados.
 *
 * - Etiqueta reconocida y de su nivel → se quita del texto y se anota en el
 *   encabezado (`data-bua-estructura`).
 * - Reconocida pero de otro nivel → se quita (es una etiqueta, no texto) y se
 *   avisa; no se aplica.
 * - Corchete casi igual a una etiqueta → se deja como texto y se avisa.
 * - Título que solo tiene la etiqueta → se deja como está y se avisa: quitarla
 *   dejaría un encabezado vacío, que el pipeline ignora, y su contenido se
 *   fundiría con la sección anterior.
 * - Cualquier otro corchete («Normativa [2024]») → texto, sin aviso.
 */
export function stripHeadingTags(html: string): StrippedHeadingTags {
  const issues: HeadingTagIssue[] = [];
  if (!html || !html.includes('[')) return { html, issues };

  const result = html.replace(
    /<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi,
    (full, levelRaw: string, attrs: string | undefined, inner: string) => {
      if (!inner.includes('[')) return full;

      const heading = Number(levelRaw);
      const rawText = inner.replace(/<[^>]+>/g, '');
      const match = TRAILING_BRACKET.exec(rawText);
      if (!match) return full;

      const written = plainText(match[1]);
      const def = findTag(match[1]);

      if (!def) {
        const near = findNearTag(match[1]);
        if (near) {
          issues.push({
            kind: 'heading-tag-typo',
            written,
            label: near.label,
            heading,
            context: plainText(inner),
          });
        }
        return full;
      }

      const cleanedInner = dropTrailingText(inner, match[0].length);
      const title = plainText(cleanedInner);

      if (!title) {
        issues.push({ kind: 'heading-tag-only', written, label: def.label, heading, context: '' });
        return full;
      }

      if (def.tag.heading !== heading) {
        issues.push({
          kind: 'heading-tag-wrong-level',
          written,
          label: def.label,
          heading,
          context: title,
        });
        return `<h${levelRaw}${attrs ?? ''}>${cleanedInner}</h${levelRaw}>`;
      }

      return `<h${levelRaw}${attrs ?? ''} ${HEADING_TAG_ATTR}="${def.key}">${cleanedInner}</h${levelRaw}>`;
    },
  );

  return { html: result, issues };
}

/** Etiqueta anotada en un encabezado por `stripHeadingTags`, si la lleva. */
export function readHeadingTag(heading: Element): HeadingTag | undefined {
  const key = heading.getAttribute(HEADING_TAG_ATTR);
  return key ? TAG_BY_KEY.get(key)?.tag : undefined;
}

// ── Lo que dice el Word, sobre la estructura ya parseada ─────────────────────

/** Nivel que el Word pide para una sección: la primera es siempre principal. */
export function wordLevelOf(structure: DocumentStructure, index: number): 1 | 2 | 3 {
  return index === 0 ? 1 : structure.h1Sections[index].wordLevel ?? 1;
}

/** ¿Lleva el documento alguna etiqueta de estructura? */
export function hasWordStructure(structure: DocumentStructure): boolean {
  return structure.h1Sections.some(
    (h1) => h1.wordLevel !== undefined || h1.h2Items.some((h2) => h2.wordOption !== undefined),
  );
}

/** La estructura tal y como la pide el Word (sin etiqueta: valor por defecto). */
export function applyWordStructure(structure: DocumentStructure): DocumentStructure {
  return {
    h1Sections: structure.h1Sections.map((h1, index) => ({
      ...h1,
      level: wordLevelOf(structure, index),
      h2Items: h1.h2Items.map((h2) => ({ ...h2, option: h2.wordOption ?? 'html' })),
    })),
  };
}

/** ¿Coincide lo configurado con lo que pide el Word? */
export function matchesWordStructure(structure: DocumentStructure): boolean {
  return structure.h1Sections.every(
    (h1, index) =>
      h1.level === wordLevelOf(structure, index) &&
      h1.h2Items.every((h2) => h2.option === (h2.wordOption ?? 'html')),
  );
}

/**
 * Aviso de la etiqueta que se ignora en la primera página: el primer apartado
 * es siempre página principal (no hay de quién colgar una subpágina). Se saca
 * de la estructura ya parseada, que es quien sabe cuál es «el primero» (puede
 * haber delante una sección sintética con el contenido previo al primer
 * Título 1, y entonces la etiqueta sí es válida).
 */
export function detectFirstPageTagIssue(structure: DocumentStructure): HeadingTagIssue[] {
  const first = structure.h1Sections[0];
  if (!first || first.wordLevel === undefined || first.wordLevel === 1) return [];
  const label = first.wordLevel === 2 ? 'Subpágina' : '3er nivel';
  return [
    { kind: 'heading-tag-first-page', written: label, label, heading: 1, context: first.title },
  ];
}

const HEADING_NAME: Record<number, string> = { 1: 'Título 1', 2: 'Título 2' };

/** Mensaje legible para el paso 2. */
export function describeHeadingTagIssue(issue: HeadingTagIssue): string {
  const where = issue.context ? ` del título «${issue.context}»` : '';
  const headingName = HEADING_NAME[issue.heading] ?? `Título ${issue.heading}`;

  if (issue.kind === 'heading-tag-typo') {
    return `El corchete [${issue.written}]${where} se parece a la etiqueta [${issue.label}], pero no lo es. Si querías esa etiqueta, corrígela en el Word; tal como está, se imprimirá como parte del título.`;
  }
  if (issue.kind === 'heading-tag-only') {
    return `Hay un ${headingName} que solo contiene la etiqueta [${issue.written}], sin texto. Escribe el título delante de la etiqueta; tal como está, se usará «[${issue.written}]» como título.`;
  }
  if (issue.kind === 'heading-tag-first-page') {
    return `La etiqueta [${issue.label}]${where} se ha ignorado: el primer apartado del documento es siempre una página principal.`;
  }
  const valid =
    issue.heading === 1
      ? ' En un Título 1 valen [Página principal], [Subpágina] y [3er nivel].'
      : issue.heading === 2
        ? ' En un Título 2 valen [Título de iDevice], [Cabecera 2 en texto], [Acordeón] y [Pestañas].'
        : ' Las etiquetas de estructura solo valen en Título 1 y Título 2.';
  return `La etiqueta [${issue.label}]${where} no corresponde a un ${headingName} y se ha ignorado.${valid}`;
}
