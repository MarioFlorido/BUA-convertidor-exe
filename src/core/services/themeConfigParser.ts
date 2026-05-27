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
