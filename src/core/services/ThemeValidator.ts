/**
 * ThemeValidator — validación estructural de ZIPs de tema
 *
 * Un tema es válido si contiene como mínimo:
 *  - config.xml
 *  - style.css
 */

export interface ThemeValidationResult {
  valid: boolean;
  errors: string[];
}

const REQUIRED_FILES = ['config.xml', 'style.css'];

/**
 * Valida que un conjunto de archivos descomprimidos constituye un tema válido.
 * Los archivos requeridos deben estar EN LA RAÍZ: al montar el ELPX cada ruta
 * se prefija tal cual con `theme/`, así que un `MiCarpeta/style.css` acabaría
 * en `theme/MiCarpeta/style.css` y eXeLearning no lo encontraría. Pasar antes
 * por stripCommonRootDir() para aceptar ZIPs comprimidos "con carpeta".
 */
export function validateThemeBundle(
  files: Record<string, Uint8Array>
): ThemeValidationResult {
  const errors: string[] = [];
  const keys = Object.keys(files);

  for (const required of REQUIRED_FILES) {
    if (!keys.includes(required)) {
      errors.push(`Falta ${required} en la raíz del ZIP`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Normaliza un ZIP comprimido "con carpeta": si TODOS los archivos cuelgan de
 * la misma carpeta raíz (p. ej. `MiTema/style.css`, `MiTema/css/x.css`), la
 * elimina (→ `style.css`, `css/x.css`). Itera por si hay carpeta dentro de
 * carpeta, y descarta entradas de directorio (claves acabadas en `/`).
 * Si las rutas no comparten una única carpeta raíz, devuelve los archivos tal
 * cual: validateThemeBundle dará entonces el error correspondiente.
 */
export function stripCommonRootDir(
  files: Record<string, Uint8Array>
): Record<string, Uint8Array> {
  // Descartar entradas de directorio
  let current: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(files)) {
    if (path.endsWith('/')) continue;
    current[path] = data;
  }

  for (;;) {
    const keys = Object.keys(current);
    if (keys.length === 0) return current;

    const root = keys[0].split('/')[0];
    const allShareRoot =
      root.length > 0 &&
      keys.every((k) => k.startsWith(`${root}/`));
    if (!allShareRoot) return current;

    const stripped: Record<string, Uint8Array> = {};
    for (const [path, data] of Object.entries(current)) {
      stripped[path.slice(root.length + 1)] = data;
    }
    current = stripped;
  }
}

/**
 * Filtra archivos de sistema (macOS artifacts) de un ZIP descomprimido.
 */
export function filterSystemFiles(
  files: Record<string, Uint8Array>
): Record<string, Uint8Array> {
  const clean: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(files)) {
    if (
      path === '__MACOSX' ||
      path.startsWith('__MACOSX/') ||
      path === '.DS_Store' ||
      path.endsWith('/.DS_Store')
    ) {
      continue;
    }
    clean[path] = data;
  }
  return clean;
}
