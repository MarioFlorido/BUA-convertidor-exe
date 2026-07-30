/**
 * Tamaño de PRESENTACIÓN de las imágenes de un DOCX (el que se ve en Word).
 *
 * Por qué hace falta: Mammoth entrega las imágenes como data URL y descarta el
 * tamaño. Su lector (`readImage` en docx/body-reader.js) construye el elemento
 * con readImage/altText/contentType y nada más, así que `wp:extent` —el tamaño
 * con el que el autor ve la imagen en Word— se pierde en el primer paso y no se
 * puede recuperar ni con `transformDocument` (el dato nunca entra en el modelo).
 *
 * Sin ese dato no se puede respetar el tamaño de un logo insertado en línea: el
 * navegador lo pintaría a su tamaño intrínseco en píxeles, que en un logo
 * vectorizado a PNG suele ser 10 veces el tamaño real de uso.
 *
 * Estrategia: leer `word/document.xml` del ZIP y recorrer los dibujos EN ORDEN
 * DE DOCUMENTO, que es el mismo orden en que Mammoth emite los <img>. El
 * emparejamiento es posicional, con una comprobación de recuento como red de
 * seguridad (ver `assignDocxImageSizes`): si los números no cuadran, se
 * descarta toda la información de tamaño en lugar de arriesgar asignaciones
 * cruzadas.
 */

import { unzipSync, strFromU8 } from 'fflate';

/** Tamaño de presentación en píxeles CSS (96 ppp). */
export interface DocxImageSize {
  widthPx: number;
  heightPx: number;
}

/** EMU por píxel CSS: 914400 EMU/pulgada ÷ 96 px/pulgada. */
const EMU_PER_PX = 9525;

/**
 * Tamaños de presentación de las imágenes del cuerpo del documento, en orden.
 * Una entrada `null` es una imagen cuyo tamaño no se ha podido determinar
 * (VML antiguo, dibujo sin `wp:extent`): mantiene la posición para que el
 * emparejamiento no se descuadre.
 *
 * Solo mira `word/document.xml`: las imágenes de cabeceras y pies viven en
 * otras partes del paquete y Mammoth tampoco las convierte, así que ambos
 * lados de la comparación coinciden.
 */
export function readDocxImageSizes(buffer: ArrayBuffer): Array<DocxImageSize | null> {
  let xml: string;
  try {
    const unzipped = unzipSync(new Uint8Array(buffer), {
      filter: (entry) => entry.name === 'word/document.xml',
    });
    const entry = unzipped['word/document.xml'];
    if (!entry) return [];
    xml = strFromU8(entry);
  } catch {
    return []; // no es un ZIP legible: se renuncia al tamaño, no se rompe nada
  }

  // Word duplica cada dibujo moderno con una copia VML dentro de mc:Fallback
  // (compatibilidad con Word 2003). Contarla sería contar cada imagen dos veces.
  const body = xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, '');

  const sizes: Array<DocxImageSize | null> = [];
  // Un "contenedor de imagen" por cada <img> que emitirá Mammoth: un dibujo
  // DrawingML (wp:inline / wp:anchor) o una imagen VML antigua (w:pict).
  const containers = /<wp:(inline|anchor)\b[\s\S]*?<\/wp:\1>|<w:pict\b[\s\S]*?<\/w:pict>/g;
  for (const match of body.matchAll(containers)) {
    const container = match[0];
    // Sin referencia a un archivo de imagen no hay <img> en el HTML: un gráfico,
    // un SmartArt o una forma vacía no cuentan para el emparejamiento.
    if (!/<a:blip\b[^>]*r:(embed|link)=|<v:imagedata\b[^>]*r:id=/.test(container)) {
      continue;
    }
    sizes.push(readExtent(container));
  }

  return sizes;
}

/** Tamaño de presentación de un contenedor, o null si no lo declara. */
function readExtent(container: string): DocxImageSize | null {
  const extent = /<wp:extent\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/.exec(container);
  if (!extent) return null;

  const widthPx = Math.round(Number(extent[1]) / EMU_PER_PX);
  const heightPx = Math.round(Number(extent[2]) / EMU_PER_PX);
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) || widthPx < 1 || heightPx < 1) {
    return null;
  }
  return { widthPx, heightPx };
}

/**
 * Anota el HTML de Mammoth con el tamaño real de cada imagen en Word, como
 * atributos `data-bua-w` / `data-bua-h`. Los consume `classifyInlineImages`,
 * que los borra después: no llegan a la salida.
 *
 * Emparejamiento posicional con red de seguridad: si el número de dibujos del
 * DOCX no coincide con el de <img> del HTML (imágenes anidadas en cuadros de
 * texto, dibujos con varios `a:blip`…), devuelve el HTML intacto. Es preferible
 * quedarse sin la información —el logo se pintará a su tamaño intrínseco, que es
 * el comportamiento de siempre— que asignar tamaños cruzados.
 */
export function assignDocxImageSizes(html: string, sizes: Array<DocxImageSize | null>): string {
  if (sizes.length === 0 || !html.includes('<img')) return html;

  const imgTag = /<img\b[^>]*>/gi;
  const total = (html.match(imgTag) || []).length;
  if (total !== sizes.length) return html;

  let index = 0;
  return html.replace(imgTag, (tag) => {
    const size = sizes[index];
    index += 1;
    if (!size) return tag;
    const attrs = ` data-bua-w="${size.widthPx}" data-bua-h="${size.heightPx}"`;
    // Mammoth cierra sus <img> con " />"; se contempla también "<img ...>".
    return tag.endsWith('/>')
      ? `${tag.slice(0, -2).trimEnd()}${attrs} />`
      : `${tag.slice(0, -1).trimEnd()}${attrs}>`;
  });
}
