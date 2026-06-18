/**
 * themeValidation — validación de un tema oficial antes de publicarlo.
 *
 * Trabaja sobre el mapa de archivos del tema (ruta relativa → bytes), tal y como
 * lo produce `readThemeDirectory`. Es libre de DOM (usa regex + TextDecoder), por
 * lo que se puede testear en Node.
 *
 * Distingue entre:
 *  - `errors`   → bloquean la publicación (falta lo imprescindible).
 *  - `warnings` → no bloquean, pero conviene revisarlos (calidad).
 *
 * También extrae metadatos útiles para la previsualización (idioma, paleta).
 */

export interface ThemeValidationReport {
  errors: string[];
  warnings: string[];
  meta: {
    language: 'es' | 'en' | 'ca' | null;
    /** `<title>` del config.xml: nombre legible del tema (con espacios). */
    title: string | null;
    /** Colores hex detectados en el comentario `Paleta:` del style.css. */
    palette: string[];
    hasScreenshot: boolean;
    hasCover: boolean;
  };
}

/** Archivos imprescindibles: sin ellos el tema no es válido. */
const REQUIRED_FILES = ['config.xml', 'style.css'];

/** Clases CSS que la maquetación BUA espera encontrar. */
const EXPECTED_BUA_CLASSES = ['.bua_ejemplo', '.bua_definicion', '.bua_importante'];

function findFile(
  files: Record<string, Uint8Array>,
  basename: string,
): Uint8Array | undefined {
  if (files[basename]) return files[basename];
  for (const [p, data] of Object.entries(files)) {
    if (p.endsWith(`/${basename}`)) return data;
  }
  return undefined;
}

function hasFileMatching(files: Record<string, Uint8Array>, re: RegExp): boolean {
  return Object.keys(files).some((p) => re.test(p));
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function extractLanguage(configXml: string): 'es' | 'en' | 'ca' | null {
  const m = configXml.match(/<language>\s*([a-z]{2})\s*<\/language>/i);
  if (!m) return null;
  const v = m[1].toLowerCase();
  return v === 'es' || v === 'en' || v === 'ca' ? v : null;
}

/** Extrae el `<title>` del config.xml (nombre legible del tema). */
function extractTitle(configXml: string): string | null {
  const m = configXml.match(/<title>([\s\S]*?)<\/title>/i);
  const v = m?.[1]?.trim();
  return v || null;
}

/**
 * Extrae los colores hex del comentario que empieza por `Paleta:`.
 * Best-effort: si no encuentra el comentario, devuelve [].
 */
export function extractPalette(css: string): string[] {
  // Busca un comentario CSS que contenga "Paleta:"
  const commentMatch = css.match(/\/\*[^]*?Paleta:[^]*?\*\//i);
  const scope = commentMatch ? commentMatch[0] : '';
  const hexes = scope.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  // Normalizar y deduplicar conservando orden
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of hexes) {
    const norm = h.toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

export function validateThemeForPublish(
  files: Record<string, Uint8Array>,
): ThemeValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Archivos imprescindibles
  for (const required of REQUIRED_FILES) {
    if (!findFile(files, required)) {
      errors.push(`Falta el archivo obligatorio: ${required}`);
    }
  }

  // 2. Imágenes recomendadas (aviso)
  const hasScreenshot = hasFileMatching(files, /(^|\/)screenshots?\.(png|jpe?g)$/i);
  const hasCover = hasFileMatching(files, /(^|\/)portada_pdf\.(png|jpe?g)$/i);
  if (!hasScreenshot) {
    warnings.push('No se encontró screenshot (screenshot.png/jpg): no habrá vista previa del tema.');
  }
  if (!hasCover) {
    warnings.push('No se encontró portada_pdf (portada_pdf.png/jpg): el PDF no tendrá portada de tema.');
  }

  // 3. Validación del CSS (avisos de calidad)
  const cssBytes = findFile(files, 'style.css');
  let palette: string[] = [];
  if (cssBytes) {
    const css = decode(cssBytes);

    const missingClasses = EXPECTED_BUA_CLASSES.filter((cls) => !css.includes(cls));
    if (missingClasses.length > 0) {
      warnings.push(`Faltan clases BUA en style.css: ${missingClasses.join(', ')}.`);
    }

    if (!/content\s*:/.test(css)) {
      warnings.push('No se detectó ninguna regla `content:` (los iconos de los pseudo-elementos podrían no mostrarse).');
    }

    if (!/\/\*[^]*?Paleta:/i.test(css)) {
      warnings.push('No se encontró el comentario `Paleta:` en style.css: no se podrán extraer los colores del tema.');
    } else {
      palette = extractPalette(css);
      if (palette.length === 0) {
        warnings.push('El comentario `Paleta:` no contiene colores hex reconocibles.');
      }
    }
  }

  // 4. Metadatos
  const configBytes = findFile(files, 'config.xml');
  const configXml = configBytes ? decode(configBytes) : null;
  const language = configXml ? extractLanguage(configXml) : null;
  if (configBytes && !language) {
    warnings.push('No se pudo detectar `<language>` en config.xml: se usará "es" por defecto.');
  }
  const title = configXml ? extractTitle(configXml) : null;

  return {
    errors,
    warnings,
    meta: { language, title, palette, hasScreenshot, hasCover },
  };
}
