import mammoth from 'mammoth';

/**
 * Parser para archivos DOCX
 *
 * Responsabilidad única: Convertir DOCX → HTML semántico
 * Usa Mammoth.js como librería de parsing con configuración estándar
 *
 * IMPORTANTE: Output HTML debe ser idéntico al de Mammoth.js puro
 * Validación: SHA-256 de content.xml debe ser byte-identical
 */

export interface DocxParseResult {
  html: string;
  metadata?: {
    title?: string;
    author?: string;
  };
}

/**
 * Mapa de estilos DOCX a HTML
 * Define cómo se convierten los estilos específicos del DOCX
 */
const DOCX_STYLE_MAP: string[] = [
  "p[style-name='Code'] => pre:fresh",
  "p[style-name='Código'] => pre:fresh",
  "p[style-name='Codigo'] => pre:fresh",
  "p[style-name='HTML'] => pre:fresh",
  "p[style-name='Preformatted'] => pre:fresh",
  "p[style-name='Preformatted Text'] => pre:fresh",
  "r[style-name='Code'] => code",
  "r[style-name='Código'] => code",
  "r[style-name='Codigo'] => code",
  "r[style-name='HTML'] => code",
  // Estilos de lista en español (Word instalado en español usa estos nombres)
  "p[style-name='Lista con viñetas'] => ul > li:fresh",
  "p[style-name='Lista con viñetas 2'] => ul > li:fresh",
  "p[style-name='Lista con viñetas 3'] => ul > li:fresh",
  "p[style-name='Lista numerada'] => ol > li:fresh",
  "p[style-name='Lista numerada 2'] => ol > li:fresh",
  "p[style-name='Lista numerada 3'] => ol > li:fresh",
  "p[style-name='Párrafo de lista'] => ul > li:fresh",
];

/**
 * Parser DOCX
 * Convierte archivos DOCX a HTML
 */
export class DocxParser {
  /**
   * Convierte archivo DOCX a HTML
   *
   * @param file Archivo DOCX (File API)
   * @returns Resultado con HTML extraído y metadatos
   *
   * @throws Error si no se puede leer o procesar el DOCX
   */
  async parse(file: File): Promise<DocxParseResult> {
    const inputBuffer = await file.arrayBuffer();

    // Detectar si estamos en Node.js o en el navegador
    const mammothInput =
      typeof Buffer !== 'undefined'
        ? { buffer: Buffer.from(inputBuffer) }
        : { arrayBuffer: inputBuffer };

    const result = await mammoth.convertToHtml(mammothInput, {
      includeEmbeddedStyleMap: true,
      includeDefaultStyleMap: true,
      ignoreEmptyParagraphs: true,
      styleMap: DOCX_STYLE_MAP,
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${await image.readAsBase64String()}`,
      })),
    });

    return {
      html: result.value,
      metadata: {}
    };
  }
}
