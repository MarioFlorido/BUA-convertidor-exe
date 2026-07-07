/**
 * Optimización de imágenes embebidas para el PDF.
 *
 * Las imágenes del documento llegan como data URL base64 dentro del HTML de
 * los bloques. El material BUA es sobre todo capturas de pantalla (manuales
 * de uso): texto de menús y diálogos que debe quedar NÍTIDO en papel. Esa
 * prioridad fija la política:
 *
 *   - PNG primero. Una imagen solo se convierte a JPEG si su contenido es
 *     fotográfico (se clasifica midiendo la fracción de píxeles «planos»;
 *     ver FLAT_FRACTION_MIN). La compresión JPEG emborrona el texto de las
 *     capturas; PNG lo conserva píxel a píxel.
 *   - Transparencia (en cualquier formato: PNG, GIF, WebP…) → siempre PNG.
 *     Exportar a JPEG un canvas con alfa compone las zonas transparentes
 *     sobre NEGRO.
 *   - Redimensionado solo por encima de 2000×2800 px (~320 DPI a ancho útil
 *     de A4), reduciendo por mitades con imageSmoothingQuality 'high': un
 *     único drawImage con un factor grande emborrona el texto fino.
 *   - Una PNG que ya cumple los límites y se queda en PNG se deja INTACTA:
 *     recodificarla con canvas no aporta nada y suele pesar más.
 *   - Conserva el original si optimizar no reduce el peso (nunca empeora) y
 *     ante cualquier fallo (decodificación, canvas) conserva el original.
 *   - Ignora SVG (vectorial) y deja intacto cualquier src que no sea data:.
 *
 * Verificado con Chrome print-to-PDF: el PDF incrusta cada imagen a su
 * resolución intrínseca (los píxeles que salen de aquí son los que se
 * imprimen), siempre que ningún `filter` CSS la rasterice por el camino
 * (ver nota sobre drop-shadow en printStyles.css).
 *
 * Corre en el navegador (usa canvas). En entornos sin DOM (tests Node)
 * devuelve el HTML sin cambios.
 */

export interface ImageOptimizeOptions {
  /** Ancho máximo en px. Default 2000 (~320 DPI a ancho útil de A4). */
  maxWidth?: number;
  /** Alto máximo en px. Default 2800. */
  maxHeight?: number;
  /** Calidad JPEG 0..1, solo para imágenes fotográficas. Default 0.82. */
  quality?: number;
}

const DEFAULTS: Required<ImageOptimizeOptions> = {
  maxWidth: 2000,
  maxHeight: 2800,
  quality: 0.82,
};

/**
 * Umbral «captura/gráfico»: si al menos este porcentaje de píxeles es
 * (casi) idéntico a su vecino de la izquierda (tolerancia ±2 por canal), el
 * contenido es sintético —capturas de pantalla, diagramas— y se queda en PNG.
 * Las capturas superan de largo el 30 % (fondos y paneles planos, incluso
 * tras reescalar); las fotos de cámara (ruido de sensor, textura) quedan muy
 * por debajo. Se mide sobre los píxeles, no comparando pesos PNG/JPEG: tras
 * un reescalado suavizado el PNG de una captura engorda y una comparación de
 * pesos la clasificaba mal (acababa en JPEG con el texto emborronado).
 */
