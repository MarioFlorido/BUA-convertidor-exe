/**
 * Tests de la memoria de estructuras del paso 2.
 *
 * Lo que se protege: que el mismo Word (o su traducción) recupere la última
 * configuración, que un documento distinto salga en blanco, y que una entrada
 * corrupta o un almacenamiento inexistente no rompan nada.
 *
 * Runner: node:test vía tsx.
 *   npm test
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import type { DocumentStructure, H2StructureOption } from '../../types';
import {
  rememberStructure,
  recallStructure,
  structureShape,
  structureTitles,
  type StorageLike,
} from './structureMemory';

/** Almacenamiento en memoria con la misma superficie que localStorage. */
function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  };
}

/**
 * Estructura recién parseada (todo por defecto) a partir de una lista de
 * títulos: cada H1 lleva sus H2. Los ids siguen el patrón de parseStructure.
 */
function parsed(sections: [string, string[]][]): DocumentStructure {
  let h2Counter = 0;
  return {
    h1Sections: sections.map(([title, h2s], i) => ({
      id: `h1-${i + 1}`,
      title,
      level: 1,
      h2Items: h2s.map((text) => ({ id: `h2-${i + 1}-${++h2Counter}`, text, option: 'html' })),
    })),
  };
}

function configure(
  structure: DocumentStructure,
  levels: (1 | 2 | 3)[],
  options: H2StructureOption[],
): DocumentStructure {
  let h2Index = 0;
  return {
    h1Sections: structure.h1Sections.map((h1, i) => ({
      ...h1,
      level: levels[i],
      h2Items: h1.h2Items.map((h2) => ({ ...h2, option: options[h2Index++] })),
    })),
  };
}

const ES: [string, string[]][] = [
  ['Introducción', []],
  ['Metodología', ['Objetivos', 'Actividades', 'Recursos']],
  ['Evaluación', ['Criterios']],
];
const VA: [string, string[]][] = [
  ['Introducció', []],
  ['Metodologia', ['Objectius', 'Activitats', 'Recursos']],
  ['Avaluació', ['Criteris']],
];
const LEVELS: (1 | 2 | 3)[] = [1, 2, 2];
const OPTIONS: H2StructureOption[] = ['idevice-title', 'accordion', 'accordion', 'tabs'];

