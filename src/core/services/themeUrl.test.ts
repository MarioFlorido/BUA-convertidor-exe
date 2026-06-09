/**
 * Tests de themeUrl — versionado de la URL del ZIP del tema (cache-busting).
 *
 * Runner: node:test vía tsx (puro, sin DOM ni red).
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { themeZipUrl } from './themeUrl';

describe('themeZipUrl', () => {
  test('sin versión → URL estable sin query', () => {
    assert.equal(themeZipUrl('/', 'CID_es_26-27'), '/CID_es_26-27.zip');
  });

  test('respeta el BASE_URL (GitHub Pages)', () => {
    assert.equal(
      themeZipUrl('/BUA-convertidor-exe/', 'PhD_26-27'),
      '/BUA-convertidor-exe/PhD_26-27.zip',
    );
  });

  test('con versión → añade ?v= (rompe la caché del navegador)', () => {
    assert.equal(
      themeZipUrl('/', 'CID_es_26-27', '2026-06-09T10:00:00.000Z'),
      '/CID_es_26-27.zip?v=2026-06-09T10%3A00%3A00.000Z',
    );
  });

  test('dos versiones distintas producen URLs distintas', () => {
    assert.notEqual(themeZipUrl('/', 'x', 'v1'), themeZipUrl('/', 'x', 'v2'));
  });

  test('la misma versión produce la misma URL (la caché sigue sirviendo)', () => {
    assert.equal(themeZipUrl('/', 'x', 'v1'), themeZipUrl('/', 'x', 'v1'));
  });

  test('versión vacía se trata como sin versión', () => {
    assert.equal(themeZipUrl('/', 'x', ''), '/x.zip');
  });
});
