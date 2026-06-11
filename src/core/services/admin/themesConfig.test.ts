/**
 * Tests de themesConfig — operaciones puras sobre el catálogo de temas.
 *
 * Runner: node:test vía tsx (puro, sin red ni disco).
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  upsertThemeEntry,
  removeThemeEntry,
  serializeThemesConfig,
  type ThemesConfig,
} from './themesConfig';

describe('upsertThemeEntry', () => {
  test('añade un tema nuevo al final con sus metadatos', () => {
    const config: ThemesConfig = { themes: [{ id: 'base', name: 'Base' }] };
    const out = upsertThemeEntry(config, { id: 'CID_es_26-27', name: 'CID es', activity: 'Curso' });
    assert.equal(out.themes.length, 2);
    assert.equal(out.themes[1].id, 'CID_es_26-27');
    assert.equal(out.themes[1].activity, 'Curso');
  });

  test('actualiza un tema existente en su sitio (no lo duplica)', () => {
    const config: ThemesConfig = { themes: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] };
    const out = upsertThemeEntry(config, { id: 'a', description: 'nueva' });
    assert.equal(out.themes.length, 2);
    assert.equal(out.themes[0].id, 'a');
    assert.equal(out.themes[0].description, 'nueva');
  });

  test('escribe updatedAt cuando se aporta (versión para cache-busting)', () => {
    const out = upsertThemeEntry({ themes: [] }, { id: 'x', updatedAt: '2026-06-09T10:00:00.000Z' });
    assert.equal(out.themes[0].updatedAt, '2026-06-09T10:00:00.000Z');
  });

  test('una nueva publicación con updatedAt nuevo reemplaza el anterior', () => {
    const config: ThemesConfig = { themes: [{ id: 'x', name: 'X', updatedAt: 'viejo' }] };
    const out = upsertThemeEntry(config, { id: 'x', updatedAt: 'nuevo' });
    assert.equal(out.themes[0].updatedAt, 'nuevo');
  });

  test('si el input no trae updatedAt, conserva el previo', () => {
    const config: ThemesConfig = { themes: [{ id: 'x', name: 'X', updatedAt: 'previo' }] };
    const out = upsertThemeEntry(config, { id: 'x', name: 'X2' });
    assert.equal(out.themes[0].updatedAt, 'previo');
  });

  test('no muta el config de entrada', () => {
    const config: ThemesConfig = { themes: [{ id: 'a', name: 'A' }] };
    upsertThemeEntry(config, { id: 'a', name: 'Cambiado' });
    assert.equal(config.themes[0].name, 'A');
  });

  test('editar solo metadatos (sin updatedAt) conserva la versión del .zip', () => {
    // Escenario del editor de metadatos: corregir nombre y descripción sin tocar
    // los archivos del tema → updatedAt NO debe cambiar (la URL del .zip usa ?v=).
    const config: ThemesConfig = {
      themes: [{ id: 'CID_es', name: 'CID es', description: 'vieja', updatedAt: '2026-06-10T00:00:00.000Z' }],
    };
    const out = upsertThemeEntry(config, { id: 'CID_es', name: 'CID ES', description: 'corregida' });
    assert.equal(out.themes[0].name, 'CID ES');
    assert.equal(out.themes[0].description, 'corregida');
    assert.equal(out.themes[0].updatedAt, '2026-06-10T00:00:00.000Z');
  });
});

describe('removeThemeEntry', () => {
  test('elimina por id y devuelve copia nueva', () => {
    const config: ThemesConfig = { themes: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] };
    const out = removeThemeEntry(config, 'a');
    assert.deepEqual(out.themes.map((t) => t.id), ['b']);
  });
});

describe('serializeThemesConfig', () => {
  test('formato estable: 2 espacios de indentación y salto de línea final', () => {
    const out = serializeThemesConfig({ themes: [{ id: 'a', name: 'A' }] });
    assert.ok(out.endsWith('}\n'));
    assert.ok(out.includes('\n  "themes"'));
  });
});
