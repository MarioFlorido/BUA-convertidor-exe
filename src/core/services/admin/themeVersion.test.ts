/**
 * Tests de themeVersion — lectura/incremento del <version> del config.xml.
 *
 * Runner: node:test vía tsx (puro, sin red ni DOM).
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { readThemeVersion, nextThemeVersion, setThemeVersion } from './themeVersion';

const CONFIG = `<?xml version="1.0"?>
<theme>
    <exe-version>3.0</exe-version>
    <name>CID-es_26-27</name>
    <version>2</version>
    <compatibility>3.0</compatibility>
</theme>`;

describe('readThemeVersion', () => {
  test('lee el entero de <version>', () => {
    assert.equal(readThemeVersion(CONFIG), 2);
  });
  test('tolera espacios alrededor del número', () => {
    assert.equal(readThemeVersion('<version>  7 </version>'), 7);
  });
  test('null si no hay <version>', () => {
    assert.equal(readThemeVersion('<theme><name>x</name></theme>'), null);
  });
  test('no confunde <exe-version> ni <compatibility> con <version>', () => {
    const xml = '<exe-version>3.0</exe-version><version>4</version><compatibility>3.0</compatibility>';
    assert.equal(readThemeVersion(xml), 4);
  });
});

describe('nextThemeVersion', () => {
  test('publicada == local → publicada + 1', () => {
    assert.equal(nextThemeVersion(2, 2), 3);
  });
  test('avanza desde la publicada aunque la local esté retrasada', () => {
    assert.equal(nextThemeVersion(5, 2), 6);
  });
  test('respeta una local mayor (subida a mano)', () => {
    assert.equal(nextThemeVersion(5, 10), 11);
  });
  test('tema nuevo (sin publicada) parte de la local', () => {
    assert.equal(nextThemeVersion(null, 2), 3);
  });
  test('sin ninguna referencia → empieza en 1', () => {
    assert.equal(nextThemeVersion(null, null), 1);
  });
});

describe('setThemeVersion', () => {
  test('reemplaza el <version> existente y conserva el resto', () => {
    const out = setThemeVersion(CONFIG, 3);
    assert.equal(readThemeVersion(out), 3);
    assert.ok(out.includes('<name>CID-es_26-27</name>'));
    assert.ok(out.includes('<compatibility>3.0</compatibility>'));
  });
  test('round-trip: leer → siguiente → escribir', () => {
    const v = readThemeVersion(CONFIG)!;
    const out = setThemeVersion(CONFIG, nextThemeVersion(v, v));
    assert.equal(readThemeVersion(out), 3);
  });
  test('si falta <version>, lo inserta dentro de <theme>', () => {
    const sinVersion = '<?xml version="1.0"?>\n<theme>\n    <name>x</name>\n</theme>';
    const out = setThemeVersion(sinVersion, 1);
    assert.equal(readThemeVersion(out), 1);
    assert.ok(out.includes('<name>x</name>'));
  });
});
