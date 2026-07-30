import type { SemanticPage, SemanticBlock } from '../models/SemanticDocument';
import type { DocumentStructure, H1Section } from '../../types';
import { escapeHtml } from '../utils/html';

interface DocumentSection {
  level: number;
  text: string;
  html: string;
  /**
   * Logos que el autor puso dentro del párrafo del encabezado, ya extraídos por
   * `extractHeadingMedia`. Reaparecen delante del texto cuando el encabezado se
   * mantiene como HTML (H2 en HTML, H3, H4) y al principio del contenido cuando
   * el título se convierte en nombre de página o de iDevice, donde solo cabe
   * texto plano.
   */
  inlineHtml?: string;
}

/** Rango semiabierto [start, end) de índices dentro del array de secciones. */
interface SectionRange {
  start: number;
  end: number;
}

/**
 * Marcador de cierre de acordeón/pestañas escrito por el autor en Word.
 * Tolerante, a propósito, a:
 *   - mayúsculas/minúsculas  → flag `i`
 *   - acento en «acordeón»   → `acorde[oó]n`
 *   - guion o espacio (o nada) entre «fin» y «acordeón» → `[\s-]*`
 * Así `[fin-acordeón]`, `[Fin acordeon]`, `[FIN-ACORDEON]`… funcionan igual.
 *
 * `_PARA` (marcador solo en su propio <p>) es el que PARTE el grupo: lo de antes
 * queda como cuerpo del último panel y lo de después sale FUERA del acordeón,
 * como flujo normal del apartado. `_ANY` limpia cualquier resto suelto para que
 * el marcador nunca acabe impreso como texto literal.
 */
const ACCORDION_END_PARA = /<p>\s*\[\s*fin[\s-]*acorde[oó]n\s*\]\s*<\/p>/i;
const ACCORDION_END_PARA_G = /<p>\s*\[\s*fin[\s-]*acorde[oó]n\s*\]\s*<\/p>/gi;
const ACCORDION_END_ANY = /\[\s*fin[\s-]*acorde[oó]n\s*\]/gi;

/**
 * Construye la jerarquía de páginas, bloques e iDevices a partir de:
 * - sections: array de H1/H2/H3/contenido extraído del HTML
 * - structure: parseDocumentStructure que define H1s y sus H2 items
 *
 * Emparejado estructura↔contenido POR POSICIÓN, nunca por texto visible:
 * los ids de la estructura codifican el ordinal del encabezado en el documento
 * (`h1-N` = N-ésimo H1, `h2-X-M` = M-ésimo H2 global). Así los títulos
 * repetidos no se pisan entre sí y cada sección recibe exactamente su contenido.
 * La sección sintética «Contenido» (synthetic) cubre el rango anterior al
 * primer H1 — o el documento entero si no hay H1.
 *
 * Máquina de estados por página:
 * - Para cada H2 dentro del H1:
 *   - 'html': mantener como H2 en HTML
 *   - 'idevice-title': crear iDevice con título
 *   - 'accordion'/'tabs': acumular en grupo exe-fx
 */
export class SemanticBuilder {
  private sections: DocumentSection[];
  private structure: DocumentStructure;
  /** Índices (en `sections`) de cada H1 del documento, en orden. */
  private h1Positions: number[];
  /** Índices (en `sections`) de cada H2 del documento, en orden. */
  private h2Positions: number[];

  constructor(sections: DocumentSection[], structure: DocumentStructure) {
    this.sections = sections;
    this.structure = structure;
    this.h1Positions = this.collectPositions(1);
    this.h2Positions = this.collectPositions(2);
  }

