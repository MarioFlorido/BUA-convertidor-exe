/**
 * Tests de ThemeValidator — validación y normalización de ZIPs de tema.
 *
 * Cubre el hallazgo del análisis externo (jun 2026): un ZIP comprimido "con
 * carpeta" (MiTema/style.css) validaba pero acababa como theme/MiTema/style.css
 * en el ELPX, ilegible para eXeLearning. Ahora se normaliza al importar y el
 * validador exige los archivos en la raíz.
 *
 * Runner: node:test vía tsx (puro, sin DOM).
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validateThemeBundle, stripCommonRootDir } from './ThemeValidator';

const f = () => new Uint8Array([1]);

describe('stripCommonRootDir', () => {
  test('elimina la carpeta raíz común', () => {
    const out = stripCommonRootDir({ 'MiTema/style.css': f(), 'MiTema/config.xml': f(), 'MiTema/css/x.css': f() });
    assert.deepEqual(Object.keys(out).sort(), ['config.xml', 'css/x.css', 'style.css']);
  });

  test('carpeta dentro de carpeta: itera hasta dejar archivos en raíz', () => {
    const out = stripCommonRootDir({ 'A/B/style.css': f(), 'A/B/config.xml': f() });
    assert.deepEqual(Object.keys(out).sort(), ['config.xml', 'style.css']);
  });

  test('archivos ya en raíz: no cambia nada', () => {
    const out = stripCommonRootDir({ 'style.css': f(), 'config.xml': f(), 'css/x.css': f() });
    assert.deepEqual(Object.keys(out).sort(), ['config.xml', 'css/x.css', 'style.css']);
  });

  test('rutas mixtas (sin carpeta raíz única): no cambia nada', () => {
    const out = stripCommonRootDir({ 'MiTema/style.css': f(), 'otro.txt': f() });
    assert.deepEqual(Object.keys(out).sort(), ['MiTema/style.css', 'otro.txt']);
  });

  test('descarta entradas de directorio (claves acabadas en /)', () => {
    const out = stripCommonRootDir({ 'MiTema/': new Uint8Array(0), 'MiTema/style.css': f(), 'MiTema/config.xml': f() });
    assert.deepEqual(Object.keys(out).sort(), ['config.xml', 'style.css']);
  });

  test('objeto vacío: devuelve vacío sin romper', () => {
    assert.deepEqual(stripCommonRootDir({}), {});
  });
});

describe('validateThemeBundle (requiere archivos en la raíz)', () => {
  test('config.xml + style.css en raíz: válido', () => {
    const res = validateThemeBundle({ 'config.xml': f(), 'style.css': f() });
    assert.equal(res.valid, true);
    assert.deepEqual(res.errors, []);
  });

  test('anidados en carpeta SIN normalizar: inválido con mensaje claro', () => {
    const res = validateThemeBundle({ 'MiTema/config.xml': f(), 'MiTema/style.css': f() });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('raíz')));
  });

  test('ZIP "con carpeta" tras stripCommonRootDir: válido (flujo de importación)', () => {
    const files = stripCommonRootDir({ 'MiTema/config.xml': f(), 'MiTema/style.css': f() });
    assert.equal(validateThemeBundle(files).valid, true);
  });

  test('falta style.css: inválido', () => {
    const res = validateThemeBundle({ 'config.xml': f() });
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('style.css')));
  });
});
