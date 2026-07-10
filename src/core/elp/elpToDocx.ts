/**
 * Generador de Word (.docx) a partir de un .elp parseado (ver elpParser.ts).
 *
 * Convención de salida, pensada para re-importar el Word en el convertidor:
 *   - Título de página → Título 1..4 según su profundidad en el árbol.
 *   - Encabezados internos del contenido → se conservan (un h1 interno baja a
 *     Título 2 para no fabricar páginas fantasma al re-importar).
 *   - Título propio de un iDevice (si el autor puso uno) → párrafo en negrita.
 *   - Imágenes → incrustadas desde el propio ZIP; lo no representable en Word
 *     (iframes, vídeo, imágenes externas…) se sustituye por una nota visible
 *     y se acumula en `warnings`.
 *
 * La librería `docx` (MIT) se importa en diferido: Vite la separa en su propio
 * chunk y solo se descarga al usar esta utilidad.
 */

import type { ParsedElp } from './elpParser';
import type { FileChild, ISectionOptions, Paragraph, ParagraphChild } from 'docx';

type Docx = typeof import('docx');

export interface ElpDocxResult {
  blob: Blob;
  /** Incidencias de la generación (imágenes no encontradas, contenido omitido…). */
  warnings: string[];
}

/** Ancho máximo de imagen en px (~16 cm útiles de una página A4 a 96 ppp). */
const MAX_IMAGE_WIDTH_PX = 600;

interface BuildContext {
  docx: Docx;
  resources: Map<string, Uint8Array>;
  warnings: string[];
  pageTitle: string;
  /** Contador de listas numeradas: cada <ol> reinicia su numeración. */
  nextNumberingInstance: () => number;
}

