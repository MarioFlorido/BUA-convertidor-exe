import { unzipSync } from 'fflate';
import { ThemeRegistry } from '../../services/ThemeRegistry';
import { extractLanguageFromConfigXml } from '../../services/themeConfigParser';

/** Idioma del tema, detectado desde el ID. Controla los textos CC y etiquetas. */
export type PrintLanguage = 'es' | 'en' | 'ca';

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
   * Data URL base64 del logo BUA (img/logo_BUA.*) del tema.
   * Se usa en la portada y en el encabezado de página.
   * null si el tema no incluye logo BUA.
   */
  buaLogoDataUrl: string | null;

  /**
   * Data URL base64 del logo UA (img/logo_UA.*) del tema.
   * Se usa en el pie de página.
   * null si el tema no incluye logo UA.
   */
  uaLogoDataUrl: string | null;

  /** Idioma del tema detectado del ID: 'es', 'en' o 'ca'. Controla textos CC. */
  language: PrintLanguage;

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
    buaLogoDataUrl: null,
    uaLogoDataUrl: null,
    language: detectLanguage(themeId ?? 'base'),
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
    buaLogoDataUrl: extractLogoFile(entries, 'logo_BUA') ?? extractLogoFile(entries, 'logo'),
    uaLogoDataUrl: extractLogoFile(entries, 'logo_UA'),
    // language viene de extractThemeStyles (usa etiquetas BUA + fallback themeId)
    ...extractThemeStyles(entries, themeId),
  };
}

// ─── Helpers privados ────────────────────────────────────────────────────────

async function fetchAndUnzip(themeId: string): Promise<Record<string, Uint8Array>> {
  // Consultar ThemeRegistry primero (evita re-fetch para temas ya cargados)
  const bundle = ThemeRegistry.get(themeId);
  if (bundle && Object.keys(bundle.files).length > 0) {
    return bundle.files;
  }

  // Fallback: fetch desde URL estática (built-ins en public/ o dev middleware)
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
 * Busca un logo concreto (sin extensión) en img/ del ZIP.
 * Prueba .png, .svg, .jpg en ese orden.
 * Devuelve data URL base64 o null si no existe.
 */
function extractLogoFile(entries: Record<string, Uint8Array>, name: string): string | null {
  for (const ext of ['png', 'svg', 'jpg'] as const) {
    const key = `img/${name}.${ext}`;
    if (entries[key]) {
      const mime = ext === 'svg' ? 'image/svg+xml'
                 : ext === 'jpg' ? 'image/jpeg'
                 : 'image/png';
      return toDataUrl(entries[key], mime);
    }
  }
  return null;
}

/**
 * Detecta el idioma del tema. Estrategia por capas (orden de fiabilidad):
 *
 *  0. Tag <language> del config.xml del tema (declaración explícita).
 *     Es la fuente más fiable: el tema declara su propio idioma.
 *
 *  1. Etiqueta BUA ya extraída del CSS del tema:
 *       "Exemple"→ca · "Example"→en · "Ejemplo"→es
 *     Funciona para temas antiguos sin tag <language>.
 *
 *  2. Palabras clave en el ID del tema (fallback adicional):
 *       PhD / _en / -en → en
 *       Doctorat / Grau / Màster / _ca / _va → ca
 *
 *  3. Fallback final: 'es'
 */
function detectLanguage(
  themeId: string,
  buaStyles?: BuaBoxStyles,
  configLang?: PrintLanguage | null,
): PrintLanguage {
  // Capa 0 — declaración explícita del config.xml (máxima prioridad)
  if (configLang) return configLang;

  // Capa 1 — etiqueta BUA (discrimina con precisión entre es/en/ca)
  if (buaStyles) {
    const label = buaStyles.ejemplo.label.toLowerCase().trim();
    if (label === 'exemple') return 'ca';
    if (label === 'example') return 'en';
    if (label === 'ejemplo') return 'es';
  }

  // Capa 2 — palabras clave del ID
  const id = themeId.toLowerCase();
  if (id.includes('phd') || id.includes('_en') || id.includes('-en')) return 'en';
  if (
    id.includes('doctorat') || id.includes('grau') ||
    id.includes('màster') || id.includes('mster') ||
    id.includes('_ca') || id.includes('_va') || id.includes('-ca')
  ) return 'ca';

  return 'es';
}

/**
 * Extrae colores, tipografías, estilos BUA e idioma del style.css del tema.
 * Recibe el themeId para usarlo como fallback de detección de idioma.
 */
function extractThemeStyles(entries: Record<string, Uint8Array>, themeId: string): {
  primaryColor: string;
  accentColor: string;
  fontFamilyTitle: string;
  fontFamilyBody: string;
  buaStyles: BuaBoxStyles;
  language: PrintLanguage;
} {
  // Idioma declarado en config.xml (si existe) — máxima prioridad
  const configLang = extractLanguageFromConfigXml(entries);

  const cssEntry = entries['style.css'];
  if (!cssEntry) {
    return {
      primaryColor: '#135d87',
      accentColor: '#deb13c',
      fontFamilyTitle: "'Georgia', serif",
      fontFamilyBody: "'Arial', sans-serif",
      buaStyles: DEFAULT_BUA_STYLES,
      language: detectLanguage(themeId, undefined, configLang),
    };
  }

  const css = new TextDecoder().decode(cssEntry);
  const buaStyles = extractBuaStyles(css);

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
    buaStyles,
    // Orden: config.xml → etiquetas BUA → palabras clave del ID → 'es'
    language: detectLanguage(themeId, buaStyles, configLang),
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
