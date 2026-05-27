/**
 * themeConfigParser — utilidades para leer metadatos del config.xml de un tema
 *
 * El config.xml es el archivo estándar de eXeLearning que describe el tema.
 * Esta utilidad extrae información relevante (idioma) cuando está disponible.
 *
 * Cero dependencias externas: usa el DOMParser nativo del navegador.
 */

export type ThemeLanguage = 'es' | 'en' | 'ca';

/**
 * Convierte `screenshot.png` (o `.jpg`) de los archivos de un tema en un
 * Object URL utilizable como `src` de una imagen.
 *
 * Devuelve `null` si el archivo no existe. El URL es válido durante la
 * sesión del navegador; no hace falta revocarlo (se limpia al descargar la página).
 */
export function screenshotToObjectUrl(
  files: Record<string, Uint8Array>,
): string | null {
  const bytes = files['screenshot.png'] ?? files['screenshot.jpg'];
  if (!bytes) return null;
  const type = files['screenshot.png'] ? 'image/png' : 'image/jpeg';
  // Slice garantiza ArrayBuffer (no SharedArrayBuffer), requerido por Blob
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return URL.createObjectURL(new Blob([buffer], { type }));
}

/**
 * Extrae el código de idioma declarado en el `<language>` del config.xml.
 *
 * Estructura esperada:
 *   <theme>
 *     ...
 *     <language>es</language>   ← acepta 'es', 'en' o 'ca'
 *   </theme>
 *
 * @returns El código de idioma normalizado, o `null` si:
 *   - No existe el archivo `config.xml`
 *   - No existe el tag `<language>`
 *   - El valor no es uno de los códigos soportados
 *   - El XML está malformado
 */
export function extractLanguageFromConfigXml(
  files: Record<string, Uint8Array>,
): ThemeLanguage | null {
  const configXmlBytes = files['config.xml'];
  if (!configXmlBytes) return null;

  try {
    const xmlText = new TextDecoder().decode(configXmlBytes);
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');

    // DOMParser inserta <parsererror> en lugar de lanzar
    if (doc.querySelector('parsererror')) return null;

    const langEl = doc.querySelector('language');
    if (!langEl) return null;

    const value = langEl.textContent?.trim().toLowerCase();
    if (value === 'es' || value === 'en' || value === 'ca') {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}
