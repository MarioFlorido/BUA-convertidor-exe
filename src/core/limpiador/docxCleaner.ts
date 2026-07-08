/**
 * Limpiador de Word — lógica de análisis y limpieza de DOCX.
 *
 * Portado de la utilidad standalone "Limpiador ConvertidoreXe" de Silvia Gomis
 * (HTML + runtime DC) a TypeScript, sin dependencias externas: el ZIP se lee y
 * reescribe a mano y la compresión usa CompressionStream/DecompressionStream
 * del navegador. Todo se procesa en local, nada se sube a ningún servidor.
 *
 * Flujo: load(file) → CleanerBlock[] (revisión del usuario) → generate(...) →
 * Blob .docx limpio listo para pasar por el convertidor.
 */

const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const TRACK = ['w:p', 'w:tbl', 'w:sdt'];

export type BlockKind =
  | 'heading' | 'box' | 'table' | 'cover' | 'toc' | 'empty' | 'list' | 'para';

/** Rol editable de cada bloque: qué se hará con él al generar. */
export type BlockRole =
  | 'keep' | 'remove' | 'normal'
  | 'h1' | 'h2' | 'h3' | 'h4'
  | 'box:importante' | 'box:definición' | 'box:ejemplo' | 'box:pie'
  | 'table:horizontal' | 'table:vertical';

export interface CleanerBlock {
  i: number;
  kind: BlockKind;
  role: BlockRole;
  text: string;
}

export interface CleanerOptions {
  /** Borrar formato visual conservando enlaces e imágenes. */
  stripFormat: boolean;
  /** Quitar encabezado y pie de página. */
  removeHeaderFooter: boolean;
}

interface ZipEntry {
  flags: number;
  method: number;
  mtime: number;
  mdate: number;
  crc: number;
  compSize: number;
  uncompSize: number;
  lho: number;
  name: string;
}

// ── Helpers XML ──────────────────────────────────────────────────────────────

function ptext(p: Element): string {
  let t = '';
  for (const x of Array.from(p.getElementsByTagName('w:t'))) t += x.textContent;
  return t;
}

function pstyleId(p: Element): string {
  const s = p.getElementsByTagName('w:pStyle')[0];
  return s ? s.getAttribute('w:val') ?? '' : '';
}

function hasImg(p: Element): boolean {
  return p.getElementsByTagName('w:drawing').length > 0;
}

/** Crea un párrafo plano con el texto dado (marcadores [etiqueta]/[fin]). */
function mkParagraph(doc: XMLDocument, text: string): Element {
  const p = doc.createElementNS(WNS, 'w:p');
  const r = doc.createElementNS(WNS, 'w:r');
  const t = doc.createElementNS(WNS, 'w:t');
  t.setAttribute('xml:space', 'preserve');
  t.textContent = text;
  r.appendChild(t);
  p.appendChild(r);
  return p;
}

function getPPr(p: Element): Element | null {
  for (const c of Array.from(p.children)) if (c.nodeName === 'w:pPr') return c;
  return null;
}

function setStyleNode(doc: XMLDocument, p: Element, val: string | null): void {
  let pPr = getPPr(p);
  if (val === null) {
    if (pPr) {
      const st = pPr.getElementsByTagName('w:pStyle')[0];
      if (st) st.remove();
    }
    return;
  }
  if (!pPr) {
    pPr = doc.createElementNS(WNS, 'w:pPr');
    p.insertBefore(pPr, p.firstChild);
  }
  let st = pPr.getElementsByTagName('w:pStyle')[0];
  if (!st) {
    st = doc.createElementNS(WNS, 'w:pStyle');
    pPr.insertBefore(st, pPr.firstChild);
  }
  st.setAttribute('w:val', val);
}

// ── CRC32 ────────────────────────────────────────────────────────────────────

let crcTable: Uint32Array | null = null;

