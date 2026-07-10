/**
 * Fixture sintético de un .elp de eXeLearning 2.9 para los tests del conversor
 * (elpParser.test.ts, elpToDocx.test.ts). Reproduce la estructura observada en
 * paquetes reales de la BUA: Package → Node raíz → subpáginas, iDevices
 * JsIdevice de tipo "text" con su TextAreaField y recursos en la raíz del ZIP.
 *
 * No se usan .elp reales en el repositorio: son materiales docentes y pesan MB.
 */

import { zipSync, strToU8 } from 'fflate';

/** PNG mínimo válido de 2×3 px (cabecera real: sniffImageSize lee IHDR). */
export const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // firma PNG
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR (longitud + tipo)
  0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03, // ancho = 2, alto = 3
  0x08, 0x02, 0x00, 0x00, 0x00, 0x12, 0x16, 0xf1, 0x4d, // resto de IHDR + CRC
]);

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textIdevice(html: string, reference: number, title = ''): string {
  return `
      <instance class="exe.engine.jsidevice.JsIdevice" reference="${reference}">
       <dictionary>
        <string role="key" value="_title"></string>
        <unicode value="${xmlEscape(title)}"></unicode>
        <string role="key" value="_iDeviceDir"></string>
        <string value="text"></string>
        <string role="key" value="_typeName"></string>
        <unicode value="Text"></unicode>
        <string role="key" value="fields"></string>
        <list>
         <instance class="exe.engine.field.TextAreaField" reference="${reference + 100}">
          <dictionary>
           <string role="key" value="_idevice"></string>
           <reference key="${reference}"></reference>
           <string role="key" value="content_w_resourcePaths"></string>
           <unicode content="true" value="${xmlEscape(html)}"></unicode>
          </dictionary>
         </instance>
        </list>
       </dictionary>
      </instance>`;
}

export interface FixtureOptions {
  /** HTML del iDevice de la página raíz. */
  rootHtml?: string;
  /** HTML del iDevice de la subpágina. */
  childHtml?: string;
  /** Título del segundo iDevice de la raíz (vacío = sin iDevice extra). */
  extraIdeviceTitle?: string;
}

/** contentv3.xml sintético con página raíz + una subpágina. */
export function buildFixtureContentXml(options: FixtureOptions = {}): string {
  const rootHtml =
    options.rootHtml ??
    '<div class="exe-text"><p>Bienvenida al <strong>curso</strong>.</p>' +
      '<p><img src="resources/foto.png" alt="Una foto" width="10" height="5" /></p></div>';
  const childHtml = options.childHtml ?? '<p>Contenido de la unidad.</p>';
  const extraIdevice = options.extraIdeviceTitle
    ? textIdevice('<p>Texto del iDevice titulado.</p>', 9, options.extraIdeviceTitle)
    : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<instance xmlns="http://www.exelearning.org/content/v0.3" reference="2" version="0.3" class="exe.engine.package.Package">
 <dictionary>
  <string role="key" value="_title"></string>
  <unicode value="Curso de prueba"></unicode>
  <string role="key" value="_author"></string>
  <unicode value="Biblioteca Universitaria"></unicode>
  <string role="key" value="_lang"></string>
  <unicode value="es"></unicode>
  <string role="key" value="root"></string>
  <instance class="exe.engine.node.Node" reference="10">
   <dictionary>
    <string role="key" value="_title"></string>
    <unicode value="Presentación"></unicode>
    <string role="key" value="idevices"></string>
    <list>${textIdevice(rootHtml, 1)}${extraIdevice}
    </list>
    <string role="key" value="children"></string>
    <list>
     <instance class="exe.engine.node.Node" reference="11">
      <dictionary>
       <string role="key" value="_title"></string>
       <unicode value="Unidad 1"></unicode>
       <string role="key" value="parent"></string>
       <reference key="10"></reference>
       <string role="key" value="idevices"></string>
       <list>${textIdevice(childHtml, 2)}
       </list>
       <string role="key" value="children"></string>
       <list></list>
      </dictionary>
     </instance>
    </list>
   </dictionary>
  </instance>
 </dictionary>
</instance>`;
}

/** ZIP .elp completo (contentv3.xml + recursos en la raíz), listo para parseElp. */
export function buildFixtureElp(options: FixtureOptions = {}): Uint8Array {
  return zipSync({
    'contentv3.xml': strToU8(buildFixtureContentXml(options)),
    'content.data': strToU8('pickle-binario-que-se-ignora'),
    'foto.png': TINY_PNG,
  });
}
