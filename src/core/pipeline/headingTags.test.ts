/**
 * Tests de las etiquetas de estructura al final de los títulos del Word
 * («Los gestores bibliográficos [Subpágina]»).
 *
 * Lo que se protege:
 *  - que sin etiquetas el HTML no cambie ni un byte;
 *  - que la etiqueta se lea con todas sus variantes y se aplique como valor
 *    inicial del paso 2;
 *  - que se quite en un ÚNICO punto y no asome en títulos de página, rótulos
 *    de acordeón, contenido ni huella de memoria;
 *  - los avisos (errata, otro nivel, título vacío, primera página).
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

import {
  stripHeadingTags,
  detectFirstPageTagIssue,
  describeHeadingTagIssue,
  applyWordStructure,
  hasWordStructure,
  matchesWordStructure,
  HEADING_TAG_ATTR,
} from './headingTags';
import { parseDocumentStructure } from './parseStructure';
import { buildProjectFromStructure } from './buildFromStructure';
import { convertHtmlToSemanticDocument } from './docxToSemanticDocument';
import { structureTitles } from '../services/structureMemory';

/** Pipeline del wizard: quitar etiquetas → estructura → SemanticDocument. */
async function convert(rawHtml: string) {
  const { html, issues } = stripHeadingTags(rawHtml);
  const structure = await parseDocumentStructure(html);
  return { html, issues, structure, doc: buildProjectFromStructure(html, 'test.docx', structure) };
}

describe('stripHeadingTags — lectura y retirada', () => {
  test('sin etiquetas, el HTML sale byte a byte como entró', () => {
    const html =
      '<h1>Normativa [2024]</h1><p>Texto con [corchetes] y <br />saltos.</p>' +
      '<h2>Apartado</h2><p>[ejemplo]</p><p>caja</p><p>[fin]</p>';
    const result = stripHeadingTags(html);
    assert.equal(result.html, html);
    assert.deepEqual(result.issues, []);
  });

  test('la etiqueta se quita del título y queda anotada en el encabezado', () => {
    const { html, issues } = stripHeadingTags(
      '<h1>Los gestores bibliográficos [Subpágina]</h1><p>x</p>',
    );
    assert.equal(
      html,
      `<h1 ${HEADING_TAG_ATTR}="subpagina">Los gestores bibliográficos</h1><p>x</p>`,
    );
    assert.deepEqual(issues, []);
  });

  test('solo cuenta al FINAL del título', () => {
    const html = '<h1>[Subpágina] Los gestores</h1><h2>Qué [Acordeón] son</h2>';
    assert.equal(stripHeadingTags(html).html, html);
  });

  test('tolera espacios y un punto final detrás', () => {
    for (const title of ['Gestores [Subpágina].', 'Gestores [Subpágina] ', 'Gestores&nbsp;[Subpágina]&nbsp;. ']) {
      const { html } = stripHeadingTags(`<h1>${title}</h1>`);
      assert.equal(html, `<h1 ${HEADING_TAG_ATTR}="subpagina">Gestores</h1>`, title);
    }
  });

  test('variantes: mayúsculas, tildes, espacios, singular/plural y formas de «3er»', () => {
    const h1: [string, string][] = [
      ['[PÁGINA PRINCIPAL]', 'pagina-principal'],
      ['[pagina principal]', 'pagina-principal'],
      ['[  Subpagina ]', 'subpagina'],
      ['[Subpáginas]', 'subpagina'],
      ['[3er nivel]', '3er-nivel'],
      ['[3.er nivel]', '3er-nivel'],
      ['[3º nivel]', '3er-nivel'],
      ['[Tercer Nivel]', '3er-nivel'],
    ];
    for (const [written, key] of h1) {
      const { html } = stripHeadingTags(`<h1>Título ${written}</h1>`);
      assert.equal(html, `<h1 ${HEADING_TAG_ATTR}="${key}">Título</h1>`, written);
    }

    const h2: [string, string][] = [
      ['[Título de iDevice]', 'titulo-idevice'],
      ['[titulo de idevice]', 'titulo-idevice'],
      ['[Cabecera 2 en texto]', 'cabecera-2'],
      ['[ACORDEON]', 'acordeon'],
      ['[Acordeones]', 'acordeon'],
      ['[Pestañas]', 'pestanas'],
      ['[Pestaña]', 'pestanas'],
    ];
    for (const [written, key] of h2) {
      const { html } = stripHeadingTags(`<h2>Título ${written}</h2>`);
      assert.equal(html, `<h2 ${HEADING_TAG_ATTR}="${key}">Título</h2>`, written);
    }
  });

  test('etiqueta partida por el formato de Word y atributos del encabezado', () => {
    const { html } = stripHeadingTags(
      '<h1 style="margin-left:18pt"><a id="_Toc1"></a>Gestores <strong>[Sub</strong>página]</h1>',
    );
    assert.equal(
      html,
      `<h1 style="margin-left:18pt" ${HEADING_TAG_ATTR}="subpagina"><a id="_Toc1"></a>Gestores<strong></strong></h1>`,
    );
  });

  test('conserva el enlace y el logo del título', () => {
    const { html } = stripHeadingTags(
      '<h2><img src="logo.png" /><a href="https://ua.es">Web de la UA</a> [Acordeón]</h2>',
    );
    assert.equal(
      html,
      `<h2 ${HEADING_TAG_ATTR}="acordeon"><img src="logo.png" /><a href="https://ua.es">Web de la UA</a></h2>`,
    );
  });
});

