/**
 * Tests del parser de .elp (eXeLearning clásico 2.x).
 *
 * Runner: node:test vía tsx. Necesita DOM → jsdom como global.
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { zipSync, strToU8 } from 'fflate';

// ── Setup DOM global (parseElp usa DOMParser) ─────────────────────────────────
const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
const g = globalThis as Record<string, unknown>;
g.DOMParser = jsdom.window.DOMParser;

import { parseElp, preprocessLegacyXml } from './elpParser';
import { buildFixtureElp, buildFixtureContentXml } from './elpFixture';

describe('parseElp — estructura', () => {
  test('extrae metadatos, árbol de páginas y HTML de los iDevices', () => {
    const parsed = parseElp(buildFixtureElp());

    assert.equal(parsed.title, 'Curso de prueba');
    assert.equal(parsed.author, 'Biblioteca Universitaria');
    assert.equal(parsed.language, 'es');

    assert.equal(parsed.pages.length, 2);
    assert.equal(parsed.pages[0].title, 'Presentación');
    assert.equal(parsed.pages[0].depth, 0);
    assert.equal(parsed.pages[1].title, 'Unidad 1');
    assert.equal(parsed.pages[1].depth, 1);

    const [idevice] = parsed.pages[0].idevices;
    assert.equal(idevice.type, 'text');
    assert.match(idevice.htmlFields[0], /<strong>curso<\/strong>/);
    assert.match(idevice.htmlFields[0], /resources\/foto\.png/);
  });

  test('recoge los recursos de la raíz del ZIP e ignora los archivos internos de eXe', () => {
    const parsed = parseElp(buildFixtureElp());
    assert.deepEqual([...parsed.resources.keys()], ['foto.png']);
  });

  test('conserva el título de un iDevice cuando el autor puso uno', () => {
    const parsed = parseElp(buildFixtureElp({ extraIdeviceTitle: 'Objetivos' }));
    const titles = parsed.pages[0].idevices.map((idevice) => idevice.title);
    assert.deepEqual(titles, ['', 'Objetivos']);
  });

  test('un iDevice sin texto extraíble genera aviso y se omite', () => {
    const xml = buildFixtureContentXml().replace(
      /content_w_resourcePaths"><\/string>\s*<unicode content="true" value="[^"]*"/,
      'content_w_resourcePaths"></string>\n<unicode content="true" value=""',
    );
    const parsed = parseElp(zipSync({ 'contentv3.xml': strToU8(xml) }));
    assert.equal(parsed.pages[0].idevices.length, 0);
    assert.equal(parsed.warnings.length, 1);
    assert.match(parsed.warnings[0], /Presentación/);
  });

  test('desenvuelve un ZIP re-empaquetado con carpeta raíz única', () => {
    const inner = buildFixtureContentXml();
    const rewrapped = zipSync({ 'mi-curso/contentv3.xml': strToU8(inner) });
    const parsed = parseElp(rewrapped);
    assert.equal(parsed.pages.length, 2);
  });
});

describe('parseElp — errores claros', () => {
  test('un .elpx moderno (content.xml) se rechaza con mensaje específico', () => {
    const elpx = zipSync({ 'content.xml': strToU8('<ode></ode>') });
    assert.throws(() => parseElp(elpx), /eXeLearning moderno/);
  });

  test('un ZIP cualquiera se rechaza indicando que no es un .elp', () => {
    const zip = zipSync({ 'cosas.txt': strToU8('hola') });
    assert.throws(() => parseElp(zip), /no parece un \.elp/);
  });
});

describe('preprocessLegacyXml', () => {
  test('convierte escapes \\xNN imprimibles y respeta los de control', () => {
    assert.equal(preprocessLegacyXml('caf\\xe9'), 'café');
    assert.equal(preprocessLegacyXml('malo\\x01'), 'malo\\x01');
  });
});
