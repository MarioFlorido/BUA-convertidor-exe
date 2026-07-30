/**
 * Iconos de las líneas de recurso: [vídeo:], [documento:] y [enlace:].
 *
 * El material BUA enlaza constantemente a recursos externos —un vídeo, un PDF,
 * una web— y todos esos enlaces se veían igual que cualquier otro enlace del
 * texto: el lector no sabe qué le espera al otro lado hasta que hace clic.
 * Escribiendo «[vídeo:] Título del recurso» al principio del párrafo, el
 * convertidor sustituye la etiqueta por el icono correspondiente y pone la línea
 * en cursiva, de modo que la lista de recursos se distingue de un vistazo del
 * cuerpo del texto.
 *
 * Como el icono de «enlace externo» de los encabezados (externalLinkIcon.ts),
 * va por CSS y no como contenido: lo que el autor edita después en eXeLearning
 * sigue siendo su texto, sin ningún adorno pegado dentro.
 *
 * COLOR — un solo literal, `var(--color-primary, #135d87)`, que da el MISMO
 * azul en las tres salidas por dos caminos distintos:
 *   - PDF: el renderer define `--color-primary` en `:root` con el color real
 *     del tema (semanticDocumentToPrintHtml), así que el icono sale en el color
 *     de la paleta, igual que los títulos y los filetes.
 *   - ELPX y preview: los temas de eXeLearning NO declaran variables CSS, así
 *     que cae en el literal — que es el primario de la paleta BUA y el que
 *     declaran los ocho temas publicados («Paleta: #135d87 · #deb13c …»), el
 *     mismo que usa el PDF por defecto. Si algún día un tema declara la
 *     variable, el icono lo sigue sin tocar nada aquí.
 *
 * Este módulo cubre las salidas de eXeLearning (content.xml del ELPX y páginas
 * de vista previa del ZIP). El PDF lleva los MISMOS dibujos en
 * `html-print/printStyles.css`, que es un `.css` y no puede importar de aquí: si
 * se cambia un icono, cambiar los dos.
 */

/** Clase base de una línea de recurso (marca la cursiva y reserva el icono). */
export const RESOURCE_CLASS = 'bua_recurso';

/** Tipos de recurso reconocidos, en su forma normalizada (sin tilde). */
export type ResourceKind = 'video' | 'documento' | 'enlace';

/**
 * Los SVG van percent-encodeados A PROPÓSITO: sin comillas, `<`, `>` ni `#`, el
 * data:URI atraviesa intacto el escapado XML del `content.xml`, el `<style>` del
 * `<head>` exportado y un `url()` de CSS sin comillas. Trazo de grosor 2, que a
 * poco más de un cuadratín se lee limpio sin emborronar el dibujo.
 */
const ICONS: Record<ResourceKind, string> = {
  // Pantalla apaisada con el triángulo de reproducción macizo.
  video:
    'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27black%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Crect%20x=%272%27%20y=%275%27%20width=%2720%27%20height=%2714%27%20rx=%272.5%27/%3E%3Cpath%20d=%27M10.5%209.2l4.8%202.8-4.8%202.8z%27%20fill=%27black%27/%3E%3C/svg%3E',
  // Hoja con la esquina doblada y dos renglones de texto.
  documento:
    'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27black%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M14%203H7a2%202%200%200%200-2%202v14a2%202%200%200%200%202%202h10a2%202%200%200%200%202-2V8z%27/%3E%3Cpath%20d=%27M14%203v5h5%27/%3E%3Cpath%20d=%27M9%2013.5h6%27/%3E%3Cpath%20d=%27M9%2017h6%27/%3E%3C/svg%3E',
  // Dos eslabones de cadena entrelazados. A propósito distinto del icono de
  // «enlace externo» de los encabezados (cuadrado con flecha): son dos cosas
  // diferentes y pueden coincidir en la misma página.
  enlace:
    'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27black%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M10%2013a5%205%200%200%200%207.5.5l3-3a5%205%200%200%200-7-7l-1.7%201.7%27/%3E%3Cpath%20d=%27M14%2011a5%205%200%200%200-7.5-.5l-3%203a5%205%200%200%200%207%207l1.7-1.7%27/%3E%3C/svg%3E',
};

/** Regla `mask-image` (con prefijo -webkit-) para un tipo de recurso. */
function maskFor(kind: ResourceKind): string {
  return (
    `.exe-content .${RESOURCE_CLASS}_${kind}::before` +
    `{-webkit-mask-image:url(${ICONS[kind]});mask-image:url(${ICONS[kind]})}`
  );
}

/**
 * Regla CSS lista para inyectar en las salidas de eXeLearning (una sola línea,
 * como el resto de estilos extra).
 */
export const RESOURCE_LINK_CSS = [
  `.exe-content .${RESOURCE_CLASS}{font-style:italic}`,
  `.exe-content .${RESOURCE_CLASS}::before` +
    '{content:"";display:inline-block;width:1.1em;height:1.1em;margin-right:.4em;' +
    'vertical-align:-.2em;background-color:var(--color-primary,#135d87);' +
    '-webkit-mask-size:contain;mask-size:contain;' +
    '-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;' +
    '-webkit-mask-position:center;mask-position:center}',
  maskFor('video'),
  maskFor('documento'),
  maskFor('enlace'),
].join('');
