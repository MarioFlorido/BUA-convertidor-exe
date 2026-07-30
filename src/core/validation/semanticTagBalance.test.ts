/**
 * Tests de semanticTagBalance — detección de cajas semánticas sin cerrar.
 *
 * Runner: node:test vía tsx (sin DOM, es regex/string puro).
 *   npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectSemanticTagIssues,
  hasSemanticTagIssues,
} from './semanticTagBalance';

describe('detectSemanticTagIssues', () => {
  test('dos cajas bien cerradas → sin avisos', () => {
    const html =
      '<p>[ejemplo]</p><p>A</p><p>[fin]</p><p>[definicion]</p><p>B</p><p>[fin]</p>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });

  test('caja única bien cerrada → sin avisos', () => {
    const html = '<p>[importante]</p><p>Texto</p><p>[fin]</p>';
    assert.equal(hasSemanticTagIssues(html), false);
  });

  test('documento sin marcadores → sin avisos', () => {
    assert.deepEqual(detectSemanticTagIssues('<p>Hola mundo</p>'), []);
  });

  test('[pie] bien cerrado → sin avisos', () => {
    const html = '<p>[pie]</p><p>Figura 1</p><p>[fin]</p>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });

  test('falta el [fin] de un [pie] → avisa de [pie] sin cerrar', () => {
    const html = '<p>[pie]</p><p>Figura 1</p>';
    const issues = detectSemanticTagIssues(html);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'unclosed-box');
    assert.equal(issues[0].label, 'pie');
  });

  test('falta el [fin] de la primera caja → avisa de [ejemplo] sin cerrar', () => {
    const html =
      '<p>[ejemplo]</p><p>A</p><p>[definicion]</p><p>B</p><p>[fin]</p>';
    const issues = detectSemanticTagIssues(html);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'unclosed-box');
    assert.equal(issues[0].label, 'ejemplo');
  });

  test('falta el [fin] de la última caja → avisa de [importante] sin cerrar', () => {
    const html = '<p>[ejemplo]</p><p>A</p><p>[fin]</p><p>[importante]</p><p>B</p>';
    const issues = detectSemanticTagIssues(html);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'unclosed-box');
    assert.equal(issues[0].label, 'importante');
  });

  test('inline sin cerrar la primera → avisa de [ejemplo] sin cerrar', () => {
    const html = '<p>[ejemplo]A</p><p>[importante]B[fin]</p>';
    const issues = detectSemanticTagIssues(html);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'unclosed-box');
    assert.equal(issues[0].label, 'ejemplo');
  });

  test('[fin] suelto sin caja abierta → stray-fin', () => {
    const html = '<p>Texto</p><p>[fin]</p><p>Más texto</p>';
    const issues = detectSemanticTagIssues(html);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'stray-fin');
  });

  test('definición con tilde se reconoce igual que sin tilde', () => {
    const html = '<p>[definición]</p><p>A</p><p>[ejemplo]</p><p>B</p><p>[fin]</p>';
    const issues = detectSemanticTagIssues(html);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].label, 'definición');
  });

  test('ancla vacía de Word dentro del marcador no impide el conteo', () => {
    // Word parte el marcador con un bookmark: [ejem<a></a>plo] … [fin]
    const html = '<p>[ejem<a id="b1"></a>plo]</p><p>A</p><p>[fin]</p>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });

  test('[fin] con formato alrededor (<strong>[fin]</strong>) no da falso aviso', () => {
    // El "misterio": el marcador quedó en negrita sin que el autor lo vea.
    const html = '<p>[ejemplo]</p><p>A</p><p><strong>[fin]</strong></p>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });

  test('formato parcial DENTRO del marcador ([f<em>in</em>]) no da falso aviso', () => {
    const html = '<p>[importante]</p><p>A</p><p>[f<em>in</em>]</p>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });

  test('apertura y cierre inline en el mismo párrafo → sin avisos', () => {
    const html = '<p>[pie]Figura 1. Esquema[fin]</p>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });

  test('el aviso incluye un contexto para localizar la caja', () => {
    const html = '<p>[ejemplo]</p><p>Las setas son hongos comestibles</p><p>[definicion]</p><p>B</p><p>[fin]</p>';
    const issues = detectSemanticTagIssues(html);
    assert.equal(issues.length, 1);
    assert.match(issues[0].context, /setas/);
  });

  test('dos cajas consecutivas sin ningún [fin] → dos avisos', () => {
    const html = '<p>[ejemplo]</p><p>A</p><p>[importante]</p><p>B</p>';
    const issues = detectSemanticTagIssues(html);
    assert.equal(issues.length, 2);
    assert.equal(issues[0].label, 'ejemplo');
    assert.equal(issues[1].label, 'importante');
  });
});

describe('detectSemanticTagIssues — encabezado dentro de una caja', () => {
  test('caja que abarca un H2 → heading-inside-box con el texto del título', () => {
    const html =
      '<p>[importante]</p><p>A</p><h2>Título tragado</h2><p>B</p><p>[fin]</p>';
    const issues = detectSemanticTagIssues(html);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'heading-inside-box');
    assert.equal(issues[0].label, 'importante');
    assert.match(issues[0].context, /Título tragado/);
  });

  test('encabezado ENTRE dos cajas bien cerradas → sin avisos', () => {
    const html =
      '<p>[ejemplo]</p><p>A</p><p>[fin]</p><h2>Título</h2><p>[pie]</p><p>B</p><p>[fin]</p>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });
});

describe('detectSemanticTagIssues — marcadores de tabla', () => {
  test('[horizontal] solo en su párrafo y pegado a la tabla → sin avisos', () => {
    const html = '<p>[horizontal]</p><table><tr><td>A</td></tr></table>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });

  test('[vertical] con espacios y mayúsculas, pegado a la tabla → sin avisos', () => {
    const html = '<p>[ Vertical ]</p>\n<table><tr><td>A</td></tr></table>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });

  test('párrafo intermedio entre marcador y tabla → table-marker', () => {
    const html =
      '<p>[horizontal]</p><p>Texto colado</p><table><tr><td>A</td></tr></table>';
    const issues = detectSemanticTagIssues(html);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'table-marker');
    assert.equal(issues[0].marker, 'horizontal');
  });

  test('marcador inline con más texto en el párrafo → table-marker', () => {
    const html = '<p>Esta tabla [vertical] importa</p><table><tr><td>A</td></tr></table>';
    const issues = detectSemanticTagIssues(html);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'table-marker');
    assert.equal(issues[0].marker, 'vertical');
  });

  test('marcador sin tabla detrás → table-marker', () => {
    const html = '<p>[horizontal]</p><p>Y aquí no hay tabla</p>';
    const issues = detectSemanticTagIssues(html);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'table-marker');
  });

  test('bookmark de Word dentro del marcador no da falso aviso', () => {
    const html =
      '<p>[hori<a id="b1"></a>zontal]</p><table><tr><td>A</td></tr></table>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });

  test('<br/> tras el marcador (Shift+Enter) no da falso aviso', () => {
    const html = '<p>[horizontal]<br/></p><table><tr><td>A</td></tr></table>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Marcadores de recurso [vídeo:] [documento:] [enlace:]
// ─────────────────────────────────────────────────────────────────────────────
describe('detectSemanticTagIssues — líneas de recurso', () => {
  test('marcador que abre la línea con recurso detrás → sin avisos', () => {
    const html =
      '<p>[vídeo:] <a href="https://ua.es">Título</a></p>' +
      '<p>[documento:] Guía</p>' +
      '<ul><li>[enlace:] Portal</li></ul>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });

  test('cualquier variante de escritura vale igual', () => {
    for (const etiqueta of ['[Vídeo:]', '[VIDEO:]', '[ video : ]']) {
      assert.deepEqual(
        detectSemanticTagIssues(`<p>${etiqueta} Título</p>`),
        [],
        `falló con ${etiqueta}`,
      );
    }
  });

  test('un corchete sin los dos puntos no es etiqueta: ni se toca ni se avisa', () => {
    // Prompts transcritos en un curso sobre IA: son contenido, no etiquetas.
    const html =
      '<p>Escribe: «resume el [texto] y añade el [enlace] al final».</p>' +
      '<p>Otro prompt con [vídeo] y [documento] en medio.</p>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });

  test('marcador en mitad del párrafo → resource-marker', () => {
    const issues = detectSemanticTagIssues('<p>Mira este [vídeo:] tan bueno</p>');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'resource-marker');
    assert.equal(issues[0].marker, 'vídeo');
  });

  test('marcador sin recurso detrás → resource-marker', () => {
    const issues = detectSemanticTagIssues('<p>[documento:]</p><p>Otra cosa</p>');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'resource-marker');
    assert.equal(issues[0].marker, 'documento');
  });

  test('línea de recurso escrita con Shift+Enter no da falso aviso', () => {
    const html = '<p>[vídeo:] Uno<br />[enlace:] Dos</p>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });

  test('formato de Word alrededor del marcador no da falso aviso', () => {
    const html = '<p><strong>[vídeo:]</strong> Título</p>';
    assert.deepEqual(detectSemanticTagIssues(html), []);
  });

  test('no interfiere con la detección de cajas sin cerrar', () => {
    const html = '<p>[ejemplo]</p><p>[vídeo:] Título</p>';
    const issues = detectSemanticTagIssues(html);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'unclosed-box');
  });
});
