/**
 * Tests de HtmlTransformer — la pieza más frágil del pipeline (regex sobre HTML).
 *
 * Runner: node:test vía tsx (sin dependencias extra).
 *   npm test            → ejecuta todos los *.test.ts
 *
 * Las funciones autolinkUrls/openExternalLinksInNewTab usan DOMParser, que no
 * existe en Node; se inyecta jsdom como global antes de los tests.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// ── Setup DOM global (para autolinkUrls / openExternalLinksInNewTab) ──────────
const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
const g = globalThis as Record<string, unknown>;
g.DOMParser = jsdom.window.DOMParser;
g.NodeFilter = jsdom.window.NodeFilter;
g.Node = jsdom.window.Node;

import {
  applyDivClasses,
  applyTableClasses,
  processIframes,
  autolinkUrls,
  openExternalLinksInNewTab,
  continueInterruptedOrderedLists,
  applyAllTransforms,
} from './HtmlTransformer';

// ─────────────────────────────────────────────────────────────────────────────
// applyDivClasses — cajas semánticas [ejemplo] [definición] [importante]
// ─────────────────────────────────────────────────────────────────────────────
describe('applyDivClasses', () => {
  test('Caso A: etiqueta en párrafo propio consume los <p> de apertura/cierre', () => {
    const input = '<p>[Importante]</p><p>Contenido</p><p>[fin]</p>';
    const out = applyDivClasses(input);
    assert.equal(out, '<div class="bua_importante"><p>Contenido</p></div>');
  });

  test('Caso B: etiqueta inline dentro del mismo párrafo', () => {
    const input = '<p>[importante]Contenido[fin]</p>';
    const out = applyDivClasses(input);
    assert.equal(out, '<p><div class="bua_importante">Contenido</div></p>');
  });

  test('[pie] se mapea a bua_pie (Caso A)', () => {
    const input = '<p>[pie]</p><p>Figura 1. Esquema del proceso</p><p>[fin]</p>';
    const out = applyDivClasses(input);
    assert.equal(out, '<div class="bua_pie"><p>Figura 1. Esquema del proceso</p></div>');
  });

  test('[pie] inline se mapea a bua_pie (Caso B)', () => {
    const input = '<p>[pie]Tabla 2. Datos de matrícula[fin]</p>';
    const out = applyDivClasses(input);
    assert.equal(out, '<p><div class="bua_pie">Tabla 2. Datos de matrícula</div></p>');
  });

  test('case-insensitive: [EJEMPLO] funciona', () => {
    const out = applyDivClasses('<p>[EJEMPLO]</p><p>x</p><p>[fin]</p>');
    assert.match(out, /class="bua_ejemplo"/);
  });

  test('tildes: [definición] equivale a [definicion]', () => {
    const conTilde = applyDivClasses('<p>[definición]</p><p>x</p><p>[fin]</p>');
    const sinTilde = applyDivClasses('<p>[definicion]</p><p>x</p><p>[fin]</p>');
    assert.match(conTilde, /class="bua_definicion"/);
    assert.match(sinTilde, /class="bua_definicion"/);
  });

  test('dos cajas consecutivas NO se fusionan (regex non-greedy)', () => {
    const input =
      '<p>[ejemplo]</p><p>A</p><p>[fin]</p><p>[importante]</p><p>B</p><p>[fin]</p>';
    const out = applyDivClasses(input);
    const matches = out.match(/<div class="bua_\w+">/g) || [];
    assert.equal(matches.length, 2, 'debe haber exactamente 2 divs');
    assert.match(out, /class="bua_ejemplo"/);
    assert.match(out, /class="bua_importante"/);
  });

  test('etiqueta no reconocida se deja intacta', () => {
    const input = '<p>[chorrada]</p><p>x</p><p>[fin]</p>';
    assert.equal(applyDivClasses(input), input);
  });

  test('limpia anclas vacías de Word dentro de la etiqueta', () => {
    const input = '<p>[importante<a id="bm1"></a>]</p><p>x</p><p>[fin]</p>';
    const out = applyDivClasses(input);
    assert.match(out, /class="bua_importante"/);
    assert.doesNotMatch(out, /<a id="bm1">/);
  });

  test('Shift+Enter (<br/>) tras la etiqueta no rompe el Caso A', () => {
    // Word con salto de línea: <p>[importante]<br/>contenido</p>...
    const input = '<p>[importante]<br/></p><p>x</p><p>[fin]</p>';
    const out = applyDivClasses(input);
    assert.match(out, /class="bua_importante"/);
    // no debe quedar un <div> dentro de un <p> (HTML inválido)
    assert.doesNotMatch(out, /<p>\s*<div class="bua_importante"/);
  });

  test('sin marcadores: HTML intacto', () => {
    const input = '<p>Texto normal</p><h2>Título</h2>';
    assert.equal(applyDivClasses(input), input);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyTableClasses — [horizontal] / [vertical]
// ─────────────────────────────────────────────────────────────────────────────
describe('applyTableClasses', () => {
  test('[horizontal] + tabla → clase añadida y NO genera doble <', () => {
    const input = '<p>[horizontal]</p><table><tr><td>x</td></tr></table>';
    const out = applyTableClasses(input);
    assert.match(out, /<table class="bua_tabla_horizontal">/);
    assert.doesNotMatch(out, /<</, 'no debe aparecer "<<" (regresión del bug doble <)');
  });

  test('[vertical] + tabla → clase añadida', () => {
    const input = '<p>[vertical]</p><table><tr><td>x</td></tr></table>';
    const out = applyTableClasses(input);
    assert.match(out, /<table class="bua_tabla_vertical">/);
  });

  test('tabla con class existente: se concatena, no se reemplaza', () => {
    const input = '<p>[horizontal]</p><table class="foo"><tr></tr></table>';
    const out = applyTableClasses(input);
    assert.match(out, /class="foo bua_tabla_horizontal"/);
  });

  test('reemplaza el párrafo del marcador por un <p><br /></p>', () => {
    const input = '<p>[horizontal]</p><table><tr></tr></table>';
    const out = applyTableClasses(input);
    assert.match(out, /^<p><br \/><\/p><table/);
  });

  test('<br/> dentro de [horizontal] se limpia', () => {
    const input = '<p>[horizontal<br/>]</p><table><tr></tr></table>';
    const out = applyTableClasses(input);
    assert.match(out, /<table class="bua_tabla_horizontal">/);
  });

  test('sin tabla detrás: no toca el marcador', () => {
    const input = '<p>[horizontal]</p><p>no es tabla</p>';
    assert.equal(applyTableClasses(input), input);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processIframes — vídeos pegados en Word (texto escapado &lt;iframe&gt;)
// ─────────────────────────────────────────────────────────────────────────────
describe('processIframes', () => {
  test('iframe escapado solo en <p> → div.bua_video SIN <div> dentro de <p>', () => {
    const input =
      '<p>&lt;iframe src="https://www.youtube.com/embed/abc"&gt;&lt;/iframe&gt;</p>';
    const out = processIframes(input);
    assert.match(out, /<div class="bua_video">/);
    assert.match(out, /<iframe[^>]*src="https:\/\/www\.youtube\.com\/embed\/abc"/);
    assert.doesNotMatch(out, /<p>\s*<div class="bua_video"/, 'no <div> dentro de <p>');
  });

  test('añade estilos de centrado al iframe', () => {
    const input = '<p>&lt;iframe src="x"&gt;&lt;/iframe&gt;</p>';
    const out = processIframes(input);
    assert.match(out, /display: block; margin: 1em auto/);
  });

  test('sin iframe escapado: HTML intacto', () => {
    const input = '<p>Texto sin vídeo</p>';
    assert.equal(processIframes(input), input);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// autolinkUrls (usa DOMParser/jsdom)
// ─────────────────────────────────────────────────────────────────────────────
describe('autolinkUrls', () => {
  test('URL en texto plano → <a href>', () => {
    const out = autolinkUrls('<p>Visita https://ua.es ahora</p>');
    assert.match(out, /<a href="https:\/\/ua\.es">https:\/\/ua\.es<\/a>/);
  });

  test('www. recibe esquema https en href', () => {
    const out = autolinkUrls('<p>www.ua.es</p>');
    assert.match(out, /href="https:\/\/www\.ua\.es"/);
  });

  test('URL ya dentro de <a> no se vuelve a enlazar', () => {
    const input = '<p><a href="https://ua.es">https://ua.es</a></p>';
    const out = autolinkUrls(input);
    const anchors = out.match(/<a /g) || [];
    assert.equal(anchors.length, 1, 'no debe duplicar el enlace');
  });

  test('puntuación final no se incluye en la URL', () => {
    const out = autolinkUrls('<p>Mira https://ua.es.</p>');
    assert.match(out, /<a href="https:\/\/ua\.es">https:\/\/ua\.es<\/a>\./);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// openExternalLinksInNewTab
// ─────────────────────────────────────────────────────────────────────────────
describe('openExternalLinksInNewTab', () => {
  test('enlace externo → target=_blank + rel=noopener noreferrer', () => {
    const out = openExternalLinksInNewTab('<a href="https://ua.es">x</a>');
    assert.match(out, /target="_blank"/);
    assert.match(out, /rel="noopener noreferrer"/);
  });

  test('ancla interna (#) no se toca', () => {
    const input = '<a href="#seccion">x</a>';
    assert.equal(openExternalLinksInNewTab(input), input);
  });

  test('mailto: no se toca', () => {
    const input = '<a href="mailto:a@b.com">x</a>';
    assert.equal(openExternalLinksInNewTab(input), input);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// continueInterruptedOrderedLists — listas numeradas con contenido intercalado
// ─────────────────────────────────────────────────────────────────────────────
describe('continueInterruptedOrderedLists', () => {
  test('dos <ol> separados por un <p> → el segundo recibe start="2"', () => {
    const input = '<ol><li>Uno</li></ol><p>Texto</p><ol><li>Dos</li></ol>';
    const out = continueInterruptedOrderedLists(input);
    assert.match(out, /<ol start="2">/);
  });

  test('conteo correcto con varios ítems en el primer grupo', () => {
    const input = '<ol><li>A</li><li>B</li><li>C</li></ol><p>x</p><ol><li>D</li></ol>';
    const out = continueInterruptedOrderedLists(input);
    assert.match(out, /<ol start="4">/);
  });

  test('cadena de tres grupos: todos con start correcto', () => {
    const input =
      '<ol><li>1</li><li>2</li></ol>' +
      '<p>sep</p>' +
      '<ol><li>3</li></ol>' +
      '<p>sep</p>' +
      '<ol><li>4</li><li>5</li></ol>';
    const out = continueInterruptedOrderedLists(input);
    assert.match(out, /<ol start="3">/);
    assert.match(out, /<ol start="4">/);
  });

  test('un heading entre dos <ol> resetea la numeración', () => {
    const input = '<ol><li>A</li></ol><h2>Título</h2><ol><li>B</li></ol>';
    const out = continueInterruptedOrderedLists(input);
    assert.doesNotMatch(out, /start="/);
  });

  test('una <ul> entre dos <ol> resetea la numeración', () => {
    const input = '<ol><li>A</li></ol><ul><li>viñeta</li></ul><ol><li>B</li></ol>';
    const out = continueInterruptedOrderedLists(input);
    assert.doesNotMatch(out, /start="/);
  });

  test('<ol> con start existente no se sobreescribe', () => {
    const input = '<ol><li>A</li></ol><p>x</p><ol start="10"><li>B</li></ol>';
    const out = continueInterruptedOrderedLists(input);
    assert.match(out, /<ol start="10">/);
    const starts = out.match(/start="\d+"/g) || [];
    assert.equal(starts.length, 1, 'solo debe haber un start');
  });

  test('sublistas anidadas no cuentan como ítems del padre', () => {
    // El <ol> padre tiene 2 <li> directos; el anidado tiene 3 <li>
    const input =
      '<ol><li>A<ol><li>a1</li><li>a2</li><li>a3</li></ol></li><li>B</li></ol>' +
      '<p>x</p>' +
      '<ol><li>C</li></ol>';
    const out = continueInterruptedOrderedLists(input);
    assert.match(out, /<ol start="3">/, 'debe empezar en 3, no en 6');
  });

  test('<ol> único sin interrupciones: HTML sin cambios', () => {
    const input = '<ol><li>Uno</li><li>Dos</li></ol>';
    const out = continueInterruptedOrderedLists(input);
    assert.doesNotMatch(out, /start="/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyAllTransforms — integración
// ─────────────────────────────────────────────────────────────────────────────
describe('applyAllTransforms (integración)', () => {
  test('caja semántica + URL en un mismo bloque', () => {
    const input = '<p>[importante]Mira https://ua.es[fin]</p>';
    const out = applyAllTransforms(input);
    assert.match(out, /class="bua_importante"/);
    assert.match(out, /<a href="https:\/\/ua\.es"/);
    assert.match(out, /target="_blank"/);
  });

  test('documento sin marcadores pasa intacto en lo esencial', () => {
    const input = '<h2>Título</h2><p>Contenido normal.</p>';
    const out = applyAllTransforms(input);
    assert.match(out, /<h2>Título<\/h2>/);
    assert.match(out, /Contenido normal\./);
  });
});