const FLAT_FRACTION_MIN = 0.3;

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

  // Procesar cada data URL única UNA sola vez, y en secuencia: deduplica el
  // trabajo (la misma imagen repetida en varios bloques) y acota el pico de
  // memoria (cada canvas grande son decenas de MB en crudo).
  const optimized = new Map<string, string | null>();
  for (const img of imgs) {
    const src = img.getAttribute('src') || '';
    if (!src.startsWith('data:image/')) continue;       // solo embebidas
    if (src.startsWith('data:image/svg')) continue;     // vectorial: no rasterizar
    if (optimized.has(src)) continue;
    try {
      const out = await optimizeDataUrl(src, opts);
      // Solo sustituir si realmente reduce el peso
      optimized.set(src, out && out.length < src.length ? out : null);
    } catch {
      /* cualquier fallo (decodificación, canvas) → conservar original */
      optimized.set(src, null);
    }
  }

  let changed = false;
  for (const img of imgs) {
    const out = optimized.get(img.getAttribute('src') || '');
    if (out) {
      img.setAttribute('src', out);
      changed = true;
    }
  }

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
  const canvas = drawScaled(
    img,
    Math.max(1, Math.round(w * scale)),
    Math.max(1, Math.round(h * scale)),
  );
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Una PNG ya dentro de límites que se quede en PNG no se toca (null →
  // conservar los bytes originales, ya sin pérdida y normalmente más ligeros
  // que el recodificado del canvas).
  const pngUntouched = scale === 1 && src.startsWith('data:image/png');

  const { alpha, flatFraction } = analyzePixels(ctx, canvas.width, canvas.height);

  // Transparencia (venga del formato que venga) → PNG obligatorio: exportar
  // a JPEG compondría el alfa sobre negro.
  // Contenido sintético (capturas, diagramas) → PNG: JPEG emborrona el texto.
  if (alpha || flatFraction >= FLAT_FRACTION_MIN) {
    return pngUntouched ? null : canvas.toDataURL('image/png');
  }

  // Fotográfico → JPEG (la guarda «nunca peor» del llamante protege el caso
  // raro en que no reduzca el peso).
  return canvas.toDataURL('image/jpeg', opts.quality);
}

/**
 * Dibuja la imagen al tamaño destino. Para reducciones grandes (≥2×) reduce
 * por mitades sucesivas: un único drawImage con un factor grande emborrona el
 * texto fino de las capturas incluso con imageSmoothingQuality 'high'.
 */
function drawScaled(
  img: HTMLImageElement,
  tw: number,
  th: number,
): HTMLCanvasElement | null {
  let source: HTMLImageElement | HTMLCanvasElement = img;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  while (sw >= tw * 2 && sh >= th * 2) {
    const half = document.createElement('canvas');
    half.width = Math.max(tw, Math.round(sw / 2));
    half.height = Math.max(th, Math.round(sh / 2));
    const hctx = half.getContext('2d');
    if (!hctx) return null;
    hctx.imageSmoothingEnabled = true;
    hctx.imageSmoothingQuality = 'high';
    hctx.drawImage(source, 0, 0, half.width, half.height);
    source = half;
    sw = half.width;
    sh = half.height;
  }

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, tw, th);
  return canvas;
}

/**
 * Analiza los píxeles del canvas en una sola pasada:
 *
 *  - `alpha`: transparencia real en el canal alfa. Se recorre completo (no
 *    muestreado): un falso negativo acabaría como JPEG con zonas NEGRAS. En
 *    cuanto aparece alfa se corta — la decisión ya está tomada.
 *  - `flatFraction`: fracción de píxeles (casi) idénticos a su vecino de la
 *    izquierda. Discrimina capturas/diagramas (mucho plano) de fotos (ruido
 *    de sensor y textura por todas partes).
 */
function analyzePixels(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): { alpha: boolean; flatFraction: number } {
  try {
    const data = ctx.getImageData(0, 0, w, h).data;
    let flat = 0;
    let compared = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 250) {
        return { alpha: true, flatFraction: 1 };
      }
      if ((i >> 2) % w === 0) continue; // primera columna: sin vecino izquierdo
      compared += 1;
      if (
        Math.abs(data[i] - data[i - 4]) <= 2 &&
        Math.abs(data[i + 1] - data[i - 3]) <= 2 &&
        Math.abs(data[i + 2] - data[i - 2]) <= 2
      ) {
        flat += 1;
      }
    }
    return { alpha: false, flatFraction: compared ? flat / compared : 1 };
  } catch {
    // getImageData puede fallar (canvas "tainted"); ante la duda, preservar PNG
    return { alpha: true, flatFraction: 1 };
  }
}
