import type { ImportedPage, ImportedBlock } from '../models/SemanticDocument';

interface DocumentSection {
  level: number;
  text: string;
  html: string;
}

/**
 * Construye la jerarquía de páginas, bloques e iDevices a partir de:
 * - sections: array de H1/H2/H3/contenido extraído del HTML
 * - structure: parseDocumentStructure que define H1s y sus H2 items
 *
 * Máquina de estados:
 * - Para cada H1: crear una página
 * - Para cada H2 dentro del H1:
 *   - 'html': mantener como H2 en HTML
 *   - 'idevice-title': crear iDevice con título
 *   - 'accordion': acumular para acordeón
 */
export class SemanticBuilder {
  private sections: DocumentSection[];
  private structure: any;
  private h1Indices: Map<string, number>;

  constructor(sections: DocumentSection[], structure: any) {
    this.sections = sections;
    this.structure = structure;
    this.h1Indices = this.buildH1Map();
  }

  /**
   * Construir todas las páginas del proyecto
   */
  buildPages(filename: string): ImportedPage[] {
    const pages: ImportedPage[] = [];
    const stemmed = filename.replace(/\.[^.]+$/, '').trim() || 'Documento importado';

    for (const h1Section of this.structure.h1Sections) {
      const h1Index = this.h1Indices.get(h1Section.title.trim()) ?? -1;
      const page = this.buildPageFromH1(h1Section, h1Index, pages);
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

  /**
   * Construir una página individual a partir de un H1
   */
  private buildPageFromH1(h1Section: any, h1Index: number, pages: ImportedPage[]): ImportedPage {
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

    const page: ImportedPage = {
      title: h1Section.title,
      level: h1Section.level,
      parentIndex,
      blocks: [],
    };

    // Extraer contenido entre H1 y el primer H2
    const contentBeforeFirstH2 = this.extractContentBeforeFirstH2(h1Index);

    // Crear un iDevice sin título por defecto (para contenido antes del primer H2 y H2s en HTML)
    let currentBlock: ImportedBlock | null = null;

    if (contentBeforeFirstH2) {
      currentBlock = { title: '', html: contentBeforeFirstH2 };
      page.blocks.push(currentBlock);
    }

    let accordionItems: Array<{ title: string; html: string }> = [];
    let i = 0;

    while (i < h1Section.h2Items.length) {
      const h2Item = h1Section.h2Items[i];
      const option = h2Item.option;
      const h2Html = this.extractH2Content(h2Item.text, h1Index);

      if (option === 'html') {
        // Terminar acordeón anterior si existe
        if (accordionItems.length > 0) {
          if (!currentBlock) {
            currentBlock = { title: '', html: '' };
            page.blocks.push(currentBlock);
          }
          const accordionDiv = this.buildAccordionDiv(accordionItems);
          currentBlock.html = this.appendParagraphHtml(currentBlock.html, accordionDiv);
          accordionItems = [];
        }

        // Mantener como H2 en HTML dentro del iDevice sin título
        if (!currentBlock) {
          currentBlock = { title: '', html: '' };
          page.blocks.push(currentBlock);
        }

        // Agregar H2 como encabezado en HTML
        const h2Heading = `<h2>${escapeHtml(h2Item.text)}</h2>`;
        currentBlock.html = this.appendParagraphHtml(currentBlock.html, h2Heading);

        // Agregar contenido
        if (h2Html) {
          currentBlock.html = this.appendParagraphHtml(currentBlock.html, h2Html);
        }

        i++;
      } else if (option === 'idevice-title') {
        // Terminar acordeón anterior si existe
        if (accordionItems.length > 0) {
          if (!currentBlock) {
            currentBlock = { title: '', html: '' };
            page.blocks.push(currentBlock);
          }
          const accordionDiv = this.buildAccordionDiv(accordionItems);
          currentBlock.html = this.appendParagraphHtml(currentBlock.html, accordionDiv);
          accordionItems = [];
        }

        // Crear un nuevo iDevice con este H2 como título
        currentBlock = { title: h2Item.text, html: h2Html || '<p></p>' };
        page.blocks.push(currentBlock);

        i++;
      } else if (option === 'accordion') {
        // Agregar a la lista de items del acordeón
        accordionItems.push({ title: h2Item.text, html: h2Html || '<p></p>' });
        i++;

        // Si el siguiente H2 no es acordeón, terminar el acordeón
        if (i >= h1Section.h2Items.length || h1Section.h2Items[i].option !== 'accordion') {
          if (!currentBlock) {
            currentBlock = { title: '', html: '' };
            page.blocks.push(currentBlock);
          }
          const accordionDiv = this.buildAccordionDiv(accordionItems);
          currentBlock.html = this.appendParagraphHtml(currentBlock.html, accordionDiv);
          accordionItems = [];
        }
      }
    }

    // Terminar acordeón si queda pendiente
    if (accordionItems.length > 0) {
      if (!currentBlock) {
        currentBlock = { title: '', html: '' };
        page.blocks.push(currentBlock);
      }
      const accordionDiv = this.buildAccordionDiv(accordionItems);
      currentBlock.html = this.appendParagraphHtml(currentBlock.html, accordionDiv);
    }

    return page;
  }

  /**
   * Construir map de H1 texto -> índice en sections
   */
  private buildH1Map(): Map<string, number> {
    const map = new Map<string, number>();
    for (let i = 0; i < this.sections.length; i++) {
      if (this.sections[i].level === 1) {
        map.set(this.sections[i].text.trim(), i);
      }
    }
    return map;
  }

  /**
   * Extraer contenido entre H1 y el primer H2
   */
  private extractContentBeforeFirstH2(h1Index: number): string {
    if (h1Index < 0) return '';

    let content = '';

    // Encontrar el siguiente H1 para saber dónde termina esta sección
    let nextH1Index = this.sections.length;
    for (let i = h1Index + 1; i < this.sections.length; i++) {
      if (this.sections[i].level === 1) {
        nextH1Index = i;
        break;
      }
    }

    // Extraer contenido desde h1Index+1 hasta el primer H2 o siguiente H1
    for (let i = h1Index + 1; i < nextH1Index; i++) {
      const section = this.sections[i];

      if (section.level === 2) {
        // Primer H2 encontrado, terminar
        break;
      }

      if (section.level === 999) {
        // Contenido entre H1 y primer H2
        content += section.html;
      }
    }

    return content;
  }

  /**
   * Extraer contenido de un H2 (delimitado a su sección H1)
   */
  private extractH2Content(h2Text: string, h1Index: number): string {
    if (h1Index < 0) return '';

    const cleanH2 = h2Text.trim();
    let foundH2 = false;
    let content = '';

    // Encontrar el siguiente H1 para saber dónde termina esta sección H1
    let nextH1Index = this.sections.length;
    for (let i = h1Index + 1; i < this.sections.length; i++) {
      if (this.sections[i].level === 1) {
        nextH1Index = i;
        break;
      }
    }

    // Buscar H2 solo dentro de la sección actual (entre h1Index y nextH1Index)
    for (let i = h1Index + 1; i < nextH1Index; i++) {
      const section = this.sections[i];

      if (section.level === 2 && section.text.trim() === cleanH2) {
        foundH2 = true;
        continue;
      }

      if (foundH2) {
        if (section.level <= 2) {
          // Siguiente H2 o fin de sección, terminar
          break;
        }

        if (section.level === 999) {
          // Contenido
          content += section.html;
        } else if (section.level === 3) {
          // H3 como encabezado
          content += `<h3>${escapeHtml(section.text)}</h3>`;
        }
      }
    }

    return content;
  }

  /**
   * Construir div acordeón con múltiples items
   */
  private buildAccordionDiv(items: Array<{ title: string; html: string }>): string {
    const itemsHtml = items
      .map(
        (item) => `<h2>${escapeHtml(item.title)}</h2>
${item.html}`,
      )
      .join('\n');

    return `<div class="exe-fx exe-accordion">
${itemsHtml}
</div>`;
  }

  /**
   * Anexar HTML a párrafo existente
   */
  private appendParagraphHtml(existing: string, paragraphHtml: string): string {
    if (!paragraphHtml) return existing;
    return existing ? `${existing}\n${paragraphHtml}` : paragraphHtml;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
