import type { DocumentStructure, H1Section, H2Item } from '../types';

export async function parseDocumentStructure(htmlContent: string): Promise<DocumentStructure> {
  const document = new DOMParser().parseFromString(
    `<!doctype html><html><body>${htmlContent}</body></html>`,
    'text/html',
  );

  const h1Sections: H1Section[] = [];
  const bodyElement = document.body;

  let currentH1Section: H1Section | null = null;
  let h1Counter = 0;
  let h2Counter = 0;

  for (const element of Array.from(bodyElement.children)) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    const tag = element.tagName.toLowerCase();
    const text = normalizeText(element.textContent || '');

    if (!text) {
      continue;
    }

    if (tag === 'h1') {
      h1Counter++;
      currentH1Section = {
        id: `h1-${h1Counter}`,
        title: text,
        level: 1,
        h2Items: [],
      };
      h1Sections.push(currentH1Section);
    } else if (tag === 'h2' && currentH1Section) {
      h2Counter++;
      const h2Item: H2Item = {
        id: `h2-${h1Counter}-${h2Counter}`,
        text: text,
        option: 'html', // default option
      };
      currentH1Section.h2Items.push(h2Item);
    }
  }

  // Si no hay H1, crear uno por defecto
  if (h1Sections.length === 0) {
    h1Sections.push({
      id: 'h1-default',
      title: 'Contenido',
      level: 1,
      h2Items: [],
    });
  }

  return { h1Sections };
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
