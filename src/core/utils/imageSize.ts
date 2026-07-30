/**
 * Dimensiones intrínsecas de una imagen leídas de su cabecera binaria.
 *
 * Sin canvas y sin decodificar: basta con los primeros bytes del archivo. Lo
 * usan las dos direcciones del convertidor:
 *   - elp→docx: tamaño con el que insertar la imagen en Word cuando el HTML de
 *     eXeLearning no trae width/height.
 *   - docx→elpx/pdf: tamaño de reserva de un logo en línea cuando no se ha
 *     podido leer el tamaño de presentación real del DOCX.
 *
 * Vive en utils (y no en elp/) porque elpToDocx arrastra la librería `docx`, que
 * viaja en un chunk diferido: importar desde ahí lo traería al chunk principal.
 */

export type SniffableImageType = 'png' | 'jpg' | 'gif' | 'bmp';

export interface ImagePixelSize {
  width: number;
  height: number;
}

/**
 * Dimensiones leídas de la cabecera del archivo (PNG/JPEG/GIF/BMP). Se usa
 * cuando el HTML no trae width/height. Devuelve null si no se puede determinar.
 */
export function sniffImageSize(data: Uint8Array, type: SniffableImageType): ImagePixelSize | null {
  try {
    if (type === 'png' && data.length >= 24) {
      return { width: readU32BE(data, 16), height: readU32BE(data, 20) };
    }
    if (type === 'gif' && data.length >= 10) {
      return { width: data[6] | (data[7] << 8), height: data[8] | (data[9] << 8) };
    }
    if (type === 'bmp' && data.length >= 26) {
      return { width: readU32LE(data, 18), height: Math.abs(readI32LE(data, 22)) };
    }
    if (type === 'jpg') {
      return sniffJpegSize(data);
    }
  } catch {
    // caída al tamaño por defecto
  }
  return null;
}

/**
 * Dimensiones de una imagen embebida como data URL base64 (lo que entrega
 * Mammoth). Devuelve null para SVG/WebP (no se pueden sniffear con fiabilidad)
 * y ante cualquier base64 corrupto.
 */
export function sniffDataUrlSize(src: string): ImagePixelSize | null {
  const match = /^data:image\/(png|jpe?g|gif|bmp);base64,([\s\S]+)$/i.exec(src.trim());
  if (!match) return null;

  const type = normalizeSniffableType(match[1]);
  if (!type) return null;

  try {
    // Solo hacen falta los primeros bytes; para JPEG la cabecera SOF puede
    // estar más adentro, así que se decodifica hasta 64 KB y basta.
    const binary = atob(match[2].replace(/\s+/g, '').slice(0, 87400));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return sniffImageSize(bytes, type);
  } catch {
    return null;
  }
}

function normalizeSniffableType(subtype: string): SniffableImageType | null {
  const value = subtype.toLowerCase();
  if (value === 'png') return 'png';
  if (value === 'jpg' || value === 'jpeg') return 'jpg';
  if (value === 'gif') return 'gif';
  if (value === 'bmp') return 'bmp';
  return null;
}

function sniffJpegSize(data: Uint8Array): ImagePixelSize | null {
  let offset = 2; // tras el marcador SOI (FFD8)
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = data[offset + 1];
    // SOF0..SOF15 (excepto DHT/JPG/DAC): contienen las dimensiones.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: (data[offset + 5] << 8) | data[offset + 6],
        width: (data[offset + 7] << 8) | data[offset + 8],
      };
    }
    const length = (data[offset + 2] << 8) | data[offset + 3];
    offset += 2 + length;
  }
  return null;
}

function readU32BE(data: Uint8Array, offset: number): number {
  return ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
}

function readU32LE(data: Uint8Array, offset: number): number {
  return ((data[offset + 3] << 24) | (data[offset + 2] << 16) | (data[offset + 1] << 8) | data[offset]) >>> 0;
}

function readI32LE(data: Uint8Array, offset: number): number {
  return (data[offset + 3] << 24) | (data[offset + 2] << 16) | (data[offset + 1] << 8) | data[offset];
}
