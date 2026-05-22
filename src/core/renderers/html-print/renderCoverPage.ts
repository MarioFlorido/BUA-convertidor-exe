import type { SemanticDocument } from '../../models/SemanticDocument';
import type { PrintThemeAssets } from './PrintThemeLoader';

/**
 * Metadatos opcionales para la portada PDF.
 * Viven exclusivamente en el renderer print — no contaminan SemanticDocument.
 */
export interface CoverPageMeta {
  /** Autor o autores del documento */
  author?: string;
  /** Nombre de la organización/universidad */
  organization?: string;
  /** Licencia del documento (ej: "CC BY-SA 4.0") */
  license?: string;
  /** Fecha (ej: "2026"). Si se omite, no se muestra. */
  date?: string;
}

/**
 * Genera el HTML de la portada PDF.
 *
 * Estructura de salida:
 *   <section class="cover-page">
 *     [imagen de fondo + overlay si existe portada_pdf.*]
 *     <div class="cover-content">
 *       [logo] [título] [subtítulo] [autor] [org] [fecha] [licencia]
 *     </div>
 *   </section>
 *
 * La sección usa page: cover con @page cover { margin: 0 } (vía printStyles.css)
 * para ocupar la página entera sin márgenes.
 *
 * @param doc     Documento semántico (fuente de título y subtítulo)
 * @param assets  Assets del tema cargados por PrintThemeLoader
 * @param meta    Metadatos opcionales (autor, org, licencia, fecha)
 */
export function renderCoverPage(
  doc: SemanticDocument,
  assets: PrintThemeAssets,
  meta: CoverPageMeta = {},
): string {
  const bgStyle = assets.coverImageDataUrl
    ? buildImageBackground(assets.coverImageDataUrl)
    : buildColorBackground(assets.primaryColor, assets.accentColor);

  const logoHtml = assets.logoDataUrl
    ? `<img class="cover-logo" src="${assets.logoDataUrl}" alt="Logo" />`
    : '';

  const subtitleHtml = doc.subtitle
    ? `<p class="cover-subtitle">${escHtml(doc.subtitle)}</p>`
    : '';

  const authorHtml = meta.author
    ? `<p class="cover-author">${escHtml(meta.author)}</p>`
    : '';

  const orgHtml = meta.organization
    ? `<p class="cover-organization">${escHtml(meta.organization)}</p>`
    : '';

  const dateHtml = meta.date
    ? `<p class="cover-date">${escHtml(meta.date)}</p>`
    : '';

  const licenseHtml = meta.license
    ? `<p class="cover-license">${escHtml(meta.license)}</p>`
    : '';

  // Overlay sólo si hay imagen de fondo (mejora legibilidad del texto sobre foto)
  const overlayHtml = assets.coverImageDataUrl
    ? `<div class="cover-overlay"></div>`
    : '';

  return `
<section class="cover-page" style="${bgStyle}">
  ${overlayHtml}
  <div class="cover-content">
    ${logoHtml}
    <h1 class="cover-title">${escHtml(doc.title)}</h1>
    ${subtitleHtml}
    <div class="cover-meta">
      ${authorHtml}
      ${orgHtml}
      ${dateHtml}
      ${licenseHtml}
    </div>
  </div>
</section>`.trim();
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

function buildImageBackground(dataUrl: string): string {
  return `background-image: url('${dataUrl}'); background-size: cover; background-position: center;`;
}

function buildColorBackground(primary: string, accent: string): string {
  // Degradado editorial: primario arriba, ligeramente más oscuro abajo
  return `background: linear-gradient(160deg, ${primary} 0%, ${darken(primary, 0.18)} 60%, ${accent}33 100%);`;
}

/** Oscurece un color hex en un porcentaje [0-1] */
function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) * (1 - amount)) | 0;
  const g = Math.max(0, ((n >> 8) & 0xff) * (1 - amount)) | 0;
  const b = Math.max(0, (n & 0xff) * (1 - amount)) | 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
