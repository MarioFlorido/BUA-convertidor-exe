/**
 * themeVersion — lectura e incremento del <version> del config.xml de un tema.
 *
 * eXeLearning identifica un estilo por su <name> y usa el <version> para detectar
 * revisiones: cuando un .elpx trae un estilo que el usuario YA tiene instalado,
 * eXeLearning solo lo reconoce como nuevo si su <version> es mayor. Por eso, al
 * actualizar un tema hay que subir ese número; si no, quien ya lo tenga seguiría
 * viendo el CSS antiguo (el análogo, en eXeLearning, del cache-busting del .zip).
 *
 * Funciones puras (string → string/number): se testean sin red ni DOM.
 *
 * Nota: se asume <version> entero (es lo que usan los temas del proyecto). El
 * campo decimal del config.xml es <compatibility>, que no se toca aquí.
 */

const VERSION_RE = /<version>\s*(\d+)\s*<\/version>/i;

/** Lee el número de <version>. null si no existe o no es un entero. */
export function readThemeVersion(configXml: string): number | null {
  const match = configXml.match(VERSION_RE);
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * Próxima versión a publicar: monótona respecto a lo ya publicado.
 * `max(publicada, local) + 1`; si no hay ninguna referencia, empieza en 1.
 */
export function nextThemeVersion(
  publishedVersion: number | null,
  localVersion: number | null,
): number {
  return Math.max(publishedVersion ?? 0, localVersion ?? 0) + 1;
}

/**
 * Devuelve el config.xml con el <version> fijado a `version`.
 * Si el config.xml no tenía <version>, lo inserta tras la apertura <theme>.
 */
export function setThemeVersion(configXml: string, version: number): string {
  if (VERSION_RE.test(configXml)) {
    return configXml.replace(VERSION_RE, `<version>${version}</version>`);
  }
  return configXml.replace(
    /<theme>\s*/i,
    (opening) => `${opening}<version>${version}</version>\n    `,
  );
}
