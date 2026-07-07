/**
 * Tests de docxToSemanticDocument — ruta legacy (sin estructura del wizard).
 *
 * La sanitización de esa ruta (normalizeImportedNode) disuelve los <div> y
 * reconstruye las <table> sin atributos: estos tests garantizan que las clases
 * bua_* generadas por el etiquetado semántico ([importante], [horizontal]…)
 * SOBREVIVEN a la sanitización, igual que en la ruta del wizard.
 *
 * Runner: node:test vía tsx. Necesita DOM → jsdom como global.
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// ── Setup DOM global (buildProjectFromHtml usa DOMParser) ─────────────────────
const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
const g = globalThis as Record<string, unknown>;
g.DOMParser = jsdom.window.DOMParser;
g.NodeFilter = jsdom.window.NodeFilter;
g.Node = jsdom.window.Node;
g.HTMLElement = jsdom.window.HTMLElement;
g.Text = jsdom.window.Text;

import { convertHtmlToSemanticDocument } from './docxToSemanticDocument';

const OPTIONS = {
  heading1Mode: 'page',
  heading2Mode: 'block',
  heading3Mode: 'html',
  heading4Mode: 'html',
} as const;

/** HTML concatenado de todos los bloques del documento. */
function allBlocksHtml(doc: { pages: { blocks: { html: string }[] }[] }): string {
  return doc.pages.flatMap((p) => p.blocks.map((b) => b.html)).join('\n');
}

describe('convertHtmlToSemanticDocument — ruta legacy preserva clases bua_*', () => {
  test('caja semántica [importante] sobrevive a la sanitización', async () => {
    const html =
      '<h1>Página</h1><p>[importante]</p><p>Contenido</p><p>[fin]</p>';
    const doc = await convertHtmlToSemanticDocument(html, 'doc.docx', OPTIONS as any);
    assert.match(allBlocksHtml(doc), /<div class="bua_importante">/);
  });

  test('clase de tabla [horizontal] sobrevive a la sanitización', async () => {
    const html =
      '<h1>Página</h1><p>[horizontal]</p><table><tbody><tr><td>A</td></tr></tbody></table>';
    const doc = await convertHtmlToSemanticDocument(html, 'doc.docx', OPTIONS as any);
    assert.match(allBlocksHtml(doc), /<table class="bua_tabla_horizontal">/);
  });

  test('un div sin clases bua_* se sigue disolviendo en sus hijos', async () => {
    const html = '<h1>Página</h1><div class="MsoNormal"><p>Texto</p></div>';
    const doc = await convertHtmlToSemanticDocument(html, 'doc.docx', OPTIONS as any);
    const out = allBlocksHtml(doc);
    assert.doesNotMatch(out, /MsoNormal/);
    assert.match(out, /<p>Texto<\/p>/);
  });
});
