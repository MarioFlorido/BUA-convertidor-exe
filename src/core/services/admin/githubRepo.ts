/**
 * githubRepo — configuración del repositorio oficial y helpers de la API REST.
 *
 * El panel de administración publica temas oficiales commiteando archivos
 * directamente a la rama `main` vía la Git Data API de GitHub. El despliegue
 * a producción (gh-pages) lo realiza el workflow `deploy.yml` automáticamente
 * en cada push a `main`.
 *
 * No hay secrets en el repositorio: el administrador aporta un token de acceso
 * (fine-grained PAT con `contents:write` sobre ESTE repo) en tiempo de ejecución.
 */

export const GITHUB_OWNER = 'MarioFlorido';
export const GITHUB_REPO = 'BUA-convertidor-exe';

/** Rama por defecto a la que se publican los temas (dispara el deploy). */
export const DEFAULT_PUBLISH_BRANCH = 'main';

export const GITHUB_API_BASE = 'https://api.github.com';

/** Ruta (relativa a la raíz del repo) donde viven los temas oficiales. */
export const THEMES_DIR = 'public/themes';

/** Ruta del catálogo de temas. */
export const THEMES_CONFIG_PATH = 'public/themes-config.json';

export function repoApiUrl(pathSuffix: string): string {
  return `${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}${pathSuffix}`;
}

export function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}