describe('structureMemory', () => {
  let storage: ReturnType<typeof fakeStorage>;
  beforeEach(() => { storage = fakeStorage(); });

  test('la forma y la huella no dependen de mayúsculas, tildes ni espacios', () => {
    const a = parsed(ES);
    const b = parsed([
      ['INTRODUCCION', []],
      ['metodologia ', ['objetivos', 'actividades', ' Recursos']],
      ['Evaluacion', ['criterios']],
    ]);
    assert.equal(structureShape(a), '0,3,1');
    assert.equal(structureTitles(a), structureTitles(b));
  });

  test('el mismo Word recupera la configuración guardada', () => {
    rememberStructure(configure(parsed(ES), LEVELS, OPTIONS), storage);

    const recalled = recallStructure(parsed(ES), storage);
    assert.ok(recalled);
    assert.equal(recalled.kind, 'same');
    assert.deepEqual(recalled.structure.h1Sections.map((h1) => h1.level), LEVELS);
    assert.deepEqual(
      recalled.structure.h1Sections.flatMap((h1) => h1.h2Items.map((h2) => h2.option)),
      OPTIONS,
    );
  });

  test('la recuperación conserva ids y títulos del documento cargado, no del guardado', () => {
    rememberStructure(configure(parsed(ES), LEVELS, OPTIONS), storage);
    const fresh = parsed(VA);

    const recalled = recallStructure(fresh, storage);
    assert.ok(recalled);
    assert.deepEqual(
      recalled.structure.h1Sections.map((h1) => [h1.id, h1.title]),
      fresh.h1Sections.map((h1) => [h1.id, h1.title]),
    );
    assert.deepEqual(
      recalled.structure.h1Sections.flatMap((h1) => h1.h2Items.map((h2) => [h2.id, h2.text])),
      fresh.h1Sections.flatMap((h1) => h1.h2Items.map((h2) => [h2.id, h2.text])),
    );
  });

  test('la traducción (misma forma, otros títulos) recupera la configuración como «similar»', () => {
    rememberStructure(configure(parsed(ES), LEVELS, OPTIONS), storage);

    const recalled = recallStructure(parsed(VA), storage);
    assert.ok(recalled);
    assert.equal(recalled.kind, 'similar');
    assert.deepEqual(recalled.structure.h1Sections.map((h1) => h1.level), LEVELS);
  });

  test('un documento con otra forma sale en blanco', () => {
    rememberStructure(configure(parsed(ES), LEVELS, OPTIONS), storage);

    const extraH2 = parsed([
      ['Introducción', []],
      ['Metodología', ['Objetivos', 'Actividades', 'Recursos', 'Bibliografía']],
      ['Evaluación', ['Criterios']],
    ]);
    assert.equal(recallStructure(extraH2, storage), null);

    const extraH1 = parsed([...ES, ['Anexo', []]]);
    assert.equal(recallStructure(extraH1, storage), null);
  });

  test('con el mismo documento y su traducción guardados, cada uno recupera lo suyo', () => {
    const vaOptions: H2StructureOption[] = ['html', 'tabs', 'tabs', 'html'];
    rememberStructure(configure(parsed(ES), LEVELS, OPTIONS), storage);
    rememberStructure(configure(parsed(VA), [1, 1, 1], vaOptions), storage);

    const es = recallStructure(parsed(ES), storage);
    assert.ok(es);
    assert.equal(es.kind, 'same');
    assert.deepEqual(es.structure.h1Sections.map((h1) => h1.level), LEVELS);

    const va = recallStructure(parsed(VA), storage);
    assert.ok(va);
    assert.equal(va.kind, 'same');
    assert.deepEqual(va.structure.h1Sections.map((h1) => h1.level), [1, 1, 1]);
  });

  test('una nueva traducción toma la configuración más reciente de esa forma', () => {
    const vaOptions: H2StructureOption[] = ['html', 'tabs', 'tabs', 'html'];
    rememberStructure(configure(parsed(ES), LEVELS, OPTIONS), storage);
    rememberStructure(configure(parsed(VA), [1, 1, 1], vaOptions), storage);

    const en = recallStructure(parsed([
      ['Introduction', []],
      ['Methodology', ['Goals', 'Activities', 'Resources']],
      ['Assessment', ['Criteria']],
    ]), storage);
    assert.ok(en);
    assert.equal(en.kind, 'similar');
    assert.deepEqual(
      en.structure.h1Sections.flatMap((h1) => h1.h2Items.map((h2) => h2.option)),
      vaOptions,
    );
  });

  test('volver a confirmar el mismo documento sustituye la entrada, no la duplica', () => {
    rememberStructure(configure(parsed(ES), LEVELS, OPTIONS), storage);
    const newOptions: H2StructureOption[] = ['html', 'html', 'tabs', 'html'];
    rememberStructure(configure(parsed(ES), [1, 3, 3], newOptions), storage);

    const stored = JSON.parse(storage.data.get('bua-structure-memory-v1')!);
    assert.equal(stored.length, 1);

    const recalled = recallStructure(parsed(ES), storage);
    assert.ok(recalled);
    assert.deepEqual(recalled.structure.h1Sections.map((h1) => h1.level), [1, 3, 3]);
  });

  test('confirmar todo por defecto no guarda nada y olvida lo anterior del mismo documento', () => {
    rememberStructure(configure(parsed(ES), LEVELS, OPTIONS), storage);
    rememberStructure(parsed(ES), storage);

    assert.equal(recallStructure(parsed(ES), storage), null);
    assert.equal(JSON.parse(storage.data.get('bua-structure-memory-v1')!).length, 0);
  });

  test('solo se conservan las 20 más recientes', () => {
    for (let i = 0; i < 25; i++) {
      const doc = parsed([[`Doc ${i}`, ['A']], ['Cierre', []]]);
      rememberStructure(configure(doc, [1, 2], ['accordion']), storage);
    }
    const stored = JSON.parse(storage.data.get('bua-structure-memory-v1')!);
    assert.equal(stored.length, 20);
    // La primera guardada ya no está; la última sí.
    assert.equal(recallStructure(parsed([['Doc 0', ['A']], ['Cierre', []]]), storage)?.kind, 'similar');
    assert.equal(recallStructure(parsed([['Doc 24', ['A']], ['Cierre', []]]), storage)?.kind, 'same');
  });

  test('un almacenamiento corrupto o ausente no rompe nada', () => {
    storage.setItem('bua-structure-memory-v1', '{no es json');
    assert.equal(recallStructure(parsed(ES), storage), null);
    rememberStructure(configure(parsed(ES), LEVELS, OPTIONS), storage);
    assert.equal(recallStructure(parsed(ES), storage)?.kind, 'same');

    storage.setItem('bua-structure-memory-v1', JSON.stringify([
      { shape: '0,3,1', titles: 'x', levels: [1, 9, 2], options: ['html', 'html', 'html', 'html'], at: 1 },
    ]));
    assert.equal(recallStructure(parsed(ES), storage), null);

    assert.equal(recallStructure(parsed(ES), null), null);
    rememberStructure(configure(parsed(ES), LEVELS, OPTIONS), null);
  });
});
