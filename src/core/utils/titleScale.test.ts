/**
 * Tests de la escala del título largo: cabecera del ELPX (vía
 * pp_extraHeadContent y las páginas de vista previa del ZIP) y portada del PDF.
 *
 * Runner: node:test vía tsx. ElpxRenderer/PreviewService usan DOMParser →
 * jsdom como global.
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { unzipSync, strFromU8 } from 'fflate';

const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
(globalThis as Record<string, unknown>).DOMParser = jsdom.window.DOMParser;

import {
  longTitleScale,
  HEADER_TITLE_COMFORTABLE_LENGTH,
  COVER_TITLE_COMFORTABLE_LENGTH,
} from './titleScale';
import { ElpxRenderer } from '../renderers/ElpxRenderer';
import { renderCoverPage } from '../renderers/html-print/renderCoverPage';
import type { PrintThemeAssets } from '../renderers/html-print/PrintThemeLoader';
import type { SemanticDocument } from '../models/SemanticDocument';

const LONG_TITLE =
  'Normativa y redacción del TFM en Arqueología profesional y gestión integral del patrimonio, ' +
  'Estudios políticos, económicos y sociales contemporáneos de América Latina, ' +
  'Historia de la Europa contemporánea: identidades e integración, ' +
  'Historia del mundo mediterráneo y sus regiones. De la prehistoria a la Edad Media, ' +
  'Historia e identidades en el mediterráneo occidental (siglos XV-XIX)';

function makeDocument(title: string): SemanticDocument {
  return {
    title,
    subtitle: '',
    pages: [{ title: 'Página 1', level: 1, parentIndex: null, blocks: [{ title: '', html: '<p>x</p>' }] }],
  };
}

describe('longTitleScale', () => {
  test('un título que cabe se queda a tamaño normal', () => {
    assert.equal(longTitleScale('Normativa y redacción del TFM', 90), 1);
    assert.equal(longTitleScale('x'.repeat(90), 90), 1);
  });

  test('un título largo se reduce por la raíz de la proporción (misma superficie)', () => {
    // 383 caracteres frente a 90 cómodos → √(90/383) = 0,4847 → 0,48
    assert.equal(LONG_TITLE.length, 383);
    assert.equal(longTitleScale(LONG_TITLE, HEADER_TITLE_COMFORTABLE_LENGTH), 0.48);
    // frente a 140 cómodos (portada) → √(140/383) = 0,6046 → 0,6
    assert.equal(longTitleScale(LONG_TITLE, COVER_TITLE_COMFORTABLE_LENGTH), 0.6);
  });

  test('nunca baja del 40 %', () => {
    assert.equal(longTitleScale('x'.repeat(5000), 90), 0.4);
  });
});

describe('cabecera del ELPX', () => {
  function loadBaseTemplate(): { entries: Record<string, Uint8Array> } {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const baseElpx = path.resolve(here, '../../../public/base.elpx');
    return { entries: unzipSync(new Uint8Array(readFileSync(baseElpx))) };
  }

  test('título largo: pp_extraHeadContent y la vista previa fijan --bua-title-scale', async () => {
    const renderer = new ElpxRenderer(loadBaseTemplate(), makeDocument(LONG_TITLE));
    const { blobData, previewPages } = await renderer.render({});
    const contentXml = strFromU8(unzipSync(blobData)['content.xml']);
    // El CSS va escapado dentro del XML (`{` y `:` no se escapan)
    assert.match(contentXml, /--bua-title-scale:0\.48\}/);
    assert.match(previewPages['index.html'], /:root\{--bua-title-scale:0\.48\}/);
  });

  test('título corto: no se toca el tamaño del tema', async () => {
    const renderer = new ElpxRenderer(loadBaseTemplate(), makeDocument('Normativa y redacción del TFM'));
    const { blobData, previewPages } = await renderer.render({});
    const contentXml = strFromU8(unzipSync(blobData)['content.xml']);
    assert.doesNotMatch(contentXml, /bua-title-scale/);
    assert.doesNotMatch(previewPages['index.html'], /bua-title-scale/);
  });

  test('los temas leen la variable en la regla del título', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    for (const theme of ['CID_es', 'CID_va', 'Ciencia_abierta', 'Ciencia_oberta', 'Doctorado', 'Doctorat', 'Open_Science', 'PhD']) {
      const css = readFileSync(path.resolve(here, `../../../public/themes/${theme}/style.css`), 'utf8');
      assert.match(css, /\.package-title \{[^}]*var\(--bua-title-scale, 1\)/, theme);
    }
  });
});

describe('portada del PDF', () => {
  const assets: PrintThemeAssets = {
    themeId: 'base',
    coverImageDataUrl: null,
    buaLogoDataUrl: null,
    uaLogoDataUrl: null,
    language: 'es',
    primaryColor: '#135d87',
    accentColor: '#deb13c',
    fontFamilyTitle: 'Arial',
    fontFamilyBody: 'Arial',
    buaStyles: {} as PrintThemeAssets['buaStyles'],
  };

  test('título largo: el h1 lleva --cover-title-scale', () => {
    const html = renderCoverPage(makeDocument(LONG_TITLE), assets);
    assert.match(html, /<h1 class="cover-title" style="--cover-title-scale:0\.6">/);
  });

  test('título corto: el h1 va sin estilo', () => {
    const html = renderCoverPage(makeDocument('Normativa y redacción del TFM'), assets);
    assert.match(html, /<h1 class="cover-title">Normativa y redacción del TFM<\/h1>/);
  });
});
