/**
 * Tests de DocxParser — conservación de SANGRÍAS de párrafo (MLA/APA).
 *
 * Runner: node:test vía tsx (sin dependencias extra).
 *   npm test            → ejecuta todos los *.test.ts
 *
 * Mammoth lee w:ind en su modelo pero no lo vuelca al HTML; DocxParser lo
 * reconstruye como `style` inline. Estos tests son de integración: generan un
 * DOCX real con la librería `docx` (devDep) y lo pasan por el parser completo.
 * No necesitan DOM: applyIndentMarkers opera con regex sobre strings.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { DocxParser } from './DocxParser';

// 720 twips = 0.5in = 36pt ; 480 twips = 24pt
async function parseParagraphs(children: Paragraph[]): Promise<string> {
  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  const file = new File([buffer], 'test.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const { html } = await new DocxParser().parse(file);
  return html;
}

describe('DocxParser — conservación de sangrías', () => {
  let html = '';

  before(async () => {
    html = await parseParagraphs([
      new Paragraph({ children: [new TextRun('Párrafo normal sin sangría.')] }),
      // MLA: sangría izquierda de bloque
      new Paragraph({
        indent: { left: 720 },
        children: [new TextRun('Cita MLA con sangría izquierda.')],
      }),
      // APA: sangría francesa (hanging)
      new Paragraph({
        indent: { left: 720, hanging: 720 },
        children: [new TextRun('Referencia APA con sangría francesa.')],
      }),
      // Sangría de primera línea
      new Paragraph({
        indent: { firstLine: 480 },
        children: [new TextRun('Párrafo con sangría de primera línea.')],
      }),
      // Párrafo vacío con sangría (no debe resucitar)
      new Paragraph({ indent: { left: 720 }, children: [] }),
      // Lista con viñetas (no debe recibir style de sangría)
      new Paragraph({ text: 'Elemento de lista', bullet: { level: 0 } }),
      new Paragraph({ children: [new TextRun('Párrafo final normal.')] }),
    ]);
  });

  test('sangría izquierda (MLA) → margin-left en pt', () => {
    assert.match(html, /<p style="margin-left:36pt">Cita MLA con sangría izquierda\.<\/p>/);
  });

  test('sangría francesa (APA) → margin-left + text-indent negativo', () => {
    assert.match(
      html,
      /<p style="margin-left:36pt;text-indent:-36pt">Referencia APA con sangría francesa\.<\/p>/,
    );
  });

  test('sangría de primera línea → text-indent positivo', () => {
    assert.match(html, /<p style="text-indent:24pt">Párrafo con sangría de primera línea\.<\/p>/);
  });

  test('párrafo sin sangría → <p> sin atributos', () => {
    assert.ok(html.includes('<p>Párrafo normal sin sangría.</p>'));
    assert.ok(html.includes('<p>Párrafo final normal.</p>'));
  });

  test('las listas no reciben sangría inyectada', () => {
    assert.ok(html.includes('<li>Elemento de lista</li>'));
    assert.doesNotMatch(html, /<li style=/);
  });

  test('párrafo vacío con sangría no resucita', () => {
    assert.doesNotMatch(html, /<p style="[^"]*"><\/p>/);
  });

  test('no quedan marcadores residuales en la salida', () => {
    assert.ok(!html.includes('\uE000') && !html.includes('\uE001'));
  });
});

describe('DocxParser — sin sangrías', () => {
  test('un documento sin sangrías no introduce ningún style', async () => {
    const html = await parseParagraphs([
      new Paragraph({ children: [new TextRun('Uno.')] }),
      new Paragraph({ children: [new TextRun('Dos.')] }),
    ]);
    assert.equal(html, '<p>Uno.</p><p>Dos.</p>');
  });
});