  /**
   * Construir todas las páginas del proyecto
   */
  buildPages(filename: string): SemanticPage[] {
    const pages: SemanticPage[] = [];
    const stemmed = filename.replace(/\.[^.]+$/, '').trim() || 'Documento importado';

    for (const h1Section of this.structure.h1Sections) {
      const range = this.rangeForSection(h1Section);
      const page = this.buildPageFromH1(h1Section, range, pages);
      pages.push(page);
    }

    // Validar que todos los bloques tengan contenido
    for (const page of pages) {
      if (page.blocks.length === 0) {
        page.blocks.push({ title: '', html: '<p></p>' });
      }

      for (const block of page.blocks) {
        if (!block.html) {
          block.html = '<p></p>';
        }
      }
    }

    // Si no hay páginas, crear una por defecto
    if (pages.length === 0) {
      pages.push({
        title: stemmed,
        level: 1,
        parentIndex: null,
        blocks: [{ title: 'Contenido', html: '<p>Documento importado sin encabezados detectados.</p>' }],
      });
    }

    return pages;
  }

  /** Índices de las secciones con el nivel dado, en orden de documento. */
  private collectPositions(level: number): number[] {
    const positions: number[] = [];
    for (let i = 0; i < this.sections.length; i++) {
      if (this.sections[i].level === level) positions.push(i);
    }
    return positions;
  }

