/**
 * Icono de «enlace externo» para los encabezados enlazados (H2/H3/H4).
 *
 * Un título de Word puede ser además un hiperenlace, y dentro de un título
 * grande, en negrita y en mayúsculas el color de enlace del tema se confunde con
 * el color propio del título: el lector no llega a saber que ahí hay algo que
 * abrir. Detrás del texto enlazado se dibuja el icono clásico —cuadrado con la
 * flecha saliendo por la esquina superior derecha— en superíndice.
 *
 * Va por CSS y no como etiqueta dentro del contenido para no ensuciar lo que el
 * autor edita después en eXeLearning. Se pinta como máscara con `currentColor`,
 * así que toma el color del enlace en cualquier tema, sin republicarlos.
 *
 * Este módulo cubre las salidas de eXeLearning (content.xml del ELPX y páginas
 * de vista previa del ZIP). El PDF lleva el MISMO dibujo en
 * `html-print/printStyles.css`, que es un `.css` y no puede importar de aquí: si
 * se cambia el icono, cambiar los dos.
 */

/**
 * El SVG va percent-encodeado A PROPÓSITO: sin comillas, `<`, `>` ni `#`, el
 * data:URI atraviesa intacto el escapado XML del `content.xml`, el `<style>` del
 * `<head>` exportado y un `url()` de CSS sin comillas. Trazo de grosor 3 porque
 * el icono se ve a poco más de medio cuadratín.
 */
const EXTERNAL_LINK_ICON =
  'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27black%27%20stroke-width=%273%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M19%2013v8H3V5h8%27/%3E%3Cpath%20d=%27M14%203h7v7%27/%3E%3Cpath%20d=%27M21%203L11%2013%27/%3E%3C/svg%3E';

/**
 * Regla CSS lista para inyectar en las salidas de eXeLearning (una sola línea,
 * como el resto de estilos extra). Solo marca los enlaces `http(s)`: un
 * `mailto:` o un ancla interna se conservan sin icono.
 */
export const LINKED_HEADING_ICON_CSS =
  '.exe-content h2 a[href^=http]::after,' +
  '.exe-content h3 a[href^=http]::after,' +
  '.exe-content h4 a[href^=http]::after' +
  '{content:"";display:inline-block;width:.55em;height:.55em;margin-left:.22em;' +
  'vertical-align:super;background-color:currentColor;' +
  `-webkit-mask-image:url(${EXTERNAL_LINK_ICON});mask-image:url(${EXTERNAL_LINK_ICON});` +
  '-webkit-mask-size:contain;mask-size:contain;' +
  '-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}';
