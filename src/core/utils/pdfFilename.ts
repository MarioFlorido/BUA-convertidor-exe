/**
 * Nombre con el que el navegador propone guardar el PDF.
 *
 * Por qué hace falta: el PDF no lo genera ConvertidoreXe, lo genera el navegador
 * desde «Imprimir → Guardar como PDF», y el nombre que propone es el `<title>`
 * del documento HTML. Ahí iba el título del documento, que desde que puede venir
 * de «Comentarios» del Word (ver docxCoreProperties.ts) llega a medir cientos de
 * caracteres e incluye caracteres que un nombre de fichero no admite (`:`, `/`,
 * `\`). El resultado era un PDF con un nombre imposible de guardar.
 *
 * El nombre del .docx, en cambio, es siempre un nombre de fichero válido —
 * Windows no deja guardarlo de otra forma —, así que es el que se usa:
 * `nombre.docx` produce `nombre.pdf`, igual que ya producía `nombre.elpx`.
 *
 * Esto NO afecta al título que se ve: la portada del PDF y la cabecera del ELPX
 * siguen mostrando el título largo de «Comentarios».
 */

/**
 * @param sourceFilename - Nombre del fichero de origen, con extensión
 *                         (`nombre.docx` o `nombre.elpx`). Vacío → se usa el título.
 * @param documentTitle  - Título del documento, como respaldo.
 * @returns Nombre sin extensión para el `<title>` del HTML de impresión.
 */
export function pdfBaseName(sourceFilename: string, documentTitle: string): string {
  const stem = sourceFilename.replace(/\.[^.]+$/, '').trim();
  return stem || documentTitle;
}