export async function convertParsedElpToDocx(parsed: ParsedElp): Promise<ElpDocxResult> {
  const docx = await import('docx');
  const warnings: string[] = [];

  let numberingInstances = 0;
  const children: FileChild[] = [];

  for (const page of parsed.pages) {
    const ctx: BuildContext = {
      docx,
      resources: parsed.resources,
      warnings,
      pageTitle: page.title,
      nextNumberingInstance: () => {
        numberingInstances += 1;
        return numberingInstances;
      },
    };

    children.push(
      new docx.Paragraph({
        heading: headingForDepth(docx, page.depth),
        children: [new docx.TextRun(page.title)],
      }),
    );

    for (const idevice of page.idevices) {
      if (idevice.title) {
        children.push(
          new docx.Paragraph({
            spacing: { before: 240 },
            children: [new docx.TextRun({ text: idevice.title, bold: true })],
          }),
        );
      }
      for (const html of idevice.htmlFields) {
        children.push(...htmlToBlocks(html, ctx));
      }
    }
  }

  const document = new docx.Document({
    creator: parsed.author || 'ConvertidoreXe',
    title: parsed.title,
    description: 'Convertido desde eXeLearning clásico (.elp) por ConvertidoreXe',
    numbering: {
      config: [
        {
          reference: 'elp-lista-numerada',
          levels: [0, 1, 2, 3].map((level) => ({
            level,
            format: docx.LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: docx.AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [{ children } satisfies ISectionOptions],
  });

  const blob = await docx.Packer.toBlob(document);
  return { blob, warnings: [...new Set(warnings)] };
}

function headingForDepth(docx: Docx, depth: number): (typeof docx.HeadingLevel)[keyof typeof docx.HeadingLevel] {
  const levels = [
    docx.HeadingLevel.HEADING_1,
    docx.HeadingLevel.HEADING_2,
    docx.HeadingLevel.HEADING_3,
    docx.HeadingLevel.HEADING_4,
  ];
  return levels[Math.min(depth, levels.length - 1)];
}

// ── HTML → bloques de Word ────────────────────────────────────────────────────

function htmlToBlocks(html: string, ctx: BuildContext): FileChild[] {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  return blockify(body, ctx);
}

/**
 * Clases semánticas BUA (las mismas que HtmlTransformer.ts aplica al convertir
 * Word → ELPX) que puede traer un .elp si su contenido pasó antes por esta
 * misma app. Se reescriben como los marcadores [etiqueta]…[fin] que el resto
 * del pipeline (Limpiador, convertidor) ya sabe interpretar, en vez de perder
 * la caja en silencio como un párrafo normal más.
 */
const BUA_BOX_MARKERS: Record<string, string> = {
  bua_importante: 'importante',
  bua_ejemplo: 'ejemplo',
  bua_definicion: 'definición',
  bua_pie: 'pie',
};

function boxMarkerFor(el: Element): string | null {
  for (const cls of Array.from(el.classList)) {
    const marker = BUA_BOX_MARKERS[cls];
    if (marker) return marker;
  }
  return null;
}

function markerParagraph(ctx: BuildContext, text: string): Paragraph {
  const { docx } = ctx;
  return new docx.Paragraph({ children: [new docx.TextRun('[' + text + ']')] });
}

/** Convierte los hijos de un contenedor HTML en bloques de Word (párrafos y tablas). */
function blockify(container: Element, ctx: BuildContext): FileChild[] {
  const { docx } = ctx;
  const blocks: FileChild[] = [];
  /** Runs de texto suelto (nodos inline directos) pendientes de agrupar en un párrafo. */
  let looseRuns: ParagraphChild[] = [];

  const flushLooseRuns = () => {
    if (looseRuns.length > 0) {
      blocks.push(new docx.Paragraph({ children: looseRuns }));
      looseRuns = [];
    }
  };

  for (let node = container.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 3) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ');
      if (text.trim()) looseRuns.push(new docx.TextRun(text));
      continue;
    }
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case 'p': {
        flushLooseRuns();
        const runs = inlineRuns(el, ctx, {});
        if (runs.length > 0) blocks.push(makeParagraph(el, runs, ctx));
        break;
      }
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        flushLooseRuns();
        const runs = inlineRuns(el, ctx, {});
        if (runs.length === 0) break;
        // Un h1 interno baja a Título 2: el Título 1 queda reservado a páginas.
        const level = Math.max(Number(tag[1]), 2);
        const headings = [
          docx.HeadingLevel.HEADING_2,
          docx.HeadingLevel.HEADING_3,
          docx.HeadingLevel.HEADING_4,
          docx.HeadingLevel.HEADING_5,
          docx.HeadingLevel.HEADING_6,
        ];
        blocks.push(new docx.Paragraph({ heading: headings[level - 2], children: runs }));
        break;
      }
      case 'ul':
      case 'ol':
        flushLooseRuns();
        blocks.push(...listToParagraphs(el, ctx, 0, tag === 'ol' ? ctx.nextNumberingInstance() : null));
        break;
      case 'table':
        flushLooseRuns();
        blocks.push(tableToDocx(el, ctx));
        break;
      case 'blockquote': {
        flushLooseRuns();
        for (const inner of blockify(el, ctx)) {
          blocks.push(inner);
        }
        break;
      }
      case 'pre': {
        flushLooseRuns();
        blocks.push(...preToParagraphs(el, ctx));
        break;
      }
      case 'img': {
        flushLooseRuns();
        const image = imageToRun(el, ctx);
        if (image) blocks.push(new docx.Paragraph({ children: [image] }));
        break;
      }
      case 'iframe':
      case 'video':
      case 'audio':
      case 'object':
      case 'embed': {
        flushLooseRuns();
        const source = el.getAttribute('src') || el.getAttribute('data') || 'sin URL';
        ctx.warnings.push(`En la página «${ctx.pageTitle}»: contenido incrustado (${tag}) omitido: ${source}`);
        blocks.push(noticeParagraph(ctx, `[Contenido incrustado omitido: ${source}]`));
        break;
      }
      case 'hr':
      case 'style':
      case 'script':
        flushLooseRuns();
        break;
      default: {
        // div, section, figure, span-bloque…: si contiene bloques se recorre como
        // contenedor; si solo tiene inlines, se convierte en un párrafo.
        flushLooseRuns();
        const boxMarker = boxMarkerFor(el);
        if (boxMarker) {
          blocks.push(markerParagraph(ctx, boxMarker));
          blocks.push(...blockify(el, ctx));
          blocks.push(markerParagraph(ctx, 'fin'));
        } else if (containsBlockElements(el)) {
          blocks.push(...blockify(el, ctx));
        } else {
          const runs = inlineRuns(el, ctx, {});
          if (runs.length > 0) blocks.push(makeParagraph(el, runs, ctx));
        }
        break;
      }
    }
  }

  flushLooseRuns();
  return blocks;
}

const BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table',
  'blockquote', 'pre', 'div', 'section', 'article', 'figure', 'iframe', 'video', 'audio',
]);

