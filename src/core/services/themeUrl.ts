/**
 * themeUrl — construcción de la URL del ZIP de un tema oficial.
 *
 * Los ZIP de temas (`<id>.zip`) se sirven desde una URL estable, así que el
 * navegador (y el CDN de GitHub Pages) los cachean. Para que al actualizar un
 * tema no quede "tapado" por una copia vieja en caché, se añade un parámetro de
 * versión (`?v=`) que cambia cada vez que el tema se republica — lo aporta el
 * campo `updatedAt` del catálogo `themes-config.json`.
 *
 * Mientras la versión no cambie, la URL es estable y la caché sigue siendo útil
 * (no se vuelve a descargar). Cuando cambia, la URL es nueva y el navegador baja
 * la versión nueva. Es puro (sin red), por lo que se testea fácilmente.
 */

export function themeZipUrl(baseUrl: string, id: string, version?: string): string {
  const suffix = version ? `?v=${encodeURIComponent(version)}` : '';
  return `${baseUrl}${id}.zip${suffix}`;
}
