/**
 * Optimización de imágenes embebidas para el PDF.
 *
 * Las imágenes del documento llegan como data URL base64 dentro del HTML de los
 * bloques. Sin tratar, una foto de cámara (varios MB, 4000+ px) se inyecta tal
 * cual: infla el HTML, ralentiza la paginación de Paged.js y engorda el PDF sin
 * ganancia visible (a 150–200 DPI en A4 no se aprovecha tanta resolución).
 *
 * Esta función, sobre el HTML ya montado:
 *   - redimensiona las imágenes que exceden el tamaño útil para A4,
 *   - recomprime a JPEG cuando no hay transparencia (PNG en caso contrario),
 *   - conserva el original si optimizar no reduce el peso (nunca empeora),
 *   - ignora SVG (vectorial) y deja intacto cualquier src que no sea data:.
 *
 * Corre en el navegador (usa canvas). En entornos sin DOM (tests Node) devuelve
 * el HTML sin cambios.
 */

export interface ImageOptimizeOptions {
  /** Ancho máximo en px. Default 1600 (suficiente para A4 a ~200 DPI). */
  maxWidth?: number;
  /** Alto máximo en px. Default 2200. */
  maxHeight?: number;
  /** Calidad JPEG 0..1. Default 0.82. */
  quality?: number;
}

const DEFAULTS: Required<ImageOptimizeOptions> = {
  maxWidth: 1600,
  maxHeight: 2200,
  quality: 0.82,
};

/**
 * Devuelve el HTML con las imágenes data: optimizadas para impresión.
 * No muta la entrada. Si no hay DOM disponible, devuelve el HTML tal cual.
 */
export async function optimizeImagesForPrint(
  html: string,
  options: ImageOptimizeOptions = {},
): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return html;

  const opts = { ...DEFAULTS, ...options };
  const doc = new DOMParser().parseFromString(
    `<!doctype html><html><body>${html}</body></html>`,
    'text/html',
  );
  const imgs = Array.from(doc.querySelectorAll('img'));
  if (imgs.length === 0) return html;

  let changed = false;
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') || '';
      if (!src.startsWith('data:image/')) return;       // solo embebidas
      if (src.startsWith('data:image/svg')) return;     // vectorial: no rasterizar
      try {
        const out = await optimizeDataUrl(src, opts);
        // Solo sustituir si realmente reduce el peso
        if (out && out.length < src.length) {
          img.setAttribute('src', out);
          changed = true;
        }
      } catch {
        /* cualquier fallo (decodificación, canvas) → conservar original */
      }
    }),
  );

  // Si ninguna imagen cambió, devolver el HTML original tal cual: evita que la
  // re-serialización del DOMParser altere entidades/atributos innecesariamente.
  return changed ? doc.body.innerHTML : html;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
    img.src = src;
  });
}

async function optimizeDataUrl(
  src: string,
  opts: Required<ImageOptimizeOptions>,
): Promise<string | null> {
  const img = await loadImage(src);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;

  const scale = Math.min(1, opts.maxWidth / w, opts.maxHeight / h);
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, tw, th);

  // PNG con transparencia real → mantener PNG; resto → JPEG (mejor compresión)
  const keepPng = src.startsWith('data:image/png') && hasAlpha(ctx, tw, th);
  return keepPng
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', opts.quality);
}

/**
 * Detecta transparencia muestreando el canal alfa. Muestreo disperso (1 de cada
 * ~17 píxeles) para que sea rápido aun en imágenes grandes; suficiente para
 * decidir si conviene preservar PNG.
 */
function hasAlpha(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4 * 17) {
      if (data[i] < 250) return true;
    }
    return false;
  } catch {
    // getImageData puede fallar (canvas "tainted"); ante la duda, preservar PNG
    return true;
  }
}
