/**
 * Tests de themeValidation — avisos de calidad sobre style.css y la carpeta.
 *
 * Runner: node:test vía tsx (puro, sin red ni DOM).
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validateCssText, extractPalette, validateThemeForPublish } from './themeValidation';

const VALID_CSS = `
/* Paleta: #1560D8 #D85A30 */
.bua_ejemplo { content: '\\f06d'; }
.bua_definicion { content: '\\f06e'; }
.bua_importante { content: '\\f071'; }
`;

describe('validateCssText', () => {
  test('CSS completo: sin avisos', () => {
    assert.deepEqual(validateCssText(VALID_CSS).warnings, []);
  });

  test('avisa de las clases BUA que faltan', () => {
    const css = '.bua_ejemplo { content: "x"; } /* Paleta: #fff */';
    const { warnings } = validateCssText(css);
    assert.ok(warnings.some((w) => w.includes('.bua_definicion')));
    assert.ok(warnings.some((w) => w.includes('.bua_importante')));
    assert.ok(!warnings.some((w) => w.includes('.bua_ejemplo')));
  });

  test('avisa si no hay ninguna regla content:', () => {
    const css = '.bua_ejemplo {} .bua_definicion {} .bua_importante {} /* Paleta: #fff */';
    const { warnings } = validateCssText(css);
    assert.ok(warnings.some((w) => w.includes('content:')));
  });

  test('avisa si falta el comentario Paleta:', () => {
    const css = '.bua_ejemplo { content: "x"; } .bua_definicion {} .bua_importante {}';
    const { warnings } = validateCssText(css);
    assert.ok(warnings.some((w) => w.includes('Paleta:')));
  });

  test('avisa si el comentario Paleta: no trae colores hex', () => {
    const css = '.bua_ejemplo { content: "x"; } .bua_definicion {} .bua_importante {} /* Paleta: ninguno */';
    const { warnings } = validateCssText(css);
    assert.ok(warnings.some((w) => w.includes('no contiene colores hex')));
  });
});

describe('validateThemeForPublish usa validateCssText para el CSS', () => {
  test('el aviso de clases BUA faltantes llega también desde la carpeta completa', () => {
    const files = {
      'config.xml': new TextEncoder().encode('<theme><version>1</version></theme>'),
      'style.css': new TextEncoder().encode('.bua_ejemplo { content: "x"; } /* Paleta: #fff */'),
    };
    const report = validateThemeForPublish(files);
    assert.ok(report.warnings.some((w) => w.includes('.bua_definicion')));
    assert.deepEqual(report.meta.palette, ['#fff']);
  });
});

describe('extractPalette', () => {
  test('extrae y deduplica colores hex del comentario Paleta:', () => {
    assert.deepEqual(extractPalette('/* Paleta: #111 #222 #111 */'), ['#111', '#222']);
  });
});
