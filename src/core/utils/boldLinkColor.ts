/**
 * Color de los ENLACES EN NEGRITA en las salidas de eXeLearning.
 *
 * Word guarda un hipervínculo de dos formas y Mammoth las anida al revés:
 *   - Insertar vínculo (Ctrl+K) → `<w:hyperlink>` con los runs dentro
 *     → `<a><strong>Texto</strong></a>`
 *   - Enlace pegado (web, otro documento) → código de campo HYPERLINK, el
 *     enlace va dentro del run → `<strong><a>Texto</a></strong>`
 *
 * En Word ambos se ven igual (estilo «Hipervínculo»: azul y subrayado), pero
 * los temas declaran `.exe-content strong { color: #2a2a2a }` y el base.css de
 * eXeLearning quita el subrayado a los enlaces. Con `<a><strong>` el color
 * propio del strong tapa el heredado del enlace: salía gris y sin subrayar,
 * indistinguible de una negrita cualquiera, mientras que los enlaces pegados
 * sí salían azules. En una lista de recursos, unos nombres parecían enlaces y
 * otros no.
 *
 * La regla hace que la negrita DENTRO de un enlace herede el color del enlace
 * (también el de :hover). Es más específica que la del tema y va después de su
 * style.css, así que gana sin !important y vale para cualquier tema sin
 * republicarlo. Cubre también el enlace negrita solo en parte
 * (`<a><strong>Enlace</strong> (PDF)</a>`), que salía mitad gris, mitad azul.
 *
 * El PDF no lo necesita: la hoja de impresión no da color al strong.
 */
export const BOLD_LINK_COLOR_CSS = '.exe-content a strong,.exe-content a b{color:inherit}';
