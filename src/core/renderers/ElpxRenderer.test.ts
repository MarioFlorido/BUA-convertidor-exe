/**
 * Tests del ElpxRenderer: estado de plegado (`minimized`) de los iDevices y
 * opciones de exportación (odeProperties pp_*).
 *
 * Regla de negocio: los iDevices con título (H2 marcado como «título de
 * iDevice» → cabecera + marco contenedor) se generan PLEGADOS, tanto en el
 * content.xml de eXeLearning como en las páginas de vista previa del ZIP. Los
 * bloques sin título no tienen cabecera sobre la que plegar → van desplegados.
 *
 * Runner: node:test vía tsx. Necesita DOM → jsdom como global (PreviewService
 * usa DOMParser).
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { unzipSync, strFromU8 } from 'fflate';

// ── Setup DOM global (PreviewService usa DOMParser) ───────────────────────────
const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
const g = globalThis as Record<string, unknown>;
g.DOMParser = jsdom.window.DOMParser;

import { ElpxRenderer } from './ElpxRenderer';
import type { SemanticDocument } from '../models/SemanticDocument';
import { ThemeRegistry } from '../services/ThemeRegistry';
import { BOLD_LINK_COLOR_CSS } from '../utils/boldLinkColor';

/** Carga el template base (public/base.elpx) como entries descomprimidos. */
function loadBaseTemplate(): { entries: Record<string, Uint8Array> } {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const baseElpx = path.resolve(here, '../../../public/base.elpx');
  const entries = unzipSync(new Uint8Array(readFileSync(baseElpx)));
  return { entries };
}

/** Documento con un bloque CON título y otro SIN título en la misma página. */
function makeDocument(): SemanticDocument {
  return {
    title: 'Documento de prueba',
    subtitle: '',
    pages: [
      {
        title: 'Página 1',
        level: 1,
        parentIndex: null,
        blocks: [
          { title: '', html: '<p>Intro sin título.</p>' },
          { title: 'iDevice con título', html: '<p>Contenido plegado.</p>' },
        ],
      },
    ],
  };
}

/** Extrae el content.xml del ZIP renderizado. */
function readContentXml(blob: Uint8Array): string {
  return strFromU8(unzipSync(blob)['content.xml']);
}

/** Lee el valor de una odeProperty del content.xml. */
function odeProperty(xml: string, key: string): string | undefined {
  const pattern = new RegExp(`<key>${key}</key><value>([^<]*)</value>`);
  return pattern.exec(xml)?.[1];
}

describe('ElpxRenderer — estado de plegado (minimized)', () => {
  test('content.xml: bloque con título → minimized true; sin título → false', async () => {
    const renderer = new ElpxRenderer(loadBaseTemplate(), makeDocument());
    const { blobData } = await renderer.render({});
    const xml = readContentXml(blobData);

    // El bloque sin título va primero (order 0) y el titulado después (order 1).
    const untitled = xml.slice(xml.indexOf('<blockName></blockName>'));
    const titled = xml.slice(xml.indexOf('<blockName>IDEVICE CON TÍTULO</blockName>'));

    const minimizedValue = (fragment: string): string => {
      const marker = fragment.indexOf('<key>minimized</key>');
      return /<value>(true|false)<\/value>/.exec(fragment.slice(marker))?.[1] ?? '';
    };

    assert.equal(minimizedValue(untitled), 'false', 'bloque sin título no debe plegarse');
    assert.equal(minimizedValue(titled), 'true', 'bloque con título debe plegarse');
  });

  test('preview: <article> del bloque con título lleva la clase "minimized"', async () => {
    const renderer = new ElpxRenderer(loadBaseTemplate(), makeDocument());
    const { previewPages } = await renderer.render({});
    const html = previewPages['index.html'];

    assert.match(html, /class="box minimized"/, 'el bloque con título debe salir plegado en la preview');
    assert.match(html, /class="box-toggle box-toggle-off"/);
    // El bloque sin título permanece desplegado.
    assert.match(html, /class="box">/, 'el bloque sin título no debe plegarse en la preview');
    assert.match(html, /class="box-toggle box-toggle-on"/);
  });
});

describe('ElpxRenderer — opciones de exportación', () => {
  test('content.xml: la caja de búsqueda viene activada de serie', async () => {
    const renderer = new ElpxRenderer(loadBaseTemplate(), makeDocument());
    const { blobData } = await renderer.render({});
    const xml = readContentXml(blobData);

    assert.equal(
      odeProperty(xml, 'pp_addSearchBox'),
      'true',
      'el ELPX debe llegar a eXeLearning con el buscador ya marcado',
    );
  });

  test('content.xml: el resto de extras de exportación siguen desactivados', async () => {
    const renderer = new ElpxRenderer(loadBaseTemplate(), makeDocument());
    const { blobData } = await renderer.render({});
    const xml = readContentXml(blobData);

    // La barra de accesibilidad se dejó fuera a propósito: son ~650 KB de
    // fuentes (OpenDyslexic/Atkinson) por curso exportado. Decisión pendiente.
    assert.equal(odeProperty(xml, 'pp_addAccessibilityToolbar'), 'false');
    assert.equal(odeProperty(xml, 'pp_addExeLink'), 'false');
    assert.equal(odeProperty(xml, 'pp_addPagination'), 'false');
    assert.equal(odeProperty(xml, 'pp_addMathJax'), 'false');
  });
});

