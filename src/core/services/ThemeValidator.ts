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
 * Los archivos se buscan en la raíz del ZIP (sin subfolder).
 */
export function validateThemeBundle(
  files: Record<string, Uint8Array>
): ThemeValidationResult {
  const errors: string[] = [];
  const keys = Object.keys(files);

  for (const required of REQUIRED_FILES) {
    const found = keys.some(
      (k) => k === required || k.endsWith(`/${required}`)
    );
    if (!found) {
      errors.push(`Falta ${required}`);
    }
  }

  return { valid: errors.length === 0, errors };
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
