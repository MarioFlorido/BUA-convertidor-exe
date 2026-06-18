/**
 * themeGrouping — agrupa los temas en "familias" por curso.
 *
 * La mayoría de los estilos vienen triplicados (un mismo curso en castellano,
 * valenciano e inglés). Aquí se detecta esa relación para presentarlos juntos
 * en una sola fila, en vez de como tres entradas sueltas.
 *
 * Señal de agrupación (decisión de producto): el NOMBRE quitándole el idioma
 * entre paréntesis, esté al final ("DOCTORADO 2026-27 (CASTELLANO)") o en medio
 * ("DOCTORADO (CASTELLANO) 2026-27", como el `<title>` de eXeLearning). Ambos
 * comparten familia "DOCTORADO 2026-27".
 * El idioma de cada variante se lee de `metadata.language` (es/ca/en), que es
 * un dato fiable y no depende del texto del nombre.
 */

import type { ThemeBundle } from './ThemeBundle';

export interface ThemeFamily {
  /** Clave normalizada de agrupación (nombre de familia sin tildes/mayúsculas). */
  key: string;
  /** Nombre legible de la familia (nombre del tema sin el sufijo de idioma). */
  name: string;
  /** Variantes del mismo curso, ordenadas por idioma (es, ca, en, resto). */
  variants: ThemeBundle[];
}

const LANG_LABELS: Record<string, string> = {
  es: 'Castellano',
  ca: 'Valenciano',
  en: 'Inglés',
};

const LANG_RANK: Record<string, number> = { es: 0, ca: 1, en: 2 };

/**
 * Tokens que, si aparecen entre paréntesis al final del nombre, se consideran
 * marca de idioma y se recortan para obtener la familia. Si el paréntesis final
 * no contiene un idioma conocido, el nombre se conserva entero (familia propia).
 */
const LANG_TOKENS = new Set([
  'es', 'ca', 'en', 'val', 'cat', 'eng', 'spa',
  'castellano', 'espanol', 'spanish',
  'valenciano', 'valencia', 'catalan', 'catala',
  'ingles', 'english',
]);

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Etiqueta legible para un código de idioma (es → "Castellano"). */
export function languageLabel(lang: string | undefined): string {
  if (!lang) return '';
  return LANG_LABELS[lang.toLowerCase()] ?? lang.toUpperCase();
}

/** Código corto para el pill (es → "ES"). */
export function languageCode(lang: string | undefined): string {
  return lang ? lang.toUpperCase() : '·';
}

/**
 * Deriva el nombre de familia de un tema: su nombre sin el sufijo de idioma
 * final entre paréntesis. Si el paréntesis final no contiene un idioma
 * conocido, devuelve el nombre completo (el tema irá como familia propia).
 */
export function familyNameOf(theme: ThemeBundle): string {
  const name = (theme.metadata.name ?? theme.name).trim();
  // Quita los paréntesis cuyo contenido sea un idioma conocido, estén al final
  // ("DOCTORADO 2026-27 (CASTELLANO)") o en medio ("DOCTORADO (CASTELLANO)
  // 2026-27", como el <title> de eXeLearning). Si no hay ninguno, se conserva
  // el nombre completo (el tema irá como familia propia).
  const stripped = name.replace(/\s*\(([^()]*)\)/g, (full, inner: string) =>
    LANG_TOKENS.has(normalize(inner)) ? ' ' : full,
  );
  return stripped.replace(/\s{2,}/g, ' ').trim();
}

function langRank(theme: ThemeBundle): number {
  const lang = (theme.metadata.language ?? '').toLowerCase();
  return LANG_RANK[lang] ?? 9;
}

/**
 * Agrupa los temas en familias preservando el orden de primera aparición
 * (respeta el orden global que ya viene aplicado por ThemeOrderService).
 */
export function groupIntoFamilies(themes: ThemeBundle[]): ThemeFamily[] {
  const families: ThemeFamily[] = [];
  const byKey = new Map<string, ThemeFamily>();
  for (const theme of themes) {
    const name = familyNameOf(theme);
    const key = normalize(name);
    let fam = byKey.get(key);
    if (!fam) {
      fam = { key, name, variants: [] };
      byKey.set(key, fam);
      families.push(fam);
    }
    fam.variants.push(theme);
  }
  // Orden estable de variantes por idioma dentro de cada familia.
  for (const fam of families) {
    fam.variants.sort((a, b) => langRank(a) - langRank(b));
  }
  return families;
}

/** Aplana las familias a la lista de temas (orden familia → idioma). */
export function flattenFamilies(families: ThemeFamily[]): ThemeBundle[] {
  return families.flatMap((f) => f.variants);
}