describe('stripHeadingTags — avisos', () => {
  test('corchete casi igual a una etiqueta: se deja como texto y se avisa', () => {
    const html = '<h1>Gestores [Subpagna]</h1><h2>Qué son [Acordion]</h2>';
    const result = stripHeadingTags(html);
    assert.equal(result.html, html);
    assert.deepEqual(
      result.issues.map((i) => [i.kind, i.label, i.context]),
      [
        ['heading-tag-typo', 'Subpágina', 'Gestores [Subpagna]'],
        ['heading-tag-typo', 'Acordeón', 'Qué son [Acordion]'],
      ],
    );
  });

  test('corchete que no se parece a ninguna etiqueta: texto, sin aviso', () => {
    const html = '<h1>Normativa [2024]</h1><h2>Guía [PDF]</h2><h2>Recursos [en línea]</h2>';
    const result = stripHeadingTags(html);
    assert.equal(result.html, html);
    assert.deepEqual(result.issues, []);
  });

  test('etiqueta de otro nivel: se quita, no se aplica y se avisa', () => {
    const result = stripHeadingTags(
      '<h1>Gestores [Acordeón]</h1><h2>Qué son [Subpágina]</h2><h3>Detalle [Pestañas]</h3>',
    );
    assert.equal(result.html, '<h1>Gestores</h1><h2>Qué son</h2><h3>Detalle</h3>');
    assert.deepEqual(
      result.issues.map((i) => [i.kind, i.label, i.heading]),
      [
        ['heading-tag-wrong-level', 'Acordeón', 1],
        ['heading-tag-wrong-level', 'Subpágina', 2],
        ['heading-tag-wrong-level', 'Pestañas', 3],
      ],
    );
  });

  test('título que solo tiene la etiqueta: se deja como está y se avisa', () => {
    const html = '<h1>Intro</h1><h1>[Subpágina]</h1><p>contenido</p>';
    const result = stripHeadingTags(html);
    assert.equal(result.html, html);
    assert.deepEqual(result.issues.map((i) => i.kind), ['heading-tag-only']);
  });

  test('etiqueta distinta de principal en el primer Título 1: se ignora y se avisa', async () => {
    const { structure, issues } = await convert(
      '<h1>Intro [Subpágina]</h1><p>a</p><h1>Dos [Subpágina]</h1><p>b</p>',
    );
    assert.deepEqual(issues, []);
    assert.deepEqual(structure.h1Sections.map((s) => s.level), [1, 2]);
    assert.deepEqual(structure.h1Sections.map((s) => s.title), ['Intro', 'Dos']);
    const first = detectFirstPageTagIssue(structure);
    assert.deepEqual(first.map((i) => [i.kind, i.context]), [['heading-tag-first-page', 'Intro']]);
  });

  test('con contenido antes del primer Título 1, su etiqueta SÍ vale', async () => {
    // La sección sintética «Contenido» es la primera página; el primer Título 1
    // ya tiene de quién colgar.
    const { structure } = await convert('<p>previo</p><h1>Uno [Subpágina]</h1><p>a</p>');
    assert.deepEqual(structure.h1Sections.map((s) => s.level), [1, 2]);
    assert.deepEqual(detectFirstPageTagIssue(structure), []);
  });

  test('[Página principal] en el primer Título 1 no avisa', async () => {
    const { structure } = await convert('<h1>Intro [Página principal]</h1><p>a</p>');
    assert.deepEqual(detectFirstPageTagIssue(structure), []);
  });

  test('todos los avisos tienen un mensaje legible', () => {
    const { issues } = stripHeadingTags(
      '<h1>A [Subpagna]</h1><h1>B [Acordeón]</h1><h1>[Subpágina]</h1><h4>C [Pestañas]</h4>',
    );
    assert.equal(issues.length, 4);
    for (const issue of issues) {
      const message = describeHeadingTagIssue(issue);
      assert.ok(message.length > 20, message);
      assert.doesNotMatch(message, /undefined/);
    }
  });
});

