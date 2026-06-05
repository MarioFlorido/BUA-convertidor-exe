/**
 * themesConfig — operaciones puras sobre el catálogo `public/themes-config.json`.
 *
 * Estas funciones NO tocan red ni disco: reciben el objeto de configuración y
 * devuelven una copia nueva con la operación aplicada. Así son fáciles de testear
 * y de usar tanto desde el publisher (navegador) como desde scripts.
 *
 * Mantiene la misma forma de entrada que `scripts/publish-theme.ts` para que
 * el catálogo sea idéntico se genere por donde se genere.
 */

export interface ThemeEntry {
  id: string;
  name: string;
  activity?: string;
  language?: string;
  description?: string;
  screenshot?: string | null;
}

export interface ThemesConfig {
  themes: ThemeEntry[];
}

export interface ThemeEntryInput {
  id: string;
  /** Si se omite, se deriva del id (guiones bajos → espacios). */
  name?: string;
  activity?: string;
  language?: string;
  description?: string;
}

/**
 * Añade o actualiza una entrada del catálogo.
 *
 * Si el tema ya existe, conserva los campos previos cuando el input no los
 * aporta (mismo comportamiento que el script `publish-theme`). Mantiene el
 * orden: actualiza en su sitio, o añade al final si es nuevo.
 *
 * `screenshot` se deja siempre en `null`: el runtime la deriva de la carpeta
 * del tema (`BuiltInThemeProvider`), no del catálogo.
 */
export function upsertThemeEntry(
  config: ThemesConfig,
  input: ThemeEntryInput,
): ThemesConfig {
  const themes = config.themes.map((t) => ({ ...t }));
  const existing = themes.find((t) => t.id === input.id);

  const merged: ThemeEntry = {
    id: input.id,
    name: input.name ?? existing?.name ?? input.id.replace(/_/g, ' '),
    activity: input.activity ?? existing?.activity ?? '',
    language: input.language ?? existing?.language ?? 'es',
    description: input.description ?? existing?.description ?? '',
    screenshot: null,
  };

  if (existing) {
    Object.assign(existing, merged);
  } else {
    themes.push(merged);
  }

  return { themes };
}

/** Elimina una entrada del catálogo por id. Devuelve copia nueva. */
export function removeThemeEntry(config: ThemesConfig, id: string): ThemesConfig {
  return { themes: config.themes.filter((t) => t.id !== id) };
}

/** ¿Existe ya un tema con ese id en el catálogo? */
export function hasThemeEntry(config: ThemesConfig, id: string): boolean {
  return config.themes.some((t) => t.id === id);
}

/**
 * Serializa el catálogo con el mismo formato que el script (2 espacios + salto
 * final), para evitar diffs espurios en git.
 */
export function serializeThemesConfig(config: ThemesConfig): string {
  return JSON.stringify(config, null, 2) + '\n';
}
