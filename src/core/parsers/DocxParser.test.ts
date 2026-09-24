/**
 * Tests de DocxParser — conservación de SANGRÍAS de párrafo (MLA/APA) y
 * reparación de los enlaces pegados con opciones (\t, \o).
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
import { zipSync, strToU8 } from 'fflate';
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

/**
 * Enlaces pegados (código de campo HYPERLINK) con opciones detrás de la URL.
 * La librería `docx` no genera códigos de campo, así que el DOCX se monta a
 * mano: solo lo imprescindible para que Mammoth lo abra.
 */
async function parseDocumentXml(bodyXml: string): Promise<string> {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const zip = zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    'word/document.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${bodyXml}</w:body></w:document>`,
    ),
  });
  const file = new File([zip], 'test.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const { html } = await new DocxParser().parse(file);
  return html;
}

/** Párrafo con un enlace en negrita hecho con código de campo. */
function fieldLinkParagraph(instr: string, text: string): string {
  const bold = '<w:rPr><w:b/></w:rPr>';
  return (
    `<w:p><w:r>${bold}<w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r>${bold}<w:instrText xml:space="preserve">${instr}</w:instrText></w:r>` +
    `<w:r>${bold}<w:fldChar w:fldCharType="separate"/></w:r>` +
    `<w:r>${bold}<w:t>${text}</w:t></w:r>` +
    `<w:r>${bold}<w:fldChar w:fldCharType="end"/></w:r></w:p>`
  );
}

describe('DocxParser — enlaces pegados con opciones', () => {
  test('\\t "_blank" detrás de la URL no se cuela en el href', async () => {
    // Caso real: «Fuentes de información especializada para el TFG en Ciencias».
    const html = await parseDocumentXml(
      fieldLinkParagraph(
        ' HYPERLINK "https://www.ams.org/publications/journals/journals" \\t "_blank" ',
        'American Mathematical Society',
      ),
    );
    assert.equal(
      html,
      '<p><strong><a href="https://www.ams.org/publications/journals/journals">American Mathematical Society</a></strong></p>',
    );
  });

  test('\\o "información" detrás de la URL tampoco', async () => {
    const html = await parseDocumentXml(
      fieldLinkParagraph(' HYPERLINK "https://dialnet.unirioja.es/tesis" \\o "Dialnet" ', 'Dialnet Plus'),
    );
    assert.match(html, /<a href="https:\/\/dialnet\.unirioja\.es\/tesis">Dialnet Plus<\/a>/);
  });

  test('ancla interna (\\l) con opciones → solo el nombre del marcador', async () => {
    const html = await parseDocumentXml(
      fieldLinkParagraph(' HYPERLINK \\l "_Toc123" \\o "Ir al apartado" ', 'Apartado'),
    );
    assert.match(html, /<a href="#_Toc123">Apartado<\/a>/);
  });

  test('un enlace pegado sin opciones sale igual que con Mammoth', async () => {
    const html = await parseDocumentXml(
      fieldLinkParagraph(' HYPERLINK "https://aquadocs.org/" ', 'Aqua Docs'),
    );
    assert.equal(html, '<p><strong><a href="https://aquadocs.org/">Aqua Docs</a></strong></p>');
  });
});
