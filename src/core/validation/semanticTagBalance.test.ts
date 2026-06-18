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