describe('ElpxRenderer — enlaces en negrita', () => {
  // El tema pinta `.exe-content strong` en gris: sin esta regla, un enlace
  // hecho con Ctrl+K sobre texto en negrita (<a><strong>) salía gris y sin
  // subrayar, igual que una negrita cualquiera (ver boldLinkColor.ts).
  test('content.xml: la negrita dentro de un enlace hereda el color del enlace', async () => {
    const renderer = new ElpxRenderer(loadBaseTemplate(), makeDocument());
    const { blobData } = await renderer.render({});
    const extraHead = odeProperty(readContentXml(blobData), 'pp_extraHeadContent') ?? '';
    assert.ok(extraHead.includes(BOLD_LINK_COLOR_CSS), 'la regla debe viajar en pp_extraHeadContent');
  });

  test('preview: las páginas del ZIP llevan la misma regla', async () => {
    const renderer = new ElpxRenderer(loadBaseTemplate(), makeDocument());
    const { previewPages } = await renderer.render({});
    assert.ok(previewPages['index.html'].includes(BOLD_LINK_COLOR_CSS));
  });
});

describe('ElpxRenderer — pp_subtitle y pp_lang según el idioma del tema', () => {
  // Los materiales de la BUA no son solo en castellano: hay temas en
  // valenciano (CID_va, Doctorat…) y en inglés (PhD, Open_Science…). El
  // subtítulo por defecto y pp_lang (accesibilidad: lectores de pantalla)
  // deben seguir al idioma del tema elegido, no venir fijos en castellano
  // (ver metadata.language en themes-config.json). pp_author SÍ se deja
  // fijo en castellano siempre: es el nombre de la institución, no se
  // traduce.
  const registerTestTheme = (id: string, language: string) => {
    ThemeRegistry.register({ id, name: id, source: 'user', files: {}, metadata: { name: id, language } });
  };

  test('tema sin idioma conocido (o sin registrar) → castellano', async () => {
    const renderer = new ElpxRenderer(loadBaseTemplate(), makeDocument());
    const { blobData } = await renderer.render({});
    const xml = readContentXml(blobData);

    assert.equal(odeProperty(xml, 'pp_subtitle'), 'Biblioteca Universitaria');
    assert.equal(odeProperty(xml, 'pp_lang'), 'es');
  });

  test('tema en valenciano (ca) → "Biblioteca Universitària" y pp_lang=ca', async () => {
    registerTestTheme('tema-test-ca', 'ca');
    try {
      const renderer = new ElpxRenderer(loadBaseTemplate(), makeDocument());
      const { blobData } = await renderer.render({ themeId: 'tema-test-ca' });
      const xml = readContentXml(blobData);

      assert.equal(odeProperty(xml, 'pp_subtitle'), 'Biblioteca Universitària');
      assert.equal(odeProperty(xml, 'pp_lang'), 'ca');
    } finally {
      ThemeRegistry.remove('tema-test-ca');
    }
  });

  test('tema en inglés (en) → "University Library" y pp_lang=en', async () => {
    registerTestTheme('tema-test-en', 'en');
    try {
      const renderer = new ElpxRenderer(loadBaseTemplate(), makeDocument());
      const { blobData } = await renderer.render({ themeId: 'tema-test-en' });
      const xml = readContentXml(blobData);

      assert.equal(odeProperty(xml, 'pp_subtitle'), 'University Library');
      assert.equal(odeProperty(xml, 'pp_lang'), 'en');
    } finally {
      ThemeRegistry.remove('tema-test-en');
    }
  });

  test('subtitle explícito del proyecto gana al idioma del tema (pp_lang sigue al tema)', async () => {
    registerTestTheme('tema-test-en-2', 'en');
    try {
      const doc = { ...makeDocument(), subtitle: 'Subtítulo a medida' };
      const renderer = new ElpxRenderer(loadBaseTemplate(), doc);
      const { blobData } = await renderer.render({ themeId: 'tema-test-en-2' });
      const xml = readContentXml(blobData);

      assert.equal(odeProperty(xml, 'pp_subtitle'), 'Subtítulo a medida');
      assert.equal(odeProperty(xml, 'pp_lang'), 'en');
    } finally {
      ThemeRegistry.remove('tema-test-en-2');
    }
  });

  test('pp_author se queda siempre en castellano, sea cual sea el idioma del tema', async () => {
    registerTestTheme('tema-test-en-3', 'en');
    try {
      const renderer = new ElpxRenderer(loadBaseTemplate(), makeDocument());
      const { blobData } = await renderer.render({ themeId: 'tema-test-en-3' });
      const xml = readContentXml(blobData);

      assert.equal(odeProperty(xml, 'pp_author'), 'Biblioteca de la Universidad de Alicante');
    } finally {
      ThemeRegistry.remove('tema-test-en-3');
    }
  });
});
