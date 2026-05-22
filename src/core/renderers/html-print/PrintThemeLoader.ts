import { unzipSync } from 'fflate';

/**
 * Estilos de una caja semántica BUA (ejemplo, definición, importante).
 * Extraídos del CSS del tema para reproducirlos fielmente en el PDF.
 */
export interface BuaBoxStyle {
  /** Color del borde izquierdo */
  borderColor: string;
  /** Color o gradiente de fondo */
  bgColor: string;
  /**
   * Etiqueta de tipo (::before content).
   * Multilingüe: se lee directamente del CSS del tema activo.
   * Ej: "Ejemplo" / "Example" / "Exemple"
   */
  label: string;
}

export interface BuaBoxStyles {
  ejemplo:    BuaBoxStyle;
  definicion: BuaBoxStyle;
  importante: BuaBoxStyle;
}

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

  /** Color primario extraído del CSS del tema (#rrggbb). Fallback: #135d87 */
  primaryColor: string;

  /** Color de acento extraído del CSS del tema (#rrggbb). Fallback: #deb13c */
  accentColor: string;

  /** Familia tipográfica de títulos. Fallback: 'Georgia, serif' */
  fontFamilyTitle: string;

  /** Familia tipográfica de cuerpo. Fallback: 'Arial, sans-serif' */
  fontFamilyBody: string;

  /** Estilos de las cajas semánticas BUA extraídos del CSS del tema */
  buaStyles: BuaBoxStyles;
}

/** Extensiones de imagen aceptadas para portada_pdf */
const COVER_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;

/** Prefijos de logo reconocidos en la carpeta img/ del tema */
const LOGO_PREFIXES = ['logo_BUA', 'logo_UA', 'logo'] as const;

/**
 * Valores por defecto para cajas BUA cuando el tema no tiene CSS propio.
 * Coinciden con los colores del tema Doctorado_26-27 (el más común).
 */
const DEFAULT_BUA_STYLES: BuaBoxStyles = {
  ejemplo:    { borderColor: '#135d87', bgColor: '#fafbfc',               label: 'Ejemplo'    },
  definicion: { borderColor: '#6b7280', bgColor: '#fafbfc',               label: 'Definición' },
  importante: { borderColor: '#deb13c', bgColor: 'rgba(222,177,60,0.3)', label: 'Importante' },
};

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
    primaryColor: '#135d87',
    accentColor: '#deb13c',
    fontFamilyTitle: "'Georgia', serif",
    fontFamilyBody: "'Arial', sans-serif",
    buaStyles: DEFAULT_BUA_STYLES,
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
    ...extractThemeStyles(entries),
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
 * Extrae colores, tipografías y estilos BUA del style.css del tema.
 * Usa regex sobre el CSS del tema para reproducir fielmente los estilos en PDF.
 * En caso de no encontrar nada, devuelve valores por defecto.
 */
function extractThemeStyles(entries: Record<string, Uint8Array>): {
  primaryColor: string;
  accentColor: string;
  fontFamilyTitle: string;
  fontFamilyBody: string;
  buaStyles: BuaBoxStyles;
} {
  const cssEntry = entries['style.css'];
  if (!cssEntry) {
    return {
      primaryColor: '#135d87',
      accentColor: '#deb13c',
      fontFamilyTitle: "'Georgia', serif",
      fontFamilyBody: "'Arial', sans-serif",
      buaStyles: DEFAULT_BUA_STYLES,
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
    primaryColor: paletteColors[0] ?? '#135d87',
    accentColor: paletteColors[1] ?? '#deb13c',
    fontFamilyTitle: titleFontMatch ? `'${titleFontMatch[1]}', sans-serif`
                   : fontFamilyMatch ? `'${fontFamilyMatch[1]}', sans-serif`
                   : "'Georgia', serif",
    fontFamilyBody: fontFamilyMatch ? `'${fontFamilyMatch[1]}', sans-serif`
                  : "'Arial', sans-serif",
    buaStyles: extractBuaStyles(css),
  };
}

/**
 * Extrae colores y etiquetas de las cajas semánticas BUA del CSS del tema.
 *
 * Lee directamente las reglas `.bua_ejemplo { ... }` y `.bua_ejemplo::before { content: "..." }`,
 * por lo que los literales son multilingües: "Ejemplo" / "Example" / "Exemple"
 * según el idioma del tema cargado.
 */
function extractBuaStyles(css: string): BuaBoxStyles {
  /**
   * Extrae el color sólido del border-left de una clase BUA.
   * Soporta: "border-left: 6px solid #135d87"
   */
  function borderColor(cls: string): string | null {
    const m = new RegExp(`\\.${cls}\\s*\\{[^}]*border-left:[^;]*solid\\s*(#[0-9a-fA-F]{3,8})`, 's').exec(css);
    return m ? m[1] : null;
  }

  /**
   * Extrae el color/gradiente de fondo de una clase BUA.
   * Soporta: "background: #fafbfc" y "background-color: rgba(...)"
   */
  function bgColor(cls: string): string | null {
    const m = new RegExp(`\\.${cls}\\s*\\{[^}]*background(?:-color)?:\\s*(rgba\\([^)]+\\)|#[0-9a-fA-F]{3,8})`, 's').exec(css);
    return m ? m[1] : null;
  }

  /**
   * Extrae la etiqueta ::before { content: "..." } de una clase BUA.
   * Soporta comillas simples y dobles.
   */
  function label(cls: string): string | null {
    const m = new RegExp(`\\.${cls}::before\\s*\\{[^}]*content:\\s*["']([^"']+)["']`, 's').exec(css);
    return m ? m[1] : null;
  }

  return {
    ejemplo: {
      borderColor: borderColor('bua_ejemplo') ?? DEFAULT_BUA_STYLES.ejemplo.borderColor,
      bgColor:     bgColor('bua_ejemplo')     ?? DEFAULT_BUA_STYLES.ejemplo.bgColor,
      label:       label('bua_ejemplo')       ?? DEFAULT_BUA_STYLES.ejemplo.label,
    },
    definicion: {
      borderColor: borderColor('bua_definicion') ?? DEFAULT_BUA_STYLES.definicion.borderColor,
      bgColor:     bgColor('bua_definicion')     ?? DEFAULT_BUA_STYLES.definicion.bgColor,
      label:       label('bua_definicion')       ?? DEFAULT_BUA_STYLES.definicion.label,
    },
    importante: {
      borderColor: borderColor('bua_importante') ?? DEFAULT_BUA_STYLES.importante.borderColor,
      bgColor:     bgColor('bua_importante')     ?? DEFAULT_BUA_STYLES.importante.bgColor,
      label:       label('bua_importante')       ?? DEFAULT_BUA_STYLES.importante.label,
    },
  };
}

function toDataUrl(data: Uint8Array, mime: string): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