describe('etiquetas → estructura inicial del paso 2', () => {
  const DOC =
    '<h1>Presentación [Página principal]</h1><p>p0</p>' +
    '<h1>Gestores [Subpágina]</h1><p>p1</p>' +
    '<h2>Qué son [Acordeón]</h2><p>a1</p>' +
    '<h2>Para qué sirven [Acordeón]</h2><p>a2</p>' +
    '<h2>Resumen</h2><p>r</p>' +
    '<h1>Zotero [3er nivel]</h1><p>p2</p>' +
    '<h2>Instalación [Título de iDevice]</h2><p>i1</p>' +
    '<h1>Sin etiqueta</h1><p>p3</p>';

  test('niveles y opciones salen de las etiquetas; sin etiqueta, por defecto', async () => {
    const { structure } = await convert(DOC);
    assert.deepEqual(structure.h1Sections.map((s) => s.level), [1, 2, 3, 1]);
    assert.deepEqual(
      structure.h1Sections.flatMap((s) => s.h2Items.map((h2) => h2.option)),
      ['accordion', 'accordion', 'html', 'idevice-title'],
    );
    assert.ok(hasWordStructure(structure));
    assert.ok(matchesWordStructure(structure));
  });

  test('sin etiquetas la estructura no lleva ningún campo nuevo', async () => {
    const { structure } = await convert('<h1>A</h1><h2>B</h2><p>x</p>');
    assert.deepEqual(structure, {
      h1Sections: [
        { id: 'h1-1', title: 'A', level: 1, h2Items: [{ id: 'h2-1-1', text: 'B', option: 'html' }] },
      ],
    });
    assert.equal(hasWordStructure(structure), false);
  });

  test('la etiqueta no asoma en títulos, rótulos ni contenido', async () => {
    const { structure, doc } = await convert(DOC);
    assert.deepEqual(
      structure.h1Sections.map((s) => s.title),
      ['Presentación', 'Gestores', 'Zotero', 'Sin etiqueta'],
    );
    const everything = JSON.stringify(doc) + JSON.stringify(structure);
    assert.doesNotMatch(everything, /\[(Sub|P[aá]g|3er|Acorde|T[ií]tulo de)/i);
    assert.doesNotMatch(JSON.stringify(doc), new RegExp(HEADING_TAG_ATTR));
    // Y el contenido sigue en su sitio.
    assert.match(JSON.stringify(doc), /Qué son/);
    assert.match(JSON.stringify(doc), /a1/);
  });

  test('el atributo tampoco sale por las transformaciones ni por la ruta sin estructura', async () => {
    const { html } = stripHeadingTags(DOC);
    const options = {
      heading1Mode: 'page',
      heading2Mode: 'page',
      heading3Mode: 'block',
      heading4Mode: 'block',
    } as const;
    const structure = await parseDocumentStructure(html);
    const wizard = await convertHtmlToSemanticDocument(html, 'test.docx', options, undefined, undefined, structure);
    const legacy = await convertHtmlToSemanticDocument(html, 'test.docx', options);
    for (const doc of [wizard, legacy]) {
      assert.doesNotMatch(JSON.stringify(doc), new RegExp(HEADING_TAG_ATTR));
      assert.doesNotMatch(JSON.stringify(doc), /\[(Sub|3er|Acorde)/i);
    }
  });

  test('simetría estructura↔contenido: mismo reparto con y sin etiquetas', async () => {
    const tagged = await convert(DOC);
    const plain = await convert(DOC.replace(/ \[[^\]]+\]/g, ''));
    // Mismas páginas y mismo contenido en cada una, con la estructura por defecto.
    const defaults = applyWordStructure({
      h1Sections: tagged.structure.h1Sections.map((h1) => ({
        ...h1,
        wordLevel: undefined,
        h2Items: h1.h2Items.map((h2) => ({ ...h2, wordOption: undefined })),
      })),
    });
    const taggedDoc = buildProjectFromStructure(tagged.html, 'test.docx', defaults);
    assert.deepEqual(taggedDoc, plain.doc);
  });

  test('la huella de títulos de la memoria es la misma con y sin etiquetas', async () => {
    const tagged = await convert(DOC);
    const plain = await convert(DOC.replace(/ \[[^\]]+\]/g, ''));
    assert.equal(structureTitles(tagged.structure), structureTitles(plain.structure));
  });

  test('«Volver a lo que dice el Word» deshace los cambios del paso 2', async () => {
    const { structure } = await convert(DOC);
    const edited = {
      h1Sections: structure.h1Sections.map((h1) => ({
        ...h1,
        level: 1 as const,
        h2Items: h1.h2Items.map((h2) => ({ ...h2, option: 'tabs' as const })),
      })),
    };
    assert.equal(matchesWordStructure(edited), false);
    assert.deepEqual(applyWordStructure(edited), structure);
  });
});