function containsBlockElements(el: Element): boolean {
  for (let child = el.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1 && BLOCK_TAGS.has((child as Element).tagName.toLowerCase())) return true;
  }
  return false;
}

function makeParagraph(el: Element, runs: ParagraphChild[], ctx: BuildContext): Paragraph {
  const { docx } = ctx;
  const align = /text-align:\s*(center|right|justify)/i.exec(el.getAttribute('style') ?? '')?.[1]?.toLowerCase();
  return new docx.Paragraph({
    children: runs,
    alignment:
      align === 'center'
        ? docx.AlignmentType.CENTER
        : align === 'right'
          ? docx.AlignmentType.RIGHT
          : align === 'justify'
            ? docx.AlignmentType.JUSTIFIED
            : undefined,
  });
}

function noticeParagraph(ctx: BuildContext, text: string): Paragraph {
  const { docx } = ctx;
  return new docx.Paragraph({
    children: [new docx.TextRun({ text, italics: true, color: '888888' })],
  });
}

// ── Inlines ───────────────────────────────────────────────────────────────────

interface InlineStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  subScript?: boolean;
  superScript?: boolean;
}

function inlineRuns(container: Element, ctx: BuildContext, style: InlineStyle): ParagraphChild[] {
  const { docx } = ctx;
  const runs: ParagraphChild[] = [];

  for (let node = container.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 3) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ');
      if (text) {
        runs.push(
          new docx.TextRun({
            text,
            bold: style.bold,
            italics: style.italics,
            underline: style.underline ? {} : undefined,
            subScript: style.subScript,
            superScript: style.superScript,
          }),
        );
      }
      continue;
    }
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case 'strong':
      case 'b':
        runs.push(...inlineRuns(el, ctx, { ...style, bold: true }));
        break;
      case 'em':
      case 'i':
        runs.push(...inlineRuns(el, ctx, { ...style, italics: true }));
        break;
      case 'u':
        runs.push(...inlineRuns(el, ctx, { ...style, underline: true }));
        break;
      case 'sub':
        runs.push(...inlineRuns(el, ctx, { ...style, subScript: true }));
        break;
      case 'sup':
        runs.push(...inlineRuns(el, ctx, { ...style, superScript: true }));
        break;
      case 'br':
        runs.push(new docx.TextRun({ text: '', break: 1 }));
        break;
      case 'img': {
        const image = imageToRun(el, ctx);
        if (image) runs.push(image);
        break;
      }
      case 'a': {
        const href = el.getAttribute('href') ?? '';
        const childRuns = inlineRuns(el, ctx, style);
        if (/^(https?:|mailto:)/i.test(href) && childRuns.length > 0) {
          runs.push(new docx.ExternalHyperlink({ children: childRuns, link: href }));
        } else {
          // Enlaces internos de eXe (exe-node:…) y anclas: se conserva solo el texto.
          runs.push(...childRuns);
          // Si apuntaba a un recurso del paquete (un PDF adjunto, p. ej.), se avisa:
          // Word no puede incrustarlo y el enlace deja de funcionar.
          const attachment = ctx.resources.has(normalizeResourceName(href)) ? normalizeResourceName(href) : null;
          if (attachment) {
            ctx.warnings.push(
              `En la página «${ctx.pageTitle}»: archivo adjunto no incluido en el Word: ${attachment} (su enlace queda como texto).`,
            );
            runs.push(new docx.TextRun({ text: ` [adjunto: ${attachment}]`, italics: true, color: '888888' }));
          }
        }
        break;
      }
      default:
        runs.push(...inlineRuns(el, ctx, style));
        break;
    }
  }

  return runs;
}

