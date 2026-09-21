/**
 * Tests de docxToSemanticDocument — ruta legacy (sin estructura del wizard).
 *
 * La sanitización de esa ruta (normalizeImportedNode) disuelve los <div> y
 * reconstruye las <table> sin atributos: estos tests garantizan que las clases
 * bua_* generadas por el etiquetado semántico ([importante], [horizontal]…)
 * SOBREVIVEN a la sanitización, igual que en la ruta del wizard.
 *
 * También el título del documento: sale del nombre del fichero salvo que el
 * DOCX traiga «Comentarios» en sus propiedades (docProps/core.xml).
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

import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import {
  convertHtmlToSemanticDocument,
  convertDocxToSemanticDocument,
  resolveDocumentTitle,
} from './docxToSemanticDocument';
import { parseDocumentStructure } from './parseStructure';
import { DocxParser } from '../parsers/DocxParser';
import { ELP_CONVERSION_DESCRIPTION } from '../parsers/docxCoreProperties';

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

// ── Título: nombre del fichero o «Comentarios» del DOCX ──────────────────────

const LONG_TITLE =
  'Normativa y redacción del TFM en Arqueología profesional y gestión integral del patrimonio, ' +
  'Historia de la Europa contemporánea: identidades e integración, ' +
  'Historia e identidades en el mediterráneo occidental (siglos XV-XIX)';

async function docxFile(name: string, description?: string): Promise<File> {
  const doc = new Document({
    description,
    sections: [
      {
        children: [
          new Paragraph({ text: 'Tema', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: 'Cuerpo del tema.' }),
        ],
      },
    ],
  });
  return new File([await Packer.toBuffer(doc)], name);
}

describe('convertDocxToSemanticDocument — título del documento', () => {
  test('sin Comentarios, el título es el nombre del fichero sin extensión', async () => {
    const file = await docxFile('Normativa TFM.docx');
    const doc = await convertDocxToSemanticDocument(file, OPTIONS as any);
    assert.equal(doc.title, 'Normativa TFM');
  });

  test('con Comentarios, el título es el de Comentarios (ruta legacy)', async () => {
    const file = await docxFile('Normativa TFM.docx', LONG_TITLE);
    const doc = await convertDocxToSemanticDocument(file, OPTIONS as any);
    assert.equal(doc.title, LONG_TITLE);
  });

  test('con Comentarios, el título es el de Comentarios (ruta del wizard, HTML ya parseado)', async () => {
    const file = await docxFile('Normativa TFM.docx', LONG_TITLE);
    const parsed = await new DocxParser().parse(file);
    const structure = await parseDocumentStructure(parsed.html);
    const doc = await convertDocxToSemanticDocument(file, OPTIONS as any, structure, undefined, parsed);
    assert.equal(doc.title, LONG_TITLE);
    // Solo cambia el título del documento: la página sigue llamándose como su H1
    assert.equal(doc.pages[0].title, 'Tema');
  });
});

describe('resolveDocumentTitle — título y su origen', () => {
  // La pantalla enseña el origen antes de convertir y la pipeline decide el
  // título al convertir. Si cada una lo calculara por su cuenta podrían contar
  // cosas distintas, que es el fallo que este aviso viene a evitar.

  test('con «Comentarios», el título sale de ahí', () => {
    const r = resolveDocumentTitle('nombre superlargo.docx', LONG_TITLE);
    assert.equal(r.title, LONG_TITLE);
    assert.equal(r.source, 'description');
  });

  test('sin «Comentarios», el título sale del nombre del fichero', () => {
    const r = resolveDocumentTitle('nombre superlargo.docx', undefined);
    assert.equal(r.title, 'nombre superlargo');
    assert.equal(r.source, 'filename');
  });

  test('«Comentarios» en blanco cuenta como vacío', () => {
    for (const vacio of ['', '   ', '\n\t']) {
      const r = resolveDocumentTitle('documento.docx', vacio);
      assert.equal(r.title, 'documento', JSON.stringify(vacio));
      assert.equal(r.source, 'filename', JSON.stringify(vacio));
    }
  });

  test('sin nombre aprovechable queda el respaldo de siempre', () => {
    const r = resolveDocumentTitle('.docx', undefined);
    assert.equal(r.title, 'Documento importado');
    assert.equal(r.source, 'filename');
  });

  test('lo que anuncia la pantalla es lo que acaba en el documento', async () => {
    for (const description of [LONG_TITLE, undefined]) {
      const file = await docxFile('nombre superlargo.docx', description);
      const doc = await convertDocxToSemanticDocument(file, OPTIONS as any);
      const anunciado = resolveDocumentTitle('nombre superlargo.docx', description);
      assert.equal(doc.title, anunciado.title, String(description));
    }
  });
});

describe('resolveDocumentTitle — texto de plantilla en «Comentarios»', () => {
  // La plantilla por defecto de python-docx deja «generated by python-docx» en
  // Comentarios, así que TODOS los documentos hechos con esa librería salían
  // titulados con esa frase. Nadie la escribió: no es un título.
  const BOILERPLATE = 'generated by python-docx';

  test('el texto de python-docx no cuenta como título', () => {
    const r = resolveDocumentTitle('Guía del TFM.docx', BOILERPLATE);
    assert.equal(r.title, 'Guía del TFM');
    assert.equal(r.source, 'filename');
  });

  test('da igual cómo venga escrito', () => {
    for (const variante of [
      'Generated by python-docx',
      'GENERATED BY PYTHON-DOCX',
      '  generated by python-docx  ',
      'generated  by\n python-docx',
    ]) {
      const r = resolveDocumentTitle('Guía del TFM.docx', variante);
      assert.equal(r.source, 'filename', JSON.stringify(variante));
    }
  });

  test('un título de verdad que mencione la herramienta sí se respeta', () => {
    // Se descarta la frase exacta, no cualquier texto que la contenga.
    const titulo = 'Cómo generar documentos con python-docx: guía práctica';
    const r = resolveDocumentTitle('Guía.docx', titulo);
    assert.equal(r.title, titulo);
    assert.equal(r.source, 'description');
  });

  test('de punta a punta: el documento se titula con el nombre del fichero', async () => {
    const file = await docxFile('Guía del TFM.docx', BOILERPLATE);
    const doc = await convertDocxToSemanticDocument(file, OPTIONS as any);
    assert.equal(doc.title, 'Guía del TFM');
  });

  test('tampoco cuenta el texto que deja nuestro conversor de .elp', async () => {
    // .elp antiguo → Word → ELPX es el camino para el que existe la
    // herramienta, y el Word intermedio trae ese Comentarios puesto por
    // nosotros (elpToDocx.ts). Es la MISMA constante en los dos lados.
    const r = resolveDocumentTitle('Curso de alfabetización.docx', ELP_CONVERSION_DESCRIPTION);
    assert.equal(r.title, 'Curso de alfabetización');
    assert.equal(r.source, 'filename');

    const file = await docxFile('Curso de alfabetización.docx', ELP_CONVERSION_DESCRIPTION);
    const doc = await convertDocxToSemanticDocument(file, OPTIONS as any);
    assert.equal(doc.title, 'Curso de alfabetización');
  });
});
