import { unzipSync } from 'fflate';

/**
 * Assets del tema necesarios exclusivamente para el renderer print/PDF.
 *
 * Este objeto vive sólo dentro de html-print/ y nunca contamina
 * SemanticDocument, el pipeline DOCX ni el renderer ELPX.
 */
export interface PrintThemeAssets {
  /** ID del tema cargado (o 'base' si no se especificó ninguno) */
  themeId: string;

  /**
   * Data URL base64 de portada_pdf.{png|jpg|webp} del tema.
   * null si el tema no incluye imagen de portada.
   */
  coverImageDataUrl: string | null;

  /**
   * Data URL base64 del primer logo encontrado en img/ del tema.
   * null si el tema no incluye logos.
   */
  logoDataUrl: string | null;

  /** Color primario extraído del CSS del tema (#rrggbb). Fallback: #1a3a5c */
  primaryColor: string;

  /** Color de acento extraído del CSS del tema (#rrggbb). Fallback: #c8a951 */
  accentColor: string;

  /** Familia tipográfica de títulos. Fallback: 'Georgia, serif' */
  fontFamilyTitle: string;

  /** Familia tipográfica de cuerpo. Fallback: 'Arial, sans-serif' */
  fontFamilyBody: string;
}

/** Extensiones de imagen aceptadas para portada_pdf */
const COVER_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;

/** Prefijos de logo reconocidos en la carpeta img/ del tema */
const LOGO_PREFIXES = ['logo_BUA', 'logo_UA', 'logo'] as const;

/**
 * Carga los assets del tema necesarios para el renderer print.
 *
 * Estrategia:
 * 1. Descarga y descomprime el ZIP del tema desde BASE_URL.
 * 2. Busca portada_pdf.* en la raíz del ZIP.
 * 3. Busca un logo en img/.
 * 4. Extrae colores del CSS del tema con regex conservadoras.
 * 5. Si algo falla, usa valores de fallback en lugar de lanzar error.
 *
 * @param themeId  ID del tema (ej: "Doctorado_26-27"). undefined → fallback base.
 */
export async function loadPrintThemeAssets(themeId?: string): Promise<PrintThemeAssets> {
  const base: PrintThemeAssets = {
    themeId: themeId ?? 'base',
    coverImageDataUrl: null,
    logoDataUrl: null,
    primaryColor: '#1a3a5c',
    accentColor: '#c8a951',
    fontFamilyTitle: "'Georgia', serif",
    fontFamilyBody: "'Arial', sans-serif",
  };

  if (!themeId || themeId === 'base') {
    return base;
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = await fetchAndUnzip(themeId);
  } catch {
    // Si no se puede cargar el tema, continuar con fallback silenciosamente
    return base;
  }

  return {
    themeId,
    coverImageDataUrl: extractCoverImage(entries),
    logoDataUrl: extractLogo(entries),
    ...extractColorsAndFonts(entries),
  };
}

// ─── Helpers privados ────────────────────────────────────────────────────────

async function fetchAndUnzip(themeId: string): Promise<Record<string, Uint8Array>> {
  const baseUrl = (import.meta as any).env?.BASE_URL ?? '/';
  const url = `${baseUrl}${themeId}.zip`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo cargar el tema: ${url}`);
  }
  const buffer = await response.arrayBuffer();
  return unzipSync(new Uint8Array(buffer));
}

/**
 * Busca portada_pdf.{png|jpg|jpeg|webp} en la raíz del ZIP.
 * Devuelve data URL base64 o null si no existe.
 */
function extractCoverImage(entries: Record<string, Uint8Array>): string | null {
  for (const ext of COVER_IMAGE_EXTENSIONS) {
    const key = `portada_pdf.${ext}`;
    if (entries[key]) {
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                 : ext === 'webp' ? 'image/webp'
                 : 'image/png';
      return toDataUrl(entries[key], mime);
    }
  }
  return null;
}

/**
 * Busca el primer logo disponible en img/ del ZIP.
 * Devuelve data URL base64 o null si no existe.
 */
function extractLogo(entries: Record<string, Uint8Array>): string | null {
  for (const prefix of LOGO_PREFIXES) {
    for (const ext of ['png', 'svg', 'jpg'] as const) {
      const key = `img/${prefix}.${ext}`;
      if (entries[key]) {
        const mime = ext === 'svg' ? 'image/svg+xml'
                   : ext === 'jpg' ? 'image/jpeg'
                   : 'image/png';
        return toDataUrl(entries[key], mime);
      }
    }
  }
  return null;
}

/**
 * Extrae colores primarios y familias tipográficas del style.css del tema.
 * Usa regex conservadoras sobre comentarios de paleta o variables CSS.
 * En caso de no encontrar nada, devuelve los valores por defecto.
 */
function extractColorsAndFonts(entries: Record<string, Uint8Array>): {
  primaryColor: string;
  accentColor: string;
  fontFamilyTitle: string;
  fontFamilyBody: string;
} {
  const cssEntry = entries['style.css'];
  if (!cssEntry) {
    return {
      primaryColor: '#1a3a5c',
      accentColor: '#c8a951',
      fontFamilyTitle: "'Georgia', serif",
      fontFamilyBody: "'Arial', sans-serif",
    };
  }

  const css = new TextDecoder().decode(cssEntry);

  // Extraer colores de la paleta documentada en el comentario de cabecera
  // Formato: "Paleta: #color1 · #color2 · ..."
  const paletteMatch = /Paleta[:\s]+([#\w\s·,]+)/i.exec(css);
  const paletteColors = paletteMatch
    ? [...paletteMatch[1].matchAll(/#([0-9a-fA-F]{3,8})/g)].map(m => `#${m[1]}`)
    : [];

  // Extraer familia tipográfica del primer @font-face o font-family declarado
  const fontFamilyMatch = /font-family:\s*'([^']+)'/.exec(css);
  const titleFontMatch = /\.page-title[^{]*{[^}]*font-family:\s*'([^']+)'/s.exec(css);

  return {
    primaryColor: paletteColors[0] ?? '#1a3a5c',
    accentColor: paletteColors[1] ?? '#c8a951',
    fontFamilyTitle: titleFontMatch ? `'${titleFontMatch[1]}', sans-serif`
                   : fontFamilyMatch ? `'${fontFamilyMatch[1]}', sans-serif`
                   : "'Georgia', serif",
    fontFamilyBody: fontFamilyMatch ? `'${fontFamilyMatch[1]}', sans-serif`
                  : "'Arial', sans-serif",
  };
}

function toDataUrl(data: Uint8Array, mime: string): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