function crc32(b: Uint8Array<ArrayBuffer>): number {
  if (!crcTable) {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    crcTable = t;
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── Cleaner ──────────────────────────────────────────────────────────────────

export class DocxCleaner {
  private buf!: Uint8Array<ArrayBuffer>;
  private entries: ZipEntry[] = [];
  private xmlDoc!: XMLDocument;
  private stylesDoc!: XMLDocument;
  private body!: Element;
  private styleMap: Record<number, string> = {};

  // ── ZIP ────────────────────────────────────────────────────────────────────

  private rU16(b: Uint8Array, o: number): number {
    return b[o] | (b[o + 1] << 8);
  }

  private rU32(b: Uint8Array, o: number): number {
    return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  }

  private parseZip(buf: Uint8Array<ArrayBuffer>): void {
    this.buf = buf;
    let eocd = -1;
    for (let i = buf.length - 22; i >= 0; i--) {
      if (this.rU32(buf, i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('No es un .docx válido');
    const cdCount = this.rU16(buf, eocd + 10);
    const cdOff = this.rU32(buf, eocd + 16);
    const entries: ZipEntry[] = [];
    let p = cdOff;
    for (let i = 0; i < cdCount; i++) {
      entries.push({
        flags: this.rU16(buf, p + 8),
        method: this.rU16(buf, p + 10),
        mtime: this.rU16(buf, p + 12),
        mdate: this.rU16(buf, p + 14),
        crc: this.rU32(buf, p + 16),
        compSize: this.rU32(buf, p + 20),
        uncompSize: this.rU32(buf, p + 24),
        lho: this.rU32(buf, p + 42),
        name: new TextDecoder().decode(buf.slice(p + 46, p + 46 + this.rU16(buf, p + 28))),
      });
      p += 46 + this.rU16(buf, p + 28) + this.rU16(buf, p + 30) + this.rU16(buf, p + 32);
    }
    this.entries = entries;
  }

  private localBytes(e: ZipEntry): Uint8Array<ArrayBuffer> {
    const lp = e.lho;
    const nl = this.rU16(this.buf, lp + 26);
    const el = this.rU16(this.buf, lp + 28);
    const ds = lp + 30 + nl + el;
    return this.buf.slice(ds, ds + e.compSize);
  }

  private async extractText(name: string): Promise<string | null> {
    const e = this.entries.find((x) => x.name === name);
    if (!e) return null;
    const comp = this.localBytes(e);
    if (e.method === 0) return new TextDecoder().decode(comp);
    const ab = await new Response(
      new Blob([comp]).stream().pipeThrough(new DecompressionStream('deflate-raw')),
    ).arrayBuffer();
    return new TextDecoder().decode(new Uint8Array(ab));
  }

  private async deflateRaw(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
    const ab = await new Response(
      new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw')),
    ).arrayBuffer();
    return new Uint8Array(ab);
  }

  private async rebuildZip(replaceMap: Record<string, Uint8Array<ArrayBuffer>>): Promise<Blob> {
    const enc = new TextEncoder();
    interface Part {
      name: string; method: number; flags: number; mtime: number; mdate: number;
      crc: number; compSize: number; uncompSize: number; data: Uint8Array<ArrayBuffer>;
    }
    const parts: Part[] = [];
    for (const e of this.entries) {
      if (replaceMap[e.name]) {
        const raw = replaceMap[e.name];
        const comp = await this.deflateRaw(raw);
        parts.push({
          name: e.name, method: 8, flags: e.flags & ~0x08, mtime: e.mtime, mdate: e.mdate,
          crc: crc32(raw), compSize: comp.length, uncompSize: raw.length, data: comp,
        });
      } else {
        parts.push({
          name: e.name, method: e.method, flags: e.flags & ~0x08, mtime: e.mtime, mdate: e.mdate,
          crc: e.crc, compSize: e.compSize, uncompSize: e.uncompSize, data: this.localBytes(e),
        });
      }
    }
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    const central: { hdr: Uint8Array<ArrayBuffer>; name: Uint8Array<ArrayBuffer> }[] = [];
    let offset = 0;
    const u16 = (a: number[], v: number) => a.push(v & 0xFF, (v >> 8) & 0xFF);
    const u32 = (a: number[], v: number) =>
      a.push(v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >>> 24) & 0xFF);
    for (const e of parts) {
      const nb = enc.encode(e.name);
      const lh: number[] = [];
      u32(lh, 0x04034b50); u16(lh, 20); u16(lh, e.flags); u16(lh, e.method);
      u16(lh, e.mtime); u16(lh, e.mdate); u32(lh, e.crc); u32(lh, e.compSize);
      u32(lh, e.uncompSize); u16(lh, nb.length); u16(lh, 0);
      const lhB = new Uint8Array(lh);
      chunks.push(lhB, nb, e.data);
      const ch: number[] = [];
      u32(ch, 0x02014b50); u16(ch, 20); u16(ch, 20); u16(ch, e.flags); u16(ch, e.method);
      u16(ch, e.mtime); u16(ch, e.mdate); u32(ch, e.crc); u32(ch, e.compSize);
      u32(ch, e.uncompSize); u16(ch, nb.length); u16(ch, 0); u16(ch, 0); u16(ch, 0);
      u16(ch, 0); u32(ch, 0); u32(ch, offset);
      central.push({ hdr: new Uint8Array(ch), name: nb });
      offset += lhB.length + nb.length + e.data.length;
    }
    const cdStart = offset;
    const cdChunks: Uint8Array<ArrayBuffer>[] = [];
    let cdSize = 0;
    for (const c of central) {
      cdChunks.push(c.hdr, c.name);
      cdSize += c.hdr.length + c.name.length;
    }
    const eo: number[] = [];
    u32(eo, 0x06054b50); u16(eo, 0); u16(eo, 0); u16(eo, parts.length);
    u16(eo, parts.length); u32(eo, cdSize); u32(eo, cdStart); u16(eo, 0);
    return new Blob([...chunks, ...cdChunks, new Uint8Array(eo)], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  // ── Análisis ───────────────────────────────────────────────────────────────

  /** Mapea nivel de título (1-4) → styleId, por nombre "heading N" o outlineLvl. */
  private buildStyleMap(): Record<number, string> {
    const map: Record<number, string> = {};
    const byName: Record<number, string> = {};
    for (const st of Array.from(this.stylesDoc.getElementsByTagName('w:style'))) {
      if (st.getAttribute('w:type') !== 'paragraph') continue;
      const id = st.getAttribute('w:styleId') ?? '';
      const nameEl = st.getElementsByTagName('w:name')[0];
      const name = nameEl ? (nameEl.getAttribute('w:val') ?? '').toLowerCase() : '';
      const m = name.match(/^heading\s*([1-9])$/);
      if (m) {
        const lvl = +m[1];
        if (lvl <= 4 && !map[lvl]) map[lvl] = id;
        continue;
      }
      const ol = st.getElementsByTagName('w:outlineLvl')[0];
      if (ol && !/^(toc|tdc|índice|indice|contents)/.test(name)) {
        const lvl = parseInt(ol.getAttribute('w:val') ?? '', 10) + 1;
        if (lvl >= 1 && lvl <= 4) byName[lvl] = byName[lvl] || id;
      }
    }
    for (let l = 1; l <= 4; l++) if (!map[l] && byName[l]) map[l] = byName[l];
    return map;
  }

  private trackedChildren(body: Element): Element[] {
    const out: Element[] = [];
    for (const c of Array.from(body.children)) if (TRACK.includes(c.nodeName)) out.push(c);
    return out;
  }

  private buildBlocks(): CleanerBlock[] {
    const styleToLevel: Record<string, number> = {};
    for (const l of [1, 2, 3, 4]) if (this.styleMap[l]) styleToLevel[this.styleMap[l]] = l;
    const boxByStyle: Record<string, string> = {
      buaimportante: 'importante',
      buadefinicion: 'definición',
      buaejemplo: 'ejemplo',
    };
    // ¿El documento tiene un índice automático en algún sitio?
    let hasToc = this.body.getElementsByTagName('w:sdt').length > 0;
    if (!hasToc) {
      for (const p of Array.from(this.body.getElementsByTagName('w:p'))) {
        const s = pstyleId(p);
        if (/^(TDC|TOC)/i.test(s)) { hasToc = true; break; }
      }
    }
    if (!hasToc) {
      hasToc = Array.from(this.body.getElementsByTagName('w:hyperlink'))
        .some((h) => /^_Toc/i.test(h.getAttribute('w:anchor') ?? ''));
    }
    const tocTitleRe = /^(contenidos?|índice|indice|tabla de contenidos?|table of contents|contents|sumario)$/i;
    const blocks: CleanerBlock[] = [];
    let i = 0;
    let tblN = 0;
    for (const node of this.trackedChildren(this.body)) {
      let kind: BlockKind;
      let role: BlockRole;
      let text = '';
      if (node.nodeName === 'w:sdt') {
        kind = 'toc'; role = 'remove'; text = 'Índice automático';
      } else if (node.nodeName === 'w:tbl') {
        kind = 'table'; role = 'table:horizontal'; tblN++;
        const r0 = node.getElementsByTagName('w:tr')[0];
        const cells: string[] = [];
        if (r0) {
          for (const tc of Array.from(r0.getElementsByTagName('w:tc'))) {
            let t = '';
            for (const x of Array.from(tc.getElementsByTagName('w:t'))) t += x.textContent;
            cells.push(t.trim());
          }
        }
        text = 'Tabla ' + tblN + ' · ' + cells.filter(Boolean).slice(0, 4).join(' / ');
      } else {
        const sid = pstyleId(node);
        text = ptext(node).trim();
        const isTocField =
          node.getElementsByTagName('w:instrText').length > 0 && /\bTOC\b/i.test(node.textContent ?? '');
        const tocLink = Array.from(node.getElementsByTagName('w:hyperlink'))
          .some((h) => /^_Toc/i.test(h.getAttribute('w:anchor') ?? ''));
        if (isTocField || tocLink || /^TDC/i.test(sid) || /^TOC/i.test(sid)) {
          kind = 'toc'; role = 'remove';
          if (!text) text = '(entrada de índice)';
        } else if (hasToc && tocTitleRe.test(text) && i < 15) {
          kind = 'cover'; role = 'remove';
        } else if (styleToLevel[sid] !== undefined) {
          kind = 'heading'; role = ('h' + styleToLevel[sid]) as BlockRole;
        } else if (boxByStyle[sid]) {
          kind = 'box'; role = ('box:' + boxByStyle[sid]) as BlockRole;
        } else if (sid === 'Ttulo' || sid === 'FrameContents') {
          kind = 'cover'; role = 'remove';
          if (!text) text = '(portada / índice)';
        } else if (!text && !hasImg(node)) {
          kind = 'empty'; role = 'keep'; text = '(línea en blanco)';
        } else if (pstyleId(node) === 'Prrafodelista' || node.getElementsByTagName('w:numPr').length) {
          kind = 'list'; role = 'keep';
          if (hasImg(node) && !text) text = '(imagen)';
        } else {
          kind = 'para'; role = 'keep';
          if (hasImg(node) && !text) text = '(imagen)';
        }
      }
      blocks.push({ i, kind, role, text });
      i++;
    }
    // Normaliza: el título más alto del documento pasa a ser H1 (página)
    const lvls = blocks.filter((b) => b.kind === 'heading').map((b) => parseInt(b.role.slice(1), 10));
    if (lvls.length) {
      const delta = Math.min(...lvls) - 1;
      if (delta > 0) {
        for (const b of blocks) {
          if (b.kind === 'heading') {
            b.role = ('h' + Math.max(1, parseInt(b.role.slice(1), 10) - delta)) as BlockRole;
          }
        }
      }
    }
    // Todo lo que va antes del primer título es portada/índice: se quita por defecto
    const firstHeading = blocks.findIndex((b) => b.kind === 'heading');
    if (firstHeading > 0) {
      for (let k = 0; k < firstHeading; k++) {
        const b = blocks[k];
        b.role = 'remove';
        if (b.kind !== 'toc') {
          b.kind = 'cover';
          if (!b.text || b.text === '(imagen)' || b.text === '(línea en blanco)') b.text = '(portada)';
        }
      }
    }
    return blocks;
  }

  // ── Carga ──────────────────────────────────────────────────────────────────

  async load(file: File): Promise<CleanerBlock[]> {
    if (!/\.docx$/i.test(file.name)) throw new Error('El archivo debe ser .docx');
    const buf = new Uint8Array(await file.arrayBuffer());
    this.parseZip(buf);
    const docXml = await this.extractText('word/document.xml');
    const stylesXml = await this.extractText('word/styles.xml');
    if (!docXml || !stylesXml) throw new Error('No se pudo leer el documento');
    this.xmlDoc = new DOMParser().parseFromString(docXml, 'application/xml');
    this.stylesDoc = new DOMParser().parseFromString(stylesXml, 'application/xml');
    if (this.xmlDoc.querySelector('parsererror')) throw new Error('No se pudo leer el documento');
    this.body = this.xmlDoc.getElementsByTagName('w:body')[0];
    this.styleMap = this.buildStyleMap();
    return this.buildBlocks();
  }

  // ── Generación ─────────────────────────────────────────────────────────────

  /** Garantiza que exista un estilo de título para el nivel dado. */
  private ensureLevel(
    stylesDoc: XMLDocument,
    styleMap: Record<number, string>,
    lvl: number,
    flags: { styles: boolean },
  ): string {
    if (styleMap[lvl]) return styleMap[lvl];
    const id = 'HeadingAuto' + lvl;
    const s = stylesDoc.createElementNS(WNS, 'w:style');
    s.setAttribute('w:type', 'paragraph');
    s.setAttribute('w:styleId', id);
    const set = (tag: string, attrs: Record<string, string>, parent: Element): Element => {
      const e = stylesDoc.createElementNS(WNS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      parent.appendChild(e);
      return e;
    };
    set('w:name', { 'w:val': 'heading ' + lvl }, s);
    set('w:basedOn', { 'w:val': 'Normal' }, s);
    const pPr = stylesDoc.createElementNS(WNS, 'w:pPr');
    set('w:outlineLvl', { 'w:val': String(lvl - 1) }, pPr);
    s.appendChild(pPr);
    const rPr = stylesDoc.createElementNS(WNS, 'w:rPr');
    set('w:b', {}, rPr);
    set('w:sz', { 'w:val': String(36 - (lvl - 1) * 4) }, rPr);
    s.appendChild(rPr);
    stylesDoc.getElementsByTagName('w:styles')[0].appendChild(s);
    styleMap[lvl] = id;
    flags.styles = true;
    return id;
  }

  private stripFormat(body: Element): void {
    for (const r of Array.from(body.getElementsByTagName('w:r'))) {
      for (const c of Array.from(r.children)) if (c.nodeName === 'w:rPr') c.remove();
    }
    for (const p of Array.from(body.getElementsByTagName('w:p'))) {
      const pPr = getPPr(p);
      if (!pPr) continue;
      for (const c of Array.from(pPr.children)) {
        if (c.nodeName !== 'w:pStyle' && c.nodeName !== 'w:numPr') c.remove();
      }
      if (pPr.children.length === 0) pPr.remove();
    }
  }

  /** Envuelve grupos contiguos de párrafos-caja con [etiqueta] … [fin]. */
  private wrapBoxes(doc: XMLDocument, boxNodes: { node: Element; tag: string; idx: number }[]): void {
    let idx = 0;
    while (idx < boxNodes.length) {
      const tag = boxNodes[idx].tag;
      let j = idx;
      while (j + 1 < boxNodes.length && boxNodes[j + 1].tag === tag && boxNodes[j + 1].idx === boxNodes[j].idx + 1) j++;
      const group = boxNodes.slice(idx, j + 1).map((x) => x.node);
      const kept: Element[] = [];
      for (const p of group) {
        const t = ptext(p).trim();
        if (/^(ejemplo|importante|definici[oó]n|pie)$/i.test(t)) { p.remove(); continue; }
        kept.push(p);
      }
      if (kept.length) {
        const f = kept[0].getElementsByTagName('w:t')[0];
        if (f) f.textContent = (f.textContent ?? '').replace(/^\s*<<\s*/, '');
        const lt = kept[kept.length - 1].getElementsByTagName('w:t');
        if (lt.length) {
          const l = lt[lt.length - 1];
          l.textContent = (l.textContent ?? '').replace(/\s*>>\s*$/, '');
        }
      }
      const startAnchor = kept.length ? kept[0] : group[0];
      startAnchor.parentNode!.insertBefore(mkParagraph(doc, '[' + tag + ']'), startAnchor);
      const endAnchor = kept.length ? kept[kept.length - 1] : group[group.length - 1];
      endAnchor.parentNode!.insertBefore(mkParagraph(doc, '[fin]'), endAnchor.nextSibling);
      idx = j + 1;
    }
  }

  async generate(blocks: CleanerBlock[], options: CleanerOptions): Promise<Blob> {
    const doc = this.xmlDoc.cloneNode(true) as XMLDocument;
    const body = doc.getElementsByTagName('w:body')[0];
    const stylesDoc = this.stylesDoc.cloneNode(true) as XMLDocument;
    const styleMap = { ...this.styleMap };
    const flags = { styles: false };
    const nodes = this.trackedChildren(body);
    const boxNodes: { node: Element; tag: string; idx: number }[] = [];
    nodes.forEach((node, i) => {
      const b = blocks[i];
      if (!b) return;
      const role = b.role;
      if (role === 'keep') return;
      if (role === 'remove') { node.remove(); return; }
      if (node.nodeName === 'w:tbl') {
        if (role.indexOf('table:') === 0) {
          const orient = role.split(':')[1];
          node.parentNode!.insertBefore(mkParagraph(doc, '[' + orient + ']'), node);
          for (const h of Array.from(node.getElementsByTagName('w:tblHeader'))) h.remove();
        }
        return;
      }
      if (node.nodeName === 'w:sdt') return;
      const mh = /^h([1-4])$/.exec(role);
      if (mh) {
        setStyleNode(doc, node, this.ensureLevel(stylesDoc, styleMap, +mh[1], flags));
      } else if (role === 'normal') {
        setStyleNode(doc, node, null);
      } else if (role.indexOf('box:') === 0) {
        setStyleNode(doc, node, null);
        boxNodes.push({ node, tag: role.slice(4), idx: i });
      }
    });
    this.wrapBoxes(doc, boxNodes);
    if (options.stripFormat) this.stripFormat(body);
    if (options.removeHeaderFooter) {
      const sp = body.getElementsByTagName('w:sectPr')[0];
      if (sp) {
        for (const e of [
          ...Array.from(sp.getElementsByTagName('w:headerReference')),
          ...Array.from(sp.getElementsByTagName('w:footerReference')),
        ]) e.remove();
      }
    }
    const enc = new TextEncoder();
    const replace: Record<string, Uint8Array<ArrayBuffer>> = {
      'word/document.xml': enc.encode(new XMLSerializer().serializeToString(doc)),
    };
    if (flags.styles) {
      replace['word/styles.xml'] = enc.encode(new XMLSerializer().serializeToString(stylesDoc));
    }
    return this.rebuildZip(replace);
  }
}
