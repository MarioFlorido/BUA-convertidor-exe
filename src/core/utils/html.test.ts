/**
 * Tests de utils/html — mayúsculas de los H2 (ELPX y vista de impresión).
 *
 * La regex tenía que dejar de asumir que dentro de un <h2> solo hay texto: un
 * logo puesto por el autor en la misma línea del título llega como
 * `<h2><img …/>Título</h2>`, y poner en mayúsculas una etiqueta rompería sus
 * atributos.
 *
 * Runner: node:test vía tsx.
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { upperCaseH2 } from './html';

describe('upperCaseH2', () => {
  test('texto llano: se pone en mayúsculas', () => {
    assert.equal(upperCaseH2('<h2>Título del apartado</h2>'), '<h2>TÍTULO DEL APARTADO</h2>');
  });

  test('conserva los atributos del propio h2', () => {
    assert.equal(upperCaseH2('<h2 class="x">título</h2>'), '<h2 class="x">TÍTULO</h2>');
  });

  test('logo dentro del h2: la etiqueta queda intacta y el texto en mayúsculas', () => {
    const out = upperCaseH2('<h2><img class="bua_img_inline" src="logo.png" />Apartado</h2>');
    assert.equal(out, '<h2><img class="bua_img_inline" src="logo.png" />APARTADO</h2>');
  });

  test('logo con hiperenlace dentro del h2: href y atributos intactos', () => {
    const out = upperCaseH2('<h2><a href="https://ua.es"><img src="logo.png" /></a>Apartado</h2>');
    assert.equal(out, '<h2><a href="https://ua.es"><img src="logo.png" /></a>APARTADO</h2>');
  });

  test('las entidades HTML no se destrozan (&nbsp; no es &NBSP;)', () => {
    assert.equal(upperCaseH2('<h2>a&nbsp;b &amp; c</h2>'), '<h2>A&nbsp;B &amp; C</h2>');
  });

  test('formato dentro del título: se conserva y el texto sube', () => {
    assert.equal(upperCaseH2('<h2>uno <strong>dos</strong></h2>'), '<h2>UNO <strong>DOS</strong></h2>');
  });

  test('varios h2 en el mismo fragmento', () => {
    assert.equal(upperCaseH2('<h2>a</h2><p>b</p><h2>c</h2>'), '<h2>A</h2><p>b</p><h2>C</h2>');
  });

  test('no toca otros encabezados', () => {
    assert.equal(upperCaseH2('<h3>título</h3>'), '<h3>título</h3>');
  });
});
