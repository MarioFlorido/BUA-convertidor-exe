/**
 * Tests del generador Word del conversor .elp → .docx.
 *
 * Genera un .docx real con la librería `docx`, lo descomprime y comprueba el
 * OOXML resultante (word/document.xml): así se valida lo que Word y mammoth
 * verán de verdad, no estructuras intermedias.
 *
 * Runner: node:test vía tsx. Necesita DOM → jsdom como global.
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { unzipSync, strFromU8 } from 'fflate';

// ── Setup DOM global (el parser y el conversor usan DOMParser) ────────────────
const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
const g = globalThis as Record<string, unknown>;
g.DOMParser = jsdom.window.DOMParser;

import { parseElp } from './elpParser';
import { convertParsedElpToDocx, sniffImageSize } from './elpToDocx';
import { buildFixtureElp, TINY_PNG } from './elpFixture';

async function docxEntriesFromFixture(rootHtml?: string) {
  const parsed = parseElp(buildFixtureElp(rootHtml ? { rootHtml } : {}));
  const result = await convertParsedElpToDocx(parsed);
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  return { entries: unzipSync(bytes), warnings: result.warnings };
}

describe('convertParsedElpToDocx — OOXML generado', () => {
  test('páginas como Título 1/2 según profundidad, con el texto y las negritas', async () => {
    const { entries } = await docxEntriesFromFixture();
    const documentXml = strFromU8(entries['word/document.xml']);

    assert.match(documentXml, /<w:pStyle w:val="Heading1"\/>/);
    assert.match(documentXml, /<w:pStyle w:val="Heading2"\/>/);
    assert.match(documentXml, /Presentación/);
    assert.match(documentXml, /Unidad 1/);
    assert.match(documentXml, /Bienvenida al/);
    // La palabra «curso» va en un run con negrita.
    assert.match(documentXml, /<w:b\/><w:bCs\/><\/w:rPr><w:t[^>]*>curso<\/w:t>/);
  });

  test('las imágenes del paquete quedan incrustadas en word/media', async () => {
    const { entries, warnings } = await docxEntriesFromFixture();
    // Se descartan las entradas de directorio del ZIP (terminan en «/»).
    const media = Object.keys(entries).filter((path) => path.startsWith('word/media/') && !path.endsWith('/'));
    assert.equal(media.length, 1);
    assert.deepEqual(warnings, []);
  });

  test('listas, enlaces externos y enlaces internos exe-node', async () => {
    const html =
      '<ul><li>Primero</li><li>Segundo</li></ul>' +
      '<ol><li>Uno</li></ol>' +
      '<p><a href="https://biblioteca.ua.es">la BUA</a> y ' +
      '<a href="exe-node:Unidad-1">enlace interno</a></p>';
    const { entries } = await docxEntriesFromFixture(html);
    const documentXml = strFromU8(entries['word/document.xml']);
    const relsXml = strFromU8(entries['word/_rels/document.xml.rels']);

    assert.match(documentXml, /<w:numPr>/); // viñetas y numeración
    assert.match(documentXml, /<w:hyperlink [^>]*r:id="/);
    assert.match(relsXml, /https:\/\/biblioteca\.ua\.es/);
    // El enlace interno de eXe se degrada a texto plano (sin hyperlink roto).
    assert.match(documentXml, /enlace interno/);
    assert.doesNotMatch(relsXml, /exe-node/);
  });

  test('el contenido incrustado (iframe) deja nota visible y aviso', async () => {
    const html = '<p>Antes</p><iframe src="https://www.youtube.com/embed/x"></iframe>';
    const { entries, warnings } = await docxEntriesFromFixture(html);
    const documentXml = strFromU8(entries['word/document.xml']);

    assert.match(documentXml, /\[Contenido incrustado omitido: https:\/\/www\.youtube\.com\/embed\/x\]/);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Presentación/);
  });

  test('imagen referenciada pero ausente del paquete: nota y aviso, sin romper', async () => {
    const html = '<p><img src="resources/no-existe.png" /></p>';
    const { entries, warnings } = await docxEntriesFromFixture(html);
    const documentXml = strFromU8(entries['word/document.xml']);

    assert.match(documentXml, /\[Imagen no encontrada/);
    assert.equal(warnings.length, 1);
  });

  test('enlace a un adjunto del paquete: aviso y nota, porque Word no lo incrusta', async () => {
    const html = '<p>Descarga <a href="resources/foto.png">este archivo</a>.</p>';
    const { entries, warnings } = await docxEntriesFromFixture(html);
    const documentXml = strFromU8(entries['word/document.xml']);

    assert.match(documentXml, /\[adjunto: foto\.png\]/);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /archivo adjunto no incluido/);
  });

  test('tablas: celdas y cabeceras presentes en el OOXML', async () => {
    const html = '<table><tr><th>Columna</th></tr><tr><td>Dato</td></tr></table>';
    const { entries } = await docxEntriesFromFixture(html);
    const documentXml = strFromU8(entries['word/document.xml']);

    assert.match(documentXml, /<w:tbl>/);
    assert.match(documentXml, /Columna/);
    assert.match(documentXml, /Dato/);
  });
});

describe('sniffImageSize', () => {
  test('lee las dimensiones reales de la cabecera PNG', () => {
    assert.deepEqual(sniffImageSize(TINY_PNG, 'png'), { width: 2, height: 3 });
  });

  test('devuelve null ante datos truncados', () => {
    assert.equal(sniffImageSize(new Uint8Array([1, 2, 3]), 'png'), null);
  });
});
