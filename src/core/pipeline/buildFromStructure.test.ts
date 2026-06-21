/**
 * Tests del emparejado estructura↔contenido (parseDocumentStructure +
 * buildProjectFromStructure end-to-end, con el HTML como única entrada).
 *
 * Cubren los escenarios del análisis externo de jun 2026: documentos sin H1,
 * contenido antes del primer H1, títulos H1/H2 repetidos — todos perdían o
 * mezclaban contenido cuando el emparejado era por texto visible.
 *
 * Runner: node:test vía tsx. DOMParser no existe en Node; se inyecta jsdom.
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// ── Setup DOM global ──────────────────────────────────────────────────────────
const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
const g = globalThis as Record<string, unknown>;
g.DOMParser = jsdom.window.DOMParser;
g.HTMLElement = jsdom.window.HTMLElement;
g.Node = jsdom.window.Node;
g.NodeFilter = jsdom.window.NodeFilter;

import { parseDocumentStructure } from './parseStructure';
import { buildProjectFromStructure } from './buildFromStructure';
import type { DocumentStructure } from '../../types';

/** Pipeline completo: HTML → estructura (por defecto) → SemanticDocument. */
async function convert(html: string, mutate?: (s: DocumentStructure) => void) {
  const structure = await parseDocumentStructure(html);
  mutate?.(structure);
  return buildProjectFromStructure(html, 'test.docx', structure);
}

describe('documento estándar (línea base)', () => {
  test('H1 con contenido, H2 en texto, H3 y H4 conservados', async () => {
    const doc = await convert(
      '<h1>Tema</h1><p>intro</p><h2>Apartado</h2><p>cuerpo</p><h3>Detalle</h3><p>fino</p><h4>Más</h4>',
    );
    assert.equal(doc.pages.length, 1);
    const [page] = doc.pages;
    assert.equal(page.title, 'Tema');
    assert.equal(page.blocks.length, 1);
    const html = page.blocks[0].html;
    assert.match(html, /<p>intro<\/p>/);
    assert.match(html, /<h2>Apartado<\/h2>/);
    assert.match(html, /<p>cuerpo<\/p>/);
    assert.match(html, /<h3>Detalle<\/h3>/);
    assert.match(html, /<h4>Más<\/h4>/);
  });
});

describe('documento sin H1 (antes: se perdía TODO el contenido)', () => {
  test('solo párrafos → página «Contenido» con todo el texto', async () => {
    const doc = await convert('<p>Hola</p><p>Mundo entero</p>');
    assert.equal(doc.pages.length, 1);
    assert.equal(doc.pages[0].title, 'Contenido');
    const html = doc.pages[0].blocks.map((b) => b.html).join('');
    assert.match(html, /<p>Hola<\/p>/);
    assert.match(html, /<p>Mundo entero<\/p>/);
  });

  test('con H2: el H2 es configurable y su contenido se conserva', async () => {
    const doc = await convert('<h2>Apartado</h2><p>Texto del apartado</p>');
    assert.equal(doc.pages.length, 1);
    const html = doc.pages[0].blocks.map((b) => b.html).join('');
    assert.match(html, /<h2>Apartado<\/h2>/);
    assert.match(html, /<p>Texto del apartado<\/p>/);
  });

  test('documento vacío → página por defecto sin romper', async () => {
    const doc = await convert('');
    assert.equal(doc.pages.length, 1);
    assert.equal(doc.pages[0].blocks[0].html, '<p></p>');
  });
});

describe('contenido antes del primer H1 (antes: se perdía en silencio)', () => {
  test('va a una página sintética «Contenido» visible para el usuario', async () => {
    const doc = await convert('<p>INTRO IMPORTANTE</p><h1>Tema A</h1><p>cuerpo de A</p>');
    assert.equal(doc.pages.length, 2);
    assert.equal(doc.pages[0].title, 'Contenido');
    assert.match(doc.pages[0].blocks[0].html, /INTRO IMPORTANTE/);
    assert.equal(doc.pages[1].title, 'Tema A');
    assert.match(doc.pages[1].blocks[0].html, /cuerpo de A/);
    // El cuerpo de A no contiene la intro ni viceversa
    assert.doesNotMatch(doc.pages[1].blocks[0].html, /INTRO/);
  });

  test('una imagen suelta antes del primer H1 también cuenta como contenido', async () => {
    const structure = await parseDocumentStructure('<p><img src="x.png"></p><h1>Tema</h1>');
    assert.equal(structure.h1Sections.length, 2);
    assert.equal(structure.h1Sections[0].synthetic, true);
  });

  test('sin contenido previo NO se crea sección sintética', async () => {
    const structure = await parseDocumentStructure('<h1>Tema</h1><p>x</p>');
    assert.equal(structure.h1Sections.length, 1);
    assert.equal(structure.h1Sections[0].synthetic, undefined);
  });
});

