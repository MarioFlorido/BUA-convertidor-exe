/**
 * Memoria de estructuras del paso 2, en el navegador de cada usuario.
 *
 * Por qué: el equipo carga una y otra vez el mismo Word —o su traducción— y
 * tenía que rehacer el árbol de contenido cada vez. Al confirmar el paso 2 se
 * guarda aquí lo configurado; al volver a cargar un Word con los mismos
 * encabezados, el paso 2 se abre ya con esa configuración. No hay nada que
 * pulsar: si no coincide, el árbol sale en blanco como siempre.
 *
 * Qué se guarda: el esqueleto del documento (una huella de sus títulos y su
 * forma) y las elecciones (nivel de cada H1, opción de cada H2). Ni contenido
 * ni imágenes: unos cientos de bytes por documento, en `localStorage`.
 *
 * Qué cuenta como «el mismo documento»:
 *  - Mismo documento: misma secuencia de títulos H1/H2 (sin distinguir
 *    mayúsculas, tildes ni espacios).
 *  - Traducción: distintos títulos pero misma forma — mismo nº de H1 y mismo
 *    nº de H2 bajo cada uno, en el mismo orden. Una traducción fiel da esa
 *    forma; si hay varias candidatas gana la más reciente.
 *  - Cualquier otra cosa (una sección añadida, dos H2 fusionados) no coincide
 *    y sale en blanco. A propósito: aplicar una estructura desalineada en
 *    silencio sería peor que no aplicar nada.
 *
 * Una estructura con todo por defecto no se guarda (y borra la que hubiera
 * del mismo documento): recuperarla no cambiaría nada y solo añadiría ruido.
 *
 * Etiquetas de estructura en los títulos del Word («… [Subpágina]», ver
 * pipeline/headingTags.ts): frente a esta memoria MANDA EL WORD. Las etiquetas
 * forman parte de la huella del documento (`tags`), aparte de los títulos:
 *  - Si no han cambiado desde que se guardó, se respeta lo ajustado en el
 *    paso 2 (también en una traducción, que lleva las mismas etiquetas).
 *  - Si el coordinador las cambia en el Word, la entrada deja de coincidir y
 *    el paso 2 se abre con lo que dicen las nuevas.
 * «Por defecto» pasa a ser «lo que dice el Word»: solo se guarda lo que el
 * usuario cambió respecto a eso. Un documento sin etiquetas se comporta
 * exactamente como antes, y las entradas ya guardadas siguen valiendo.
 */

import type { DocumentStructure, H2StructureOption } from '../../types';
import { matchesWordStructure } from '../pipeline/headingTags';

const STORAGE_KEY = 'bua-structure-memory-v1';
const MAX_ENTRIES = 20;

const LEVELS = new Set([1, 2, 3]);
const OPTIONS = new Set<H2StructureOption>(['idevice-title', 'html', 'accordion', 'tabs']);

interface StoredEntry {
  /** Forma: nº de H2 de cada H1, en orden. Ej.: «3,0,5». */
  shape: string;
  /** Huella de la secuencia normalizada de títulos H1/H2. */
  titles: string;
  /**
   * Etiquetas de estructura del Word, en orden; ausente o «» si no lleva
   * ninguna (y en las entradas anteriores a las etiquetas).
   */
  tags?: string;
  /** Nivel de cada H1, en orden. */
  levels: (1 | 2 | 3)[];
  /** Opción de cada H2, en orden del documento. */
  options: H2StructureOption[];
  /** Momento del guardado (ms desde época). */
  at: number;
}

/** Lo mínimo de `localStorage` que se usa; inyectable para los tests. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type RecallKind = 'same' | 'similar';

export interface RecalledStructure {
  structure: DocumentStructure;
  /** `same`: mismos títulos. `similar`: misma forma, otros títulos (traducción). */
  kind: RecallKind;
}

/** Forma del documento: nº de H2 bajo cada H1. */
export function structureShape(structure: DocumentStructure): string {
  return structure.h1Sections.map((h1) => h1.h2Items.length).join(',');
}

/**
 * Huella de los títulos, tolerante a mayúsculas, tildes y espacios: un retoque
 * de estilo en un encabezado no debe convertir el documento en otro distinto.
 */
export function structureTitles(structure: DocumentStructure): string {
  const titles: string[] = [];
  for (const h1 of structure.h1Sections) {
    titles.push(normalizeTitle(h1.title));
    for (const h2 of h1.h2Items) titles.push(normalizeTitle(h2.text));
  }
  return fnv1a(titles.join('\n'));
}

