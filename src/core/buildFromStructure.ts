import type { ImportedProject } from './models/SemanticDocument';
import { SemanticBuilder } from './builders/SemanticBuilder';

// Re-exportar funciones de transformación HTML
export { applyDivClasses, applyTableClasses } from './transformers/HtmlTransformer';

interface DocumentSection {
  level: number;
  text: string;
  html: string;
}

/**
 * Construir proyecto ImportedProject a partir de HTML de DOCX
 *
 * Responsabilidades:
 * 1. Parsear HTML en secciones (H1, H2, H3, contenido)
 * 2. Delegar construcción de páginas/bloques a SemanticBuilder
 * 3. Retornar ImportedProject completo
 */
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

  // Delegar construcción de páginas a SemanticBuilder
  const builder = new SemanticBuilder(sections, structure);
  const pages = builder.buildPages(filename);

  // Retornar proyecto
  const stemmed = filename.replace(/\.[^.]+$/, '').trim() || 'Documento importado';
  return {
    title: stemmed,
    subtitle: '',
    pages,
  };
}
