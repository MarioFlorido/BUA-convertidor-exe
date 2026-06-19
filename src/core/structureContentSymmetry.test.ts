/**
 * Test del INVARIANTE POSICIONAL (acoplamiento implícito crítico).
 *
 * El emparejado estructura↔contenido funciona porque DOS funciones independientes
 * filtran los encabezados vacíos (restos de Word) con EL MISMO criterio:
 *
 *   - parseDocumentStructure() asigna ordinales (h1-N, h2-X-M) saltándose los
 *     encabezados sin texto (`if (!normalizeText(text)) continue`).
 *   - buildProjectFromStructure() / SemanticBuilder segmenta el contenido por
 *     posición saltándose esos mismos encabezados vacíos.
 *
 * Si una de las dos dejara de ignorar (o empezara a ignorar) un encabezado que
 * la otra no, los ordinales se DESALINEARÍAN y el contenido se mapearía a la
 * página equivocada EN SILENCIO. Estos tests fijan esa simetría: comprueban que
 * el CONTENIDO sobrevive en su sitio aun con encabezados vacíos en posiciones
 * que, de romperse el invariante, desplazarían los ordinales.
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

/** Pipeline completo: HTML → estructura (por defecto) → SemanticDocument. */
async function convert(html: string) {
  const structure = await parseDocumentStructure(html);
  return { structure, doc: buildProjectFromStructure(html, 'test.docx', structure) };
}

describe('invariante posicional: simetría del filtrado de encabezados vacíos', () => {
  test('H1 vacío al INICIO no consume ordinal → el primer H1 real recibe su contenido', async () => {
    // Si parseStructure o buildFromStructure contaran el <h1></h1> vacío, el
    // ordinal de "Real" (h1-1) apuntaría a la posición equivocada y CONTENIDO
    // se perdería (rango vacío).
    const { doc } = await convert('<h1></h1><h1>Real</h1><p>CONTENIDO</p>');
    assert.equal(doc.pages.length, 1);
    assert.equal(doc.pages[0].title, 'Real');
    assert.match(doc.pages[0].blocks[0].html, /CONTENIDO/);
  });

  test('H1 vacío INTERCALADO no desplaza el contenido a la página equivocada', async () => {
    const { doc } = await convert(
      '<h1>A</h1><p>aaa</p><h1></h1><h1>B</h1><p>bbb</p>',
    );
    assert.equal(doc.pages.length, 2);
    assert.match(doc.pages[0].blocks[0].html, /aaa/);
    assert.doesNotMatch(doc.pages[0].blocks[0].html, /bbb/);
    assert.match(doc.pages[1].blocks[0].html, /bbb/);
    assert.doesNotMatch(doc.pages[1].blocks[0].html, /aaa/);
  });

  test('encabezado con solo &nbsp; se trata como vacío por AMBOS lados', async () => {
    // normalizeText (\s incluye U+00A0) lo deja en '' en las dos funciones.
    const { structure, doc } = await convert('<h1>&nbsp;</h1><h1>Real</h1><p>X</p>');
    assert.equal(structure.h1Sections.filter((s) => !s.synthetic).length, 1);
    assert.equal(doc.pages.length, 1);
    assert.equal(doc.pages[0].title, 'Real');
    assert.match(doc.pages[0].blocks[0].html, /X/);
  });

  test('H2 vacío no desplaza el contenido del H2 real siguiente', async () => {
    const { doc } = await convert(
      '<h1>T</h1><h2></h2><h2>Real</h2><p>contenido del H2</p>',
    );
    const html = doc.pages[0].blocks[0].html;
    assert.match(html, /<h2>Real<\/h2>/);
    assert.match(html, /contenido del H2/);
  });

  test('múltiples vacíos intercalados: cada sección real conserva EXACTAMENTE su contenido', async () => {
    const { doc } = await convert(
      '<h1></h1><h1>P1</h1><p>uno</p>' +
        '<h2></h2><h2>S</h2><p>sub</p>' +
        '<h1>  </h1><h1>P2</h1><p>dos</p>' +
        '<h1></h1><h1>P3</h1><p>tres</p>',
    );
    assert.equal(doc.pages.length, 3);
    assert.deepEqual(
      doc.pages.map((p) => p.title),
      ['P1', 'P2', 'P3'],
    );
    assert.match(doc.pages[0].blocks[0].html, /uno/);
    assert.match(doc.pages[0].blocks[0].html, /sub/);
    assert.match(doc.pages[1].blocks[0].html, /dos/);
    assert.match(doc.pages[2].blocks[0].html, /tres/);
    // Sin contaminación cruzada
    assert.doesNotMatch(doc.pages[1].blocks[0].html, /uno|tres/);
    assert.doesNotMatch(doc.pages[2].blocks[0].html, /uno|dos/);
  });

  test('cardinalidad: nº de páginas construidas == nº de secciones de la estructura', async () => {
    // parseStructure (que define los ordinales) y buildFromStructure (que los
    // consume) deben coincidir en CUÁNTAS secciones hay, incluida la sintética.
    const { structure, doc } = await convert(
      '<p>previo</p><h1></h1><h1>A</h1><p>a</p><h1>B</h1><p>b</p>',
    );
    assert.equal(structure.h1Sections.length, doc.pages.length);
    // 1 sintética ("Contenido" por el contenido previo) + 2 reales = 3
    assert.equal(doc.pages.length, 3);
    assert.equal(doc.pages[0].title, 'Contenido');
    assert.match(doc.pages[0].blocks[0].html, /previo/);
  });
});