/**
 * Huella de las etiquetas de estructura del Word: lo que pide cada título, en
 * orden («-» donde no hay etiqueta). Cadena vacía si el documento no lleva
 * ninguna, para que coincida con las entradas guardadas antes de que existieran.
 */
export function structureTags(structure: DocumentStructure): string {
  const tags: string[] = [];
  for (const h1 of structure.h1Sections) {
    tags.push(h1.wordLevel === undefined ? '-' : String(h1.wordLevel));
    for (const h2 of h1.h2Items) tags.push(h2.wordOption ?? '-');
  }
  return tags.some((tag) => tag !== '-') ? tags.join(',') : '';
}

function normalizeTitle(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** FNV-1a de 32 bits: barato, sin dependencias y de sobra para 20 entradas. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}


function readEntries(storage: StorageLike): StoredEntry[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidEntry) : [];
  } catch {
    return [];
  }
}

function writeEntries(storage: StorageLike, entries: StoredEntry[]): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Sin espacio o sin almacenamiento (modo privado): se renuncia a recordar.
  }
}

function isValidEntry(value: unknown): value is StoredEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.shape === 'string' &&
    typeof entry.titles === 'string' &&
    (entry.tags === undefined || typeof entry.tags === 'string') &&
    Array.isArray(entry.levels) && entry.levels.every((l) => LEVELS.has(l as number)) &&
    Array.isArray(entry.options) && entry.options.every((o) => OPTIONS.has(o as H2StructureOption)) &&
    typeof entry.at === 'number'
  );
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Guarda la estructura confirmada en el paso 2. Sustituye la entrada anterior
 * del mismo documento, si la había, y conserva solo las últimas MAX_ENTRIES.
 */
export function rememberStructure(
  structure: DocumentStructure,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;

  const shape = structureShape(structure);
  const titles = structureTitles(structure);
  const others = readEntries(storage).filter(
    (entry) => !(entry.shape === shape && entry.titles === titles),
  );

  // Nada que recordar si está tal y como lo pide el Word (sin etiquetas: todo
  // por defecto): recuperarlo no cambiaría nada.
  if (matchesWordStructure(structure)) {
    writeEntries(storage, others);
    return;
  }

  const tags = structureTags(structure);
  const entry: StoredEntry = {
    shape,
    titles,
    ...(tags ? { tags } : {}),
    levels: structure.h1Sections.map((h1) => h1.level),
    options: structure.h1Sections.flatMap((h1) => h1.h2Items.map((h2) => h2.option)),
    at: Date.now(),
  };
  writeEntries(storage, [entry, ...others].slice(0, MAX_ENTRIES));
}

/**
 * Busca en la memoria una estructura para el documento recién cargado y, si la
 * hay, devuelve la estructura con esas elecciones aplicadas. Si no, `null` y el
 * paso 2 se abre en blanco.
 */
export function recallStructure(
  structure: DocumentStructure,
  storage: StorageLike | null = defaultStorage(),
): RecalledStructure | null {
  if (!storage) return null;

  const shape = structureShape(structure);
  const titles = structureTitles(structure);
  const tags = structureTags(structure);
  // Manda el Word: una entrada guardada con otras etiquetas (o sin ellas) ya
  // no vale para este documento, ni como «el mismo» ni como traducción.
  const candidates = readEntries(storage).filter(
    (entry) => entry.shape === shape && (entry.tags ?? '') === tags,
  );
  if (candidates.length === 0) return null;

  // Las entradas están de más reciente a más antigua: la primera que coincida
  // en títulos es la última vez que se configuró ESTE documento; si ninguna,
  // la más reciente con la misma forma.
  const same = candidates.find((entry) => entry.titles === titles);
  const entry = same ?? candidates[0];
  const applied = applyEntry(structure, entry);
  if (!applied) return null;

  return { structure: applied, kind: same ? 'same' : 'similar' };
}

/** Vuelca niveles y opciones sobre la estructura; `null` si no encajan. */
function applyEntry(structure: DocumentStructure, entry: StoredEntry): DocumentStructure | null {
  const h2Count = structure.h1Sections.reduce((n, h1) => n + h1.h2Items.length, 0);
  if (entry.levels.length !== structure.h1Sections.length || entry.options.length !== h2Count) {
    return null;
  }

  let h2Index = 0;
  return {
    h1Sections: structure.h1Sections.map((h1, i) => ({
      ...h1,
      level: entry.levels[i],
      h2Items: h1.h2Items.map((h2) => ({ ...h2, option: entry.options[h2Index++] })),
    })),
  };
}
