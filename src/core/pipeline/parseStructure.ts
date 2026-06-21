import type { DocumentStructure, H1Section, H2Item } from '../../types';
import { normalizeText } from '../utils/html';

/**
 * ¿El elemento aporta contenido real aunque no tenga texto?
 * (una imagen suelta, una tabla de solo imágenes, un vídeo embebido…)
 */
function hasVisibleContent(element: HTMLElement, text: string): boolean {
  if (text) return true;
  return element.querySelector('img, table, iframe, video') !== null;
}

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

  // Sección sintética «Contenido»: recoge lo que aparece ANTES del primer H1
  // (texto suelto, imágenes o H2s) para que el usuario la vea en el
  // configurador y el contenido no se pierda. Siempre ocupa la posición 0.
  let syntheticSection: H1Section | null = null;
  const ensureSynthetic = (): H1Section => {
    if (!syntheticSection) {
      syntheticSection = {
        id: 'h1-default',
        title: 'Contenido',
        level: 1,
        h2Items: [],
        synthetic: true,
      };
      h1Sections.unshift(syntheticSection);
    }
    return syntheticSection;
  };

  for (const element of Array.from(bodyElement.children)) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    const tag = element.tagName.toLowerCase();
    const text = normalizeText(element.textContent || '');

    if (tag === 'h1') {
      if (!text) continue; // encabezado vacío (restos de Word): se ignora
      h1Counter++;
      currentH1Section = {
        id: `h1-${h1Counter}`,
        title: text,
        level: 1,
        h2Items: [],
      };
      h1Sections.push(currentH1Section);
    } else if (tag === 'h2') {
      if (!text) continue; // encabezado vacío (restos de Word): se ignora
      h2Counter++;
      const h2Item: H2Item = {
        id: `h2-${h1Counter}-${h2Counter}`,
        text: text,
        option: 'html', // default option
      };
      // Un H2 antes del primer H1 cuelga de la sección sintética
      (currentH1Section ?? ensureSynthetic()).h2Items.push(h2Item);
    } else if (!currentH1Section && hasVisibleContent(element, text)) {
      // Contenido antes del primer H1: garantizar que tiene página propia
      ensureSynthetic();
    }
  }

  // Si no hay H1 ni contenido detectado, crear la sección por defecto
  if (h1Sections.length === 0) {
    ensureSynthetic();
  }

  return { h1Sections };
}