// ── Listas ────────────────────────────────────────────────────────────────────

function listToParagraphs(
  listEl: Element,
  ctx: BuildContext,
  level: number,
  numberingInstance: number | null,
): Paragraph[] {
  const { docx } = ctx;
  const paragraphs: Paragraph[] = [];

  for (let child = listEl.firstChild; child; child = child.nextSibling) {
    if (child.nodeType !== 1 || (child as Element).tagName.toLowerCase() !== 'li') continue;
    const li = child as Element;

    // Las sublistas se procesan aparte para que el texto del <li> no las arrastre.
    const sublists: Element[] = [];
    const liClone = li.cloneNode(true) as Element;
    for (const nested of Array.from(liClone.querySelectorAll(':scope > ul, :scope > ol'))) {
      nested.remove();
    }
    for (let liChild = li.firstChild; liChild; liChild = liChild.nextSibling) {
      if (liChild.nodeType === 1 && /^(ul|ol)$/i.test((liChild as Element).tagName)) {
        sublists.push(liChild as Element);
      }
    }

    const runs = inlineRuns(liClone, ctx, {});
    if (runs.length > 0) {
      paragraphs.push(
        new docx.Paragraph({
          children: runs,
          ...(numberingInstance !== null
            ? { numbering: { reference: 'elp-lista-numerada', level: Math.min(level, 3), instance: numberingInstance } }
            : { bullet: { level: Math.min(level, 3) } }),
        }),
      );
    }

    for (const sublist of sublists) {
      const nestedOrdered = sublist.tagName.toLowerCase() === 'ol';
      paragraphs.push(
        ...listToParagraphs(sublist, ctx, level + 1, nestedOrdered ? (numberingInstance ?? ctx.nextNumberingInstance()) : null),
      );
    }
  }

  return paragraphs;
}

// ── Tablas ────────────────────────────────────────────────────────────────────

function tableToDocx(tableEl: Element, ctx: BuildContext): FileChild {
  const { docx } = ctx;
  const rows: InstanceType<Docx['TableRow']>[] = [];

  for (const tr of Array.from(tableEl.getElementsByTagName('tr'))) {
    const cells: InstanceType<Docx['TableCell']>[] = [];
    for (let cellNode = tr.firstChild; cellNode; cellNode = cellNode.nextSibling) {
      if (cellNode.nodeType !== 1) continue;
      const cellEl = cellNode as Element;
      const cellTag = cellEl.tagName.toLowerCase();
      if (cellTag !== 'td' && cellTag !== 'th') continue;

      let cellBlocks = containsBlockElements(cellEl)
        ? blockify(cellEl, ctx)
        : [new docx.Paragraph({ children: inlineRuns(cellEl, ctx, cellTag === 'th' ? { bold: true } : {}) })];
      if (cellBlocks.length === 0) cellBlocks = [new docx.Paragraph({ children: [] })];

      cells.push(
        new docx.TableCell({
          children: cellBlocks,
          columnSpan: numericAttr(cellEl, 'colspan'),
          rowSpan: numericAttr(cellEl, 'rowspan'),
        }),
      );
    }
    if (cells.length > 0) rows.push(new docx.TableRow({ children: cells }));
  }

  if (rows.length === 0) return new docx.Paragraph({ children: [] });
  return new docx.Table({
    rows,
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
  });
}

function numericAttr(el: Element, name: string): number | undefined {
  const value = Number.parseInt(el.getAttribute(name) ?? '', 10);
  return Number.isFinite(value) && value > 1 ? value : undefined;
}

// ── Bloques preformateados ────────────────────────────────────────────────────

