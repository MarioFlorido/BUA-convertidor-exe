/**
 * ImageExtractor — Extrae imágenes embebidas (data URL base64) a archivos binarios.
 *
 * Word/Mammoth entregan las imágenes como data URLs base64 dentro del HTML.
 * Dejarlas embebidas en el content.xml del ELPX lo infla (+33% por la propia
 * codificación base64, y además se duplican en htmlView + jsonProperties).
 *
 * Este módulo las saca a archivos:
 *  - Decodifica cada data:image a binario. Es una operación SIN PÉRDIDA: base64
 *    es codificación de texto reversible, no recomprime ni redimensiona.
 *  - Nombra cada archivo por el hash SHA-256 de su contenido. Imágenes idénticas
 *    comparten archivo; cualquier diferencia de bytes produce un hash distinto y,
 *    por tanto, un archivo distinto (nunca se confunden dos imágenes parecidas).
 *  - Reescribe el src del <img> con la ruta del archivo.
 *
 * Es un módulo PURO: no toca el pipeline. Quien lo use decide dónde se colocan
 * los archivos dentro del ZIP.
 */

/** Carpeta dentro del ELPX donde se guardan las imágenes extraídas. */
export const RESOURCE_DIR = 'content/resources';

export interface ExtractedImages {
  /** HTML con los <img> reescritos para apuntar a los archivos. */
  html: string;
  /** Archivos a añadir al ZIP: ruta relativa → bytes. */
  files: Map<string, Uint8Array>;
}

/**
 * Extrae a archivos las imágenes data URL de un fragmento de HTML.
 *
 * La ruta de cada archivo se deriva del hash de su contenido, así que es
 * determinista: la misma imagen siempre produce la misma ruta. Eso deduplica
 * automáticamente (dos bloques con la misma imagen apuntan al mismo archivo).
 */
export async function extractImages(html: string): Promise<ExtractedImages> {
  const files = new Map<string, Uint8Array>();

  // Recoger las data URLs únicas presentes en el HTML
  const found = new Map<string, { subtype: string; base64: string }>();
  const regex = /data:image\/([a-z0-9+.-]+);base64,([A-Za-z0-9+/=]+)/gi;
  for (const match of html.matchAll(regex)) {
    found.set(match[0], { subtype: match[1], base64: match[2] });
  }

  if (found.size === 0) {
    return { html, files };
  }

  // Decodificar, hashear y construir la ruta de cada imagen
  const urlToPath = new Map<string, string>();
  for (const [dataUrl, { subtype, base64 }] of found) {
    const bytes = base64ToBytes(base64);
    const hash = await sha256Hex(bytes);
    const path = `${RESOURCE_DIR}/img_${hash}.${normalizeExtension(subtype)}`;
    files.set(path, bytes);
    urlToPath.set(dataUrl, path);
  }

  // Sustituir cada data URL por su ruta (split/join reemplaza TODAS las
  // ocurrencias y evita problemas con los caracteres especiales del base64)
  let result = html;
  for (const [dataUrl, path] of urlToPath) {
    result = result.split(dataUrl).join(path);
  }

  return { html: result, files };
}

/** Decodifica base64 a bytes. Reversible y sin pérdida. */
function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** SHA-256 del contenido en hexadecimal. Discrimina cualquier cambio de bytes. */
async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Normaliza el subtipo MIME a una extensión de archivo. */
function normalizeExtension(subtype: string): string {
  const map: Record<string, string> = {
    jpeg: 'jpg',
    jpg: 'jpg',
    png: 'png',
    gif: 'gif',
    webp: 'webp',
    'svg+xml': 'svg',
    bmp: 'bmp',
  };
  return map[subtype.toLowerCase()] || 'png';
}
