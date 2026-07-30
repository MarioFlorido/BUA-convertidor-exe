/**
 * Tests del tamaño de PRESENTACIÓN de las imágenes de un DOCX.
 *
 * Mammoth descarta `wp:extent`, así que el tamaño con el que el autor ve la
 * imagen en Word se lee aparte del propio ZIP. Estos tests son de integración:
 * generan un DOCX real con la librería `docx` (devDep) y comprueban que el
 * tamaño que sale es el de Word, NO el intrínseco del archivo.
 *
 * El PNG del fixture mide 2×3 px de verdad: si un test lee 24×18 es porque ha
 * leído el extent del DOCX y no la cabecera del PNG.
 *
 * Runner: node:test vía tsx.
 *   npm test
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { Document, Packer, Paragraph, TextRun, ImageRun } from 'docx';
import { readDocxImageSizes, assignDocxImageSizes } from './docxImageSizes';
import { DocxParser } from './DocxParser';
import { TINY_PNG } from '../elp/elpFixture';

/** Bytes del PNG 2×3 como ArrayBuffer nuevo (docx exige ArrayBuffer). */
function pngData(): ArrayBuffer {
  return TINY_PNG.slice().buffer as ArrayBuffer;
}

async function buildDocx(children: Paragraph[]): Promise<ArrayBuffer> {
  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

describe('readDocxImageSizes', () => {
  let buffer: ArrayBuffer;

  before(async () => {
    buffer = await buildDocx([
      // Logo insertado a 24×18 px, en la misma línea que el texto
      new Paragraph({
        children: [
          new ImageRun({ type: 'png', data: pngData(), transformation: { width: 24, height: 18 } }),
          new TextRun('Texto del párrafo'),
        ],
      }),
      // Captura a tamaño de ilustración, sola en su párrafo
      new Paragraph({
        children: [
          new ImageRun({ type: 'png', data: pngData(), transformation: { width: 480, height: 320 } }),
        ],
      }),
    ]);
  });

  test('devuelve el tamaño de Word de cada imagen, en orden de documento', () => {
    const sizes = readDocxImageSizes(buffer);
    assert.deepEqual(sizes, [
      { widthPx: 24, heightPx: 18 },
      { widthPx: 480, heightPx: 320 },
    ]);
  });

  test('un buffer que no es un ZIP no rompe: devuelve lista vacía', () => {
    const notAZip = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    assert.deepEqual(readDocxImageSizes(notAZip), []);
  });

  test('DOCX sin imágenes: lista vacía', async () => {
    const empty = await buildDocx([new Paragraph({ children: [new TextRun('Sin imágenes')] })]);
    assert.deepEqual(readDocxImageSizes(empty), []);
  });
});

describe('assignDocxImageSizes', () => {
  test('anota cada <img> con el tamaño de su posición', () => {
    const html = '<p><img src="a.png" /></p><p><img src="b.png" /></p>';
    const out = assignDocxImageSizes(html, [
      { widthPx: 24, heightPx: 18 },
      { widthPx: 480, heightPx: 320 },
    ]);
    assert.match(out, /<img src="a\.png" data-bua-w="24" data-bua-h="18" \/>/);
    assert.match(out, /<img src="b\.png" data-bua-w="480" data-bua-h="320" \/>/);
  });

  test('si el recuento no cuadra, no anota nada (mejor sin dato que cruzado)', () => {
    const html = '<p><img src="a.png" /></p><p><img src="b.png" /></p>';
    const out = assignDocxImageSizes(html, [{ widthPx: 24, heightPx: 18 }]);
    assert.equal(out, html);
  });

  test('una entrada sin tamaño deja su <img> intacta y no descuadra al resto', () => {
    const html = '<p><img src="a.png" /></p><p><img src="b.png" /></p>';
    const out = assignDocxImageSizes(html, [null, { widthPx: 480, heightPx: 320 }]);
    assert.match(out, /<img src="a\.png" \/>/);
    assert.match(out, /<img src="b\.png" data-bua-w="480"/);
  });

  test('sin tamaños devuelve el HTML original', () => {
    const html = '<p><img src="a.png" /></p>';
    assert.equal(assignDocxImageSizes(html, []), html);
  });
});

describe('DocxParser — el tamaño de Word llega al HTML', () => {
  test('cada <img> sale anotada con su tamaño de presentación', async () => {
    const buffer = await buildDocx([
      new Paragraph({
        children: [
          new ImageRun({ type: 'png', data: pngData(), transformation: { width: 24, height: 18 } }),
          new TextRun('Logo y texto'),
        ],
      }),
    ]);
    const file = new File([buffer], 'logo.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const { html } = await new DocxParser().parse(file);
    assert.match(html, /data-bua-w="24"/);
    assert.match(html, /data-bua-h="18"/);
  });
});