function preToParagraphs(preEl: Element, ctx: BuildContext): Paragraph[] {
  const { docx } = ctx;
  return (preEl.textContent ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(
      (line) =>
        new docx.Paragraph({
          children: [new docx.TextRun({ text: line, font: 'Courier New' })],
        }),
    );
}

// ── Imágenes ──────────────────────────────────────────────────────────────────

type DocxImageType = 'png' | 'jpg' | 'gif' | 'bmp';

function imageToRun(imgEl: Element, ctx: BuildContext): ParagraphChild | null {
  const { docx } = ctx;
  const src = imgEl.getAttribute('src') ?? '';

  if (/^https?:/i.test(src)) {
    ctx.warnings.push(`En la página «${ctx.pageTitle}»: imagen externa no incluida: ${src}`);
    return new docx.TextRun({ text: `[Imagen externa: ${src}]`, italics: true, color: '888888' });
  }

  const resolved = resolveImageData(src, ctx);
  if (!resolved) {
    ctx.warnings.push(`En la página «${ctx.pageTitle}»: imagen no encontrada en el paquete: ${src}`);
    return new docx.TextRun({ text: `[Imagen no encontrada: ${src}]`, italics: true, color: '888888' });
  }

  const { data, type } = resolved;
  if (!type) {
    ctx.warnings.push(`En la página «${ctx.pageTitle}»: formato de imagen no compatible con Word, omitida: ${src}`);
    return new docx.TextRun({ text: `[Imagen omitida: ${src}]`, italics: true, color: '888888' });
  }

  const attrWidth = Number.parseInt(imgEl.getAttribute('width') ?? '', 10);
  const attrHeight = Number.parseInt(imgEl.getAttribute('height') ?? '', 10);
  let size =
    Number.isFinite(attrWidth) && attrWidth > 0 && Number.isFinite(attrHeight) && attrHeight > 0
      ? { width: attrWidth, height: attrHeight }
      : (sniffImageSize(data, type) ?? { width: 400, height: 300 });

  if (size.width > MAX_IMAGE_WIDTH_PX) {
    size = {
      width: MAX_IMAGE_WIDTH_PX,
      height: Math.max(1, Math.round((size.height * MAX_IMAGE_WIDTH_PX) / size.width)),
    };
  }

  return new docx.ImageRun({
    type,
    data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
    transformation: size,
    altText: (() => {
      const alt = imgEl.getAttribute('alt') ?? '';
      return alt ? { title: alt, description: alt, name: alt } : undefined;
    })(),
  });
}

function resolveImageData(src: string, ctx: BuildContext): { data: Uint8Array; type: DocxImageType | null } | null {
  // Imágenes pegadas como data URI (poco habitual pero posible desde TinyMCE).
  const dataUriMatch = /^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i.exec(src);
  if (dataUriMatch) {
    try {
      const binary = atob(dataUriMatch[2].replace(/\s+/g, ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return { data: bytes, type: normalizeImageType(dataUriMatch[1]) };
    } catch {
      return null;
    }
  }

  const name = normalizeResourceName(src);
  const data = ctx.resources.get(name) ?? ctx.resources.get(name.replace(/ /g, '_'));
  if (!data) return null;
  return { data, type: normalizeImageType(name.split('.').pop() ?? '') };
}

/**
 * Nombre de recurso del paquete a partir de una ruta del HTML: "resources/X",
 * "./resources/X" o el nombre a secas, a veces URL-encoded. En el ZIP los
 * recursos están en la raíz, así que basta el nombre de archivo.
 */
function normalizeResourceName(src: string): string {
  let name = src.replace(/^\.?\/*/, '').replace(/^resources\//i, '');
  name = name.split('/').pop() ?? name;
  try {
    return decodeURIComponent(name);
  } catch {
    return name; // se deja tal cual si no es un URI válido
  }
}

function normalizeImageType(extension: string): DocxImageType | null {
  const ext = extension.toLowerCase();
  if (ext === 'png') return 'png';
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  if (ext === 'gif') return 'gif';
  if (ext === 'bmp') return 'bmp';
  return null; // svg, webp… no compatibles de forma fiable con Word
}

/**
 * Dimensiones leídas de la cabecera del archivo (PNG/JPEG/GIF/BMP). Se usa
 * cuando el HTML no trae width/height. Devuelve null si no se puede determinar.
 */
export function sniffImageSize(data: Uint8Array, type: DocxImageType): { width: number; height: number } | null {
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

function sniffJpegSize(data: Uint8Array): { width: number; height: number } | null {
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
