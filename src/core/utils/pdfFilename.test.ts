/**
 * Tests del nombre con el que el navegador propone guardar el PDF.
 *
 * Lo que se protege: que un título largo venido de «Comentarios» del Word no
 * acabe siendo el nombre del fichero PDF, y que un documento SIN «Comentarios»
 * se comporte exactamente como antes.
 *
 * Runner: node:test vía tsx.
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { pdfBaseName } from './pdfFilename';

const LONG_TITLE =
  'Normativa y redacción del TFM en Arqueología profesional y gestión integral del patrimonio, ' +
  'Estudios políticos, económicos y sociales contemporáneos de América Latina, ' +
  'Historia de la Europa contemporánea: identidades e integración, ' +
  'Historia del mundo mediterráneo y sus regiones. De la prehistoria a la Edad Media, ' +
  'Historia e identidades en el mediterráneo occidental (siglos XV-XIX)';

describe('pdfBaseName', () => {
  test('el PDF se llama como el .docx, no como el título de «Comentarios»', () => {
    assert.equal(
      pdfBaseName('Normativa y redacción del TFM.docx', LONG_TITLE),
      'Normativa y redacción del TFM',
    );
  });

  test('el título largo no llega al nombre: ni su longitud ni sus caracteres prohibidos', () => {
    const name = pdfBaseName('Normativa y redacción del TFM.docx', LONG_TITLE);
    assert.equal(LONG_TITLE.length, 383);
    assert.ok(name.length < 255, 'cabe en un nombre de fichero de Windows');
    assert.doesNotMatch(name, /[:\\/*?"<>|]/, 'sin caracteres prohibidos en Windows');
  });

  test('acepta el .elpx, que es lo que pasa la pantalla de descarga', () => {
    assert.equal(
      pdfBaseName('Normativa y redacción del TFM.elpx', LONG_TITLE),
      'Normativa y redacción del TFM',
    );
  });

  test('sin «Comentarios» el nombre y el título coinciden, como siempre', () => {
    const corto = 'Normativa y redacción del TFM';
    assert.equal(pdfBaseName(`${corto}.docx`, corto), corto);
  });

  test('sin fichero de origen se usa el título — comportamiento anterior intacto', () => {
    assert.equal(pdfBaseName('', 'Documento importado'), 'Documento importado');
    assert.equal(pdfBaseName('   ', 'Documento importado'), 'Documento importado');
  });

  test('solo se quita la última extensión', () => {
    assert.equal(pdfBaseName('Normativa TFM v2.1.docx', 'x'), 'Normativa TFM v2.1');
  });

  test('un nombre sin extensión se deja como está', () => {
    assert.equal(pdfBaseName('Normativa TFM', 'x'), 'Normativa TFM');
  });
});