describe('títulos repetidos (antes: el emparejado por texto pisaba/mezclaba)', () => {
  test('dos H1 con el mismo título: cada página recibe SU contenido', async () => {
    const doc = await convert(
      '<h1>Tema</h1><p>contenido PRIMERO</p><h1>Tema</h1><p>contenido SEGUNDO</p>',
    );
    assert.equal(doc.pages.length, 2);
    assert.match(doc.pages[0].blocks[0].html, /PRIMERO/);
    assert.doesNotMatch(doc.pages[0].blocks[0].html, /SEGUNDO/);
    assert.match(doc.pages[1].blocks[0].html, /SEGUNDO/);
    assert.doesNotMatch(doc.pages[1].blocks[0].html, /PRIMERO/);
  });

  test('dos H2 con el mismo texto en el mismo H1: sin duplicar ni mezclar', async () => {
    const doc = await convert(
      '<h1>Tema</h1><h2>Ejemplo</h2><p>ejemplo UNO</p><h2>Ejemplo</h2><p>ejemplo DOS</p>',
    );
    const html = doc.pages[0].blocks[0].html;
    // Cada contenido aparece exactamente una vez
    assert.equal(html.match(/ejemplo UNO/g)?.length, 1);
    assert.equal(html.match(/ejemplo DOS/g)?.length, 1);
    // Y en orden: UNO antes que DOS
    assert.ok(html.indexOf('ejemplo UNO') < html.indexOf('ejemplo DOS'));
  });

  test('H2 con el mismo texto en H1 distintos: cada uno en su página', async () => {
    const doc = await convert(
      '<h1>A</h1><h2>Actividades</h2><p>tareas de A</p><h1>B</h1><h2>Actividades</h2><p>tareas de B</p>',
    );
    assert.match(doc.pages[0].blocks[0].html, /tareas de A/);
    assert.doesNotMatch(doc.pages[0].blocks[0].html, /tareas de B/);
    assert.match(doc.pages[1].blocks[0].html, /tareas de B/);
    assert.doesNotMatch(doc.pages[1].blocks[0].html, /tareas de A/);
  });
});

describe('encabezados vacíos (restos de Word)', () => {
  test('un <h2></h2> vacío no desincroniza el emparejado posicional', async () => {
    const doc = await convert(
      '<h1>Tema</h1><h2></h2><h2>Real</h2><p>contenido real</p>',
    );
    const html = doc.pages[0].blocks[0].html;
    assert.match(html, /<h2>Real<\/h2>/);
    assert.match(html, /contenido real/);
  });

  test('un <h1>   </h1> en blanco no genera página', async () => {
    const doc = await convert('<h1> </h1><h1>Único</h1><p>x</p>');
    assert.equal(doc.pages.length, 1);
    assert.equal(doc.pages[0].title, 'Único');
  });
});

describe('opciones de H2 (máquina de estados intacta con el emparejado nuevo)', () => {
  test('idevice-title crea bloque con título y su contenido', async () => {
    const doc = await convert('<h1>Tema</h1><h2>Caja</h2><p>dentro</p>', (s) => {
      s.h1Sections[0].h2Items[0].option = 'idevice-title';
    });
    const page = doc.pages[0];
    assert.equal(page.blocks.length, 1);
    assert.equal(page.blocks[0].title, 'Caja');
    assert.match(page.blocks[0].html, /dentro/);
  });

  test('dos H2 consecutivos en acordeón se agrupan en un solo exe-fx', async () => {
    const doc = await convert(
      '<h1>Tema</h1><h2>Uno</h2><p>a</p><h2>Dos</h2><p>b</p>',
      (s) => {
        for (const h2 of s.h1Sections[0].h2Items) h2.option = 'accordion';
      },
    );
    const html = doc.pages[0].blocks[0].html;
    assert.equal(html.match(/exe-accordion/g)?.length, 1);
    assert.match(html, /<h2>Uno<\/h2>/);
    assert.match(html, /<h2>Dos<\/h2>/);
    assert.match(html, /<p>a<\/p>/);
    assert.match(html, /<p>b<\/p>/);
  });

  test('niveles de página (subpáginas) calculan parentIndex', async () => {
    const doc = await convert('<h1>Padre</h1><p>p</p><h1>Hijo</h1><p>h</p>', (s) => {
      s.h1Sections[1].level = 2;
    });
    assert.equal(doc.pages[1].level, 2);
    assert.equal(doc.pages[1].parentIndex, 0);
  });
});
