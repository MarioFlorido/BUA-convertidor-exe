/**
 * Escala del cuerpo de letra de un título largo, para que quepa en su caja.
 *
 * El título de un documento puede venir de «Comentarios» del Word (ver
 * docxCoreProperties.ts) y medir cientos de caracteres. La cabecera de los temas
 * de eXeLearning es una banda de 400 px con el título anclado abajo: lo que no
 * cabe se sale por ARRIBA y no se ve (medido con 383 caracteres: 15 líneas,
 * 691 px, 329 px fuera de la página). La portada del PDF aguanta más, pero con
 * ~400 caracteres el título empieza a pisar el año y el pie de licencia.
 *
 * La superficie que ocupa un texto crece con su longitud y con el CUADRADO del
 * cuerpo de letra, así que para que un título de `length` caracteres ocupe lo
 * mismo que uno de `comfortableLength` a tamaño normal, el cuerpo se reduce por
 * √(comfortableLength / length). Un título corto se queda como está (escala 1).
 */

/** Cuerpo mínimo: por debajo de un 40 % el título deja de leerse como título. */
const MIN_SCALE = 0.4;

/**
 * Caracteres que caben con holgura en la cabecera de los temas de eXeLearning
 * (dos líneas a tamaño normal en un escritorio corriente).
 */
export const HEADER_TITLE_COMFORTABLE_LENGTH = 90;

/** Caracteres que caben con holgura en la portada del PDF (cuatro líneas a 28 pt). */
export const COVER_TITLE_COMFORTABLE_LENGTH = 140;

/**
 * @param title - Título a encajar
 * @param comfortableLength - Caracteres que caben con holgura a tamaño normal
 * @returns Factor en (0, 1], con dos decimales
 */
export function longTitleScale(title: string, comfortableLength: number): number {
  const length = title.trim().length;
  if (length <= comfortableLength) return 1;
  const scale = Math.sqrt(comfortableLength / length);
  return Math.max(MIN_SCALE, Math.round(scale * 100) / 100);
}

// ─── CSS de cabecera para títulos largos ──────────────────────────────────────

/*
 * Selectores con `body[class]` a propósito. El tema ancla su regla a la clase
 * del formato (`.exe-export #header`, `.exe-web-site .exe-content
 * .package-header`, …), todas con `!important`. Entre dos `!important` gana la
 * más específica, así que empatar no basta: `body[class]` añade un elemento y
 * un atributo y deja estas por encima de cualquiera de ellas, sea cual sea la
 * clase que lleve el <body> exportado.
 */
const BAND = 'body[class] #header,body[class] .exe-content .package-header';
const TITLE = 'body[class] #headerContent,body[class] .exe-content .package-title';
const SUBTITLE = 'body[class] .exe-content .package-subtitle';

/**
 * CSS que hace caber un título largo en la cabecera del ELPX exportado.
 *
 * Por qué no basta con la variable: eXeLearning exporta con el tema que tiene
 * INSTALADO, no con el que viaja dentro del .elpx. Si esa copia es anterior a
 * `--bua-title-scale`, nadie lee la variable y el título sale a tamaño completo
 * (medido: 45 px, 544 px de alto en una banda de 400 → 182 px fuera de la
 * página, por arriba). Lo único que sobrevive al export es este <style>, así
 * que aquí va la regla entera y no solo el dato.
 *
 * Dos medidas, y la primera es la que de verdad cierra el problema:
 *
 * 1. La banda crece. Deja de tener altura fija con el título en posición
 *    absoluta —de ahí que lo que no cabía se escapara por arriba— y pasa a ser
 *    una caja flexible con `min-height` y el contenido pegado abajo. Un título
 *    que no cabe empuja la banda hacia abajo; no se sale nunca, tenga el
 *    tamaño que tenga y con cualquier ancho de ventana.
 * 2. El cuerpo se reduce, ya calculado (ver longTitleScale), para que la banda
 *    no tenga que crecer tanto: con los 383 caracteres del caso real se queda
 *    en los 400 px de siempre en vez de irse a 614 px.
 *
 * Un título corto no llama a esta función: su cabecera no se toca.
 *
 * @param scale - Factor de longTitleScale, siempre menor que 1
 */
export function longTitleHeaderCss(scale: number): string {
  return (
    `${BAND}{height:auto !important;min-height:400px !important;` +
    'display:flex !important;flex-direction:column !important;' +
    'justify-content:flex-end !important;padding:32px 32px 16px !important;' +
    'overflow:hidden !important}' +
    `${TITLE}{position:static !important;margin:0 0 8px !important;` +
    // Suelo de 1rem: en una ventana estrecha el clamp ya está en su mínimo
    // (1.5rem) y multiplicarlo dejaba el título del sitio más pequeño que el
    // texto corriente (11,5 px medidos a 390 px de ancho). Con la banda
    // creciendo, pasarse de alto dejó de ser un problema; quedarse ilegible sí
    // lo era.
    `font-size:max(1rem, calc(clamp(1.5rem, 3vw, 3.1rem) * ${scale})) !important}` +
    `${SUBTITLE}{position:static !important;margin:0 !important}`
  );
}
