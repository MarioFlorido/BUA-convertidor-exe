import type { ImportedProject, ImportedPage, ImportedBlock } from '../types';
// Re-exportar funciones de transformación HTML
export { applyDivClasses, applyTableClasses } from './transformers/HtmlTransformer';

interface DocumentSection {
  level: number;
  text: string;
  html: string;
}

export function buildProjectFromStructure(
  htmlValue: string,
  filename: string,
  structure: any,
): ImportedProject {
  const document = new DOMParser().parseFromString(
    `<!doctype html><html><body>${htmlValue}</body></html>`,
    'text/html',
  );
  const body = document.body;

  // Extraer todas las secciones (H1, H2, H3, contenido)
  const sections: DocumentSection[] = [];
  let currentHtml = '';

  for (const node of Array.from(body.childNodes)) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }

    const tag = node.tagName.toLowerCase();
    const match = /^h([1-6])$/.exec(tag);

    if (match) {
      const level = Number(match[1]);
      const text = node.textContent || '';

      if (currentHtml.trim()) {
        sections.push({
          level: sections.length === 0 ? 1 : 999, // contenido previo
          text: '',
          html: currentHtml.trim(),
        });
      }

      sections.push({
        level,
        text: text.trim(),
        html: '',
      });

      currentHtml = '';
    } else {
      currentHtml += node.outerHTML;
    }
  }

  if (currentHtml.trim()) {
    sections.push({
      level: 999,
      text: '',
      html: currentHtml.trim(),
    });
  }

  // Construir páginas según la estructura configurada
  const pages: ImportedPage[] = [];
  const stemmed = filename.replace(/\.[^.]+$/, '').trim() || 'Documento importado';

  for (const h1Section of structure.h1Sections) {
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
    const contentBeforeFirstH2 = extractContentBeforeFirstH2(sections, h1Section.title);

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
      const h2Html = extractH2Content(sections, h2Item.text);

      if (option === 'html') {
        // Terminar acordeón anterior si existe
        if (accordionItems.length > 0) {
          if (!currentBlock) {
            currentBlock = { title: '', html: '' };
            page.blocks.push(currentBlock);
          }
          const accordionDiv = buildAccordionDiv(accordionItems);
          currentBlock.html = appendParagraphHtml(currentBlock.html, accordionDiv);
          accordionItems = [];
        }

        // Mantener como H2 en HTML dentro del iDevice sin título
        if (!currentBlock) {
          currentBlock = { title: '', html: '' };
          page.blocks.push(currentBlock);
        }

        // Agregar H2 como encabezado en HTML
        const h2Heading = `<h2>${escapeHtml(h2Item.text)}</h2>`;
        currentBlock.html = appendParagraphHtml(currentBlock.html, h2Heading);

        // Agregar contenido
        if (h2Html) {
          currentBlock.html = appendParagraphHtml(currentBlock.html, h2Html);
        }

        i++;
      } else if (option === 'idevice-title') {
        // Terminar acordeón anterior si existe
        if (accordionItems.length > 0) {
          if (!currentBlock) {
            currentBlock = { title: '', html: '' };
            page.blocks.push(currentBlock);
          }
          const accordionDiv = buildAccordionDiv(accordionItems);
          currentBlock.html = appendParagraphHtml(currentBlock.html, accordionDiv);
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
          const accordionDiv = buildAccordionDiv(accordionItems);
          currentBlock.html = appendParagraphHtml(currentBlock.html, accordionDiv);
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
      const accordionDiv = buildAccordionDiv(accordionItems);
      currentBlock.html = appendParagraphHtml(currentBlock.html, accordionDiv);
    }

    pages.push(page);
  }

  if (pages.length === 0) {
    pages.push({
      title: stemmed,
      level: 1,
      parentIndex: null,
      blocks: [{ title: 'Contenido', html: '<p>Documento importado sin encabezados detectados.</p>' }],
    });
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

  return {
    title: stemmed,
    subtitle: '',
    pages,
  };
}

function extractContentBeforeFirstH2(sections: DocumentSection[], h1Text: string): string {
  const cleanH1 = h1Text.trim();
  let foundH1 = false;
  let content = '';

  for (const section of sections) {
    if (section.level === 1 && section.text.trim() === cleanH1) {
      foundH1 = true;
      continue;
    }

    if (foundH1) {
      if (section.level <= 1) {
        // Encontramos el siguiente H1, terminar
        break;
      }

      if (section.level === 2) {
        // Encontramos el primer H2, terminar
        break;
      }

      if (section.level === 999) {
        // Contenido entre H1 y primer H2
        content += section.html;
      }
    }
  }

  return content;
}

function extractH2Content(sections: DocumentSection[], h2Text: string): string {
  const cleanH2 = h2Text.trim();
  let foundH2 = false;
  let content = '';

  for (const section of sections) {
    if (section.level === 2 && section.text.trim() === cleanH2) {
      foundH2 = true;
      continue;
    }

    if (foundH2) {
      if (section.level <= 2) {
        // Encontramos el siguiente H2, terminar
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

function appendParagraphHtml(existing: string, paragraphHtml: string): string {
  if (!paragraphHtml) return existing;
  return existing ? `${existing}\n${paragraphHtml}` : paragraphHtml;
}

function buildAccordionDiv(items: Array<{ title: string; html: string }>): string {
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
