import type { SemanticPage, SemanticBlock } from '../models/SemanticDocument';
import type { DocumentStructure, H1Section } from '../../types';
import { escapeHtml } from '../utils/html';

interface DocumentSection {
  level: number;
  text: string;
  html: string;
}

/** Rango semiabierto [start, end) de índices dentro del array de secciones. */
interface SectionRange {
  start: number;
  end: number;
}

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

    // Extraer contenido entre el arranque de la sección y su primer H2
    const contentBeforeFirstH2 = this.serializeRange(range.start, h2InRange[0] ?? range.end);

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

      if (option === 'html') {
        flushGroup();

        // Mantener como H2 en HTML dentro del iDevice sin título
        if (!currentBlock) {
          currentBlock = { title: '', html: '' };
          page.blocks.push(currentBlock);
        }
        const h2Heading = `<h2>${escapeHtml(h2Item.text)}</h2>`;
        currentBlock.html = this.appendParagraphHtml(currentBlock.html, h2Heading);
        if (h2Html) {
          currentBlock.html = this.appendParagraphHtml(currentBlock.html, h2Html);
        }
        i++;

      } else if (option === 'idevice-title') {
        flushGroup();

        // Crear un nuevo iDevice con este H2 como título
        currentBlock = { title: h2Item.text, html: h2Html || '<p></p>' };
        page.blocks.push(currentBlock);
        i++;

      } else if (option === 'accordion' || option === 'tabs') {
        // Si cambia el tipo de grupo (p.ej. acordeón→pestañas), cerrar el anterior
        if (groupType && groupType !== option) {
          flushGroup();
        }
        groupType = option;
        groupItems.push({ title: h2Item.text, html: h2Html || '<p></p>' });
        i++;

        // Cerrar el grupo cuando el siguiente H2 es de distinto tipo o no existe
        if (i >= h1Section.h2Items.length || h1Section.h2Items[i].option !== option) {
          flushGroup();
        }
      }
    }

    // Cerrar grupo pendiente al final de la sección
    flushGroup();

    return page;
  }

  /**
   * Contenido de un H2 (`h2-X-M` = M-ésimo H2 del documento): desde después
   * del propio H2 hasta el siguiente encabezado de nivel ≤ 2 dentro del rango
   * de su sección.
   */
  private extractH2Content(h2Id: string, range: SectionRange): string {
    const ordinal = this.ordinalFromId(h2Id);
    const pos = ordinal !== null ? this.h2Positions[ordinal - 1] : undefined;
    if (pos === undefined || pos < range.start || pos >= range.end) {
      return ''; // id no reconocido o fuera de la sección: no inventar contenido
    }

    // Fin: el siguiente H2 dentro del rango, o el final del rango
    const next = this.h2Positions.find((p) => p > pos && p < range.end) ?? range.end;
    return this.serializeRange(pos + 1, next);
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
        content += `<h3>${escapeHtml(section.text)}</h3>`;
      } else if (section.level === 4) {
        // H4 como encabezado (antes se descartaba → el título desaparecía)
        content += `<h4>${escapeHtml(section.text)}</h4>`;
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