  /** Ordinal (1-based) codificado al final de un id `h1-N` / `h2-X-M`, o null. */
  private ordinalFromId(id: string): number | null {
    const match = /-(\d+)$/.exec(id);
    if (!match) return null;
    const n = Number(match[1]);
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  /**
   * Rango de contenido de una sección de la estructura:
   * - sintética: desde el inicio del documento hasta el primer H1 (o el final).
   * - real (`h1-N`): desde después del N-ésimo H1 hasta el siguiente H1 (o el final).
   * - id no reconocido (no debería ocurrir): rango vacío.
   */
  private rangeForSection(h1Section: H1Section): SectionRange {
    if (h1Section.synthetic) {
      return { start: 0, end: this.h1Positions[0] ?? this.sections.length };
    }

    const ordinal = this.ordinalFromId(h1Section.id);
    const pos = ordinal !== null ? this.h1Positions[ordinal - 1] : undefined;
    if (pos === undefined) {
      return { start: 0, end: 0 };
    }
    return { start: pos + 1, end: this.h1Positions[ordinal!] ?? this.sections.length };
  }

  /**
   * Construir una página individual a partir de un H1
   */
  private buildPageFromH1(h1Section: H1Section, range: SectionRange, pages: SemanticPage[]): SemanticPage {
    // Calcular parentIndex basándose en el nivel
    let parentIndex: number | null = null;
    if (h1Section.level === 2) {
      // Subpágina: buscar la última página nivel 1
      for (let i = pages.length - 1; i >= 0; i--) {
        if (pages[i].level === 1) {
          parentIndex = i;
          break;
        }
      }
    } else if (h1Section.level === 3) {
      // Sub-subpágina: buscar la última página nivel 2
      for (let i = pages.length - 1; i >= 0; i--) {
        if (pages[i].level === 2) {
          parentIndex = i;
          break;
        }
      }
    }

    const page: SemanticPage = {
      title: h1Section.title,
      level: h1Section.level,
      parentIndex,
      blocks: [],
    };

    // H2s del documento que caen dentro del rango de esta sección
    const h2InRange = this.h2Positions.filter((p) => p >= range.start && p < range.end);

    // Extraer contenido entre el arranque de la sección y su primer H2.
    // Aquí no hay acordeón abierto: un [fin-acordeón] estaría mal puesto → limpiar.
    // El H1 de esta sección ocupa la posición range.start - 1: si el autor puso un
    // logo en su misma línea, abre el contenido de la página (el título de página
    // es texto plano y no admite la imagen dentro).
    const contentBeforeFirstH2 = this.prependHeadingMedia(
      h1Section.synthetic ? '' : this.headingMedia(range.start - 1),
      this.stripAccordionEnd(this.serializeRange(range.start, h2InRange[0] ?? range.end)),
    );

    // Crear un iDevice sin título por defecto (para contenido antes del primer H2 y H2s en HTML)
    let currentBlock: SemanticBlock | null = null;

    if (contentBeforeFirstH2) {
      currentBlock = { title: '', html: contentBeforeFirstH2 };
      page.blocks.push(currentBlock);
    }

    // Acumula items de un grupo exe-fx (acordeón o pestañas) mientras el tipo sea consistente
    let groupItems: Array<{ title: string; html: string }> = [];
    let groupType: 'accordion' | 'tabs' | null = null;
    let i = 0;

    /** Cierra el grupo activo y lo añade al bloque actual */
    const flushGroup = () => {
      if (groupItems.length === 0 || !groupType) return;
      if (!currentBlock) {
        currentBlock = { title: '', html: '' };
        page.blocks.push(currentBlock);
      }
      currentBlock.html = this.appendParagraphHtml(
        currentBlock.html,
        this.buildFxGroupDiv(groupItems, groupType),
      );
      groupItems = [];
      groupType = null;
    };

    while (i < h1Section.h2Items.length) {
      const h2Item = h1Section.h2Items[i];
      const option = h2Item.option;
      const h2Html = this.extractH2Content(h2Item.id, range);
      // Logo que el autor puso en la misma línea del título, si lo hay.
      const h2Media = this.headingMedia(this.h2Position(h2Item.id, range));

      if (option === 'html') {
        flushGroup();

        // Mantener como H2 en HTML dentro del iDevice sin título
        if (!currentBlock) {
          currentBlock = { title: '', html: '' };
          page.blocks.push(currentBlock);
        }
        // El encabezado sigue siendo HTML: el logo vuelve a su sitio exacto,
        // delante del texto del título.
        const h2Heading = `<h2>${h2Media}${escapeHtml(h2Item.text)}</h2>`;
        currentBlock.html = this.appendParagraphHtml(currentBlock.html, h2Heading);
        // H2 en HTML: no es un acordeón, así que un [fin-acordeón] sobra → limpiar.
        const htmlBody = this.stripAccordionEnd(h2Html);
        if (htmlBody) {
          currentBlock.html = this.appendParagraphHtml(currentBlock.html, htmlBody);
        }
        i++;

      } else if (option === 'idevice-title') {
        flushGroup();

        // iDevice con título: tampoco es un acordeón → limpiar el marcador si aparece.
        const ideviceBody = this.prependHeadingMedia(h2Media, this.stripAccordionEnd(h2Html));
        currentBlock = { title: h2Item.text, html: ideviceBody || '<p></p>' };
        page.blocks.push(currentBlock);
        i++;

      } else if (option === 'accordion' || option === 'tabs') {
        // Si cambia el tipo de grupo (p.ej. acordeón→pestañas), cerrar el anterior
        if (groupType && groupType !== option) {
          flushGroup();
        }
        groupType = option;

        // Un [fin-acordeón] en el cuerpo de este panel corta el grupo aquí:
        // `body` = cuerpo del panel; `spill` = lo que sale FUERA del acordeón.
        const { body, spill } = this.splitAccordionEnd(h2Html);
        const panelBody = this.prependHeadingMedia(h2Media, body);
        groupItems.push({ title: h2Item.text, html: panelBody || '<p></p>' });
        i++;

        if (spill) {
          // El marcador cerró el grupo: volcamos el div y anexamos el resto como
          // flujo normal del apartado, DESPUÉS del acordeón.
          flushGroup();
          if (!currentBlock) {
            currentBlock = { title: '', html: '' };
            page.blocks.push(currentBlock);
          }
          currentBlock.html = this.appendParagraphHtml(currentBlock.html, spill);
        } else if (i >= h1Section.h2Items.length || h1Section.h2Items[i].option !== option) {
          // Cerrar el grupo cuando el siguiente H2 es de distinto tipo o no existe
          flushGroup();
        }
      }
    }

    // Cerrar grupo pendiente al final de la sección
    flushGroup();

    return page;
  }

  /**
   * Índice en `sections` del H2 con ese id, si cae dentro del rango de su
   * sección. `undefined` si el id no se reconoce o queda fuera.
   */
  private h2Position(h2Id: string, range: SectionRange): number | undefined {
    const ordinal = this.ordinalFromId(h2Id);
    const pos = ordinal !== null ? this.h2Positions[ordinal - 1] : undefined;
    if (pos === undefined || pos < range.start || pos >= range.end) {
      return undefined;
    }
    return pos;
  }

  /**
   * Contenido de un H2 (`h2-X-M` = M-ésimo H2 del documento): desde después
   * del propio H2 hasta el siguiente encabezado de nivel ≤ 2 dentro del rango
   * de su sección.
   */
  private extractH2Content(h2Id: string, range: SectionRange): string {
    const pos = this.h2Position(h2Id, range);
    if (pos === undefined) {
      return ''; // id no reconocido o fuera de la sección: no inventar contenido
    }

    // Fin: el siguiente H2 dentro del rango, o el final del rango
    const next = this.h2Positions.find((p) => p > pos && p < range.end) ?? range.end;
    return this.serializeRange(pos + 1, next);
  }

  /** Logos incrustados en el encabezado de esa sección ('' si no hay). */
  private headingMedia(index: number | undefined): string {
    if (index === undefined || index < 0) return '';
    return this.sections[index]?.inlineHtml || '';
  }

  /**
   * Coloca los logos de un encabezado al principio de su contenido, en su propio
   * párrafo. Es la salida para los títulos que se convierten en nombre de página
   * o de iDevice: ahí el título es texto plano y el logo no cabe dentro.
   */
  private prependHeadingMedia(media: string, html: string): string {
    if (!media) return html;
    return this.appendParagraphHtml(`<p>${media}</p>`, html);
  }

  /**
   * Parte el contenido de un panel de acordeón/pestañas en el primer
   * `<p>[fin-acordeón]</p>` que encuentre:
   *   - `body`  = lo anterior al marcador → cuerpo del panel.
   *   - `spill` = lo posterior → sale fuera del grupo, como flujo del apartado.
   * Sin marcador (en su propio párrafo): no se parte y se devuelve el contenido
   * limpio de cualquier resto suelto del marcador. Ambos lados se limpian igual,
   * así un marcador mal colocado nunca se imprime como texto literal.
   */
  private splitAccordionEnd(html: string): { body: string; spill: string } {
    const match = ACCORDION_END_PARA.exec(html);
    if (!match) {
      return { body: this.stripAccordionEnd(html), spill: '' };
    }
    return {
      body: this.stripAccordionEnd(html.slice(0, match.index)),
      spill: this.stripAccordionEnd(html.slice(match.index + match[0].length)),
    };
  }

  /** Elimina cualquier marcador [fin-acordeón] (en párrafo propio o suelto). */
  private stripAccordionEnd(html: string): string {
    return html
      .replace(ACCORDION_END_PARA_G, '')
      .replace(ACCORDION_END_ANY, '')
      .trim();
  }

  /**
   * Serializa un rango [start, end) de secciones a HTML:
   * contenido (999) tal cual; H3/H4 como encabezados escapados.
   */
  private serializeRange(start: number, end: number): string {
    let content = '';
    for (let i = start; i < end; i++) {
      const section = this.sections[i];
      if (section.level === 999) {
        content += section.html;
      } else if (section.level === 3) {
        // `inlineHtml`: logo puesto en la misma línea del título (ver DocumentSection)
        content += `<h3>${section.inlineHtml || ''}${escapeHtml(section.text)}</h3>`;
      } else if (section.level === 4) {
        // H4 como encabezado (antes se descartaba → el título desaparecía)
        content += `<h4>${section.inlineHtml || ''}${escapeHtml(section.text)}</h4>`;
      }
      // Niveles 1/2 son fronteras de rango (no aparecen dentro);
      // 5/6 se omiten, como hacía la versión anterior.
    }
    return content;
  }

  /**
   * Construir div acordeón con múltiples items
   */
  private buildFxGroupDiv(
    items: Array<{ title: string; html: string }>,
    type: 'accordion' | 'tabs',
  ): string {
    const itemsHtml = items
      .map((item) => `<h2>${escapeHtml(item.title)}</h2>\n${item.html}`)
      .join('\n');

    return `<div class="exe-fx exe-${type}">\n${itemsHtml}\n</div>`;
  }

  /**
   * Anexar HTML a párrafo existente
   */
  private appendParagraphHtml(existing: string, paragraphHtml: string): string {
    if (!paragraphHtml) return existing;
    return existing ? `${existing}\n${paragraphHtml}` : paragraphHtml;
  }
}
