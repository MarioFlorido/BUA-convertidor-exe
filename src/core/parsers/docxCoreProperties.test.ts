/**
 * Tests de las propiedades del documento de un DOCX (docProps/core.xml).
 *
 * Son tests de integración: generan un DOCX real con la librería `docx`
 * (devDep), que escribe `core.xml` con los mismos elementos `dc:` que Word,
 * y comprueban que salen enteros: con dos puntos, acentos y más de 255
 * caracteres, todo lo que un nombre de fichero no admite.
 *
 * Runner: node:test vía tsx.
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { readDocxCoreProperties } from './docxCoreProperties';
import { DocxParser } from './DocxParser';

const LONG_TITLE =
  'Normativa y redacción del TFM en Arqueología profesional y gestión integral del patrimonio, ' +
  'Estudios políticos, económicos y sociales contemporáneos de América Latina, ' +
  'Historia de la Europa contemporánea: identidades e integración, ' +
  'Historia del mundo mediterráneo y sus regiones. De la prehistoria a la Edad Media, ' +
  'Historia e identidades en el mediterráneo occidental (siglos XV-XIX)';

async function buildDocx(props: { title?: string; creator?: string; description?: string }) {
  const doc = new Document({
    ...props,
    sections: [{ children: [new Paragraph({ children: [new TextRun('Cuerpo.')] })] }],
  });
  const buffer = await Packer.toBuffer(doc);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

describe('readDocxCoreProperties', () => {
  test('Comentarios largo, con dos puntos y acentos, sale entero', async () => {
    assert.ok(LONG_TITLE.length > 255, 'el fixture debe superar el límite de un nombre de fichero');
    const props = readDocxCoreProperties(await buildDocx({ description: LONG_TITLE }));
    assert.equal(props.description, LONG_TITLE);
  });

  test('Título y Autor se leen también', async () => {
    const props = readDocxCoreProperties(
      await buildDocx({ title: 'Guía & normas <2026>', creator: 'Biblioteca UA' }),
    );
    assert.equal(props.title, 'Guía & normas <2026>');
    assert.equal(props.author, 'Biblioteca UA');
  });

  test('propiedades vacías no aparecen', async () => {
    const props = readDocxCoreProperties(await buildDocx({ description: '   ' }));
    assert.equal(props.description, undefined);
    assert.equal(props.title, undefined);
  });

  test('saltos de línea de Word (_x000d_) se aplanan a un espacio', async () => {
    const props = readDocxCoreProperties(
      await buildDocx({ description: 'Primera línea_x000d_\nSegunda línea' }),
    );
    assert.equal(props.description, 'Primera línea Segunda línea');
  });

  test('un archivo que no es ZIP devuelve un objeto vacío', () => {
    const props = readDocxCoreProperties(new TextEncoder().encode('no soy un zip').buffer as ArrayBuffer);
    assert.deepEqual(props, {});
  });
});

describe('DocxParser.parse expone las propiedades', () => {
  test('metadata.description llega desde el DOCX', async () => {
    const file = new File([await buildDocx({ description: LONG_TITLE })], 'Normativa TFM.docx');
    const { metadata } = await new DocxParser().parse(file);
    assert.equal(metadata.description, LONG_TITLE);
  });
});
