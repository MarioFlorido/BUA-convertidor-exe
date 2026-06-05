/**
 * gitTree — construcción pura de las entradas del árbol (tree) de la Git Data API.
 *
 * La publicación se hace en un único commit: se crean blobs para cada archivo,
 * se construye un tree con `base_tree` (heredando todo lo demás del repo) y se
 * apunta la rama al nuevo commit.
 *
 * Esta función solo arma el array de entradas del tree a partir de los SHAs de
 * blob ya creados. Es pura y testeable: no toca red.
 *
 * Convenciones de la Git Data API:
 *  - `mode: '100644'` → archivo normal.
 *  - `sha: string`    → apuntar la ruta a ese blob (crear/actualizar).
 *  - `sha: null`      → eliminar la ruta del árbol.
 */

import { THEMES_DIR, THEMES_CONFIG_PATH } from './githubRepo';

export interface GitTreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string | null;
}

export interface BuildTreeParams {
  themeId: string;
  /** Archivos del tema a crear/actualizar: ruta relativa al tema → SHA de blob. */
  upsertBlobs: Record<string, string>;
  /** Rutas relativas al tema que deben eliminarse (archivos obsoletos). */
  deleteRelPaths?: string[];
  /** SHA del blob del catálogo actualizado. Si se omite, no se toca el catálogo. */
  configBlobSha?: string | null;
}

function themePath(themeId: string, relPath: string): string {
  // Normaliza separadores y elimina barras iniciales
  const clean = relPath.replace(/^\/+/, '');
  return `${THEMES_DIR}/${themeId}/${clean}`;
}

/**
 * Construye las entradas del tree para publicar/actualizar un tema.
 * Las eliminaciones se calculan como `deleteRelPaths` menos lo que se vuelve a
 * subir (un archivo presente en ambos lados se actualiza, no se borra).
 */
export function buildThemeTreeEntries(params: BuildTreeParams): GitTreeEntry[] {
  const { themeId, upsertBlobs, deleteRelPaths = [], configBlobSha } = params;
  const entries: GitTreeEntry[] = [];

  // Crear/actualizar archivos del tema
  for (const [relPath, sha] of Object.entries(upsertBlobs)) {
    entries.push({ path: themePath(themeId, relPath), mode: '100644', type: 'blob', sha });
  }

  // Eliminar obsoletos (los que no se vuelven a subir)
  const upsertSet = new Set(Object.keys(upsertBlobs).map((p) => p.replace(/^\/+/, '')));
  for (const relPath of deleteRelPaths) {
    const clean = relPath.replace(/^\/+/, '');
    if (upsertSet.has(clean)) continue;
    entries.push({ path: themePath(themeId, clean), mode: '100644', type: 'blob', sha: null });
  }

  // Actualizar catálogo
  if (configBlobSha) {
    entries.push({ path: THEMES_CONFIG_PATH, mode: '100644', type: 'blob', sha: configBlobSha });
  }

  return entries;
}

/**
 * Construye las entradas del tree para ELIMINAR por completo un tema:
 * borra todos sus archivos y actualiza el catálogo.
 */
export function buildDeleteThemeTreeEntries(params: {
  themeId: string;
  existingRelPaths: string[];
  configBlobSha: string;
}): GitTreeEntry[] {
  const { themeId, existingRelPaths, configBlobSha } = params;
  const entries: GitTreeEntry[] = existingRelPaths.map((relPath) => ({
    path: themePath(themeId, relPath),
    mode: '100644' as const,
    type: 'blob' as const,
    sha: null,
  }));
  entries.push({ path: THEMES_CONFIG_PATH, mode: '100644', type: 'blob', sha: configBlobSha });
  return entries;
}
