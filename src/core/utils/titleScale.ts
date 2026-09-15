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
