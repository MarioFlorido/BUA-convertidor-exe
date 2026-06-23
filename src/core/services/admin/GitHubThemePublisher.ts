/**
 * GitHubThemePublisher — publica/actualiza/elimina temas oficiales en un único
 * commit mediante la Git Data API de GitHub.
 *
 * No toca el workflow de despliegue: al hacer push a la rama destino (por defecto
 * `main`), el Action `deploy.yml` reconstruye (regenerando los .zip con
 * `pack-themes`) y despliega a gh-pages automáticamente.
 *
 * Seguridad de desarrollo:
 *  - `branch` configurable → durante el desarrollo se apunta a una rama de
 *    pruebas para no disparar deploys reales.
 *  - `dryRun` → calcula todo (blobs incluidos NO se crean en dry-run) y devuelve
 *    el plan sin modificar la rama.
 */

import { repoApiUrl, githubHeaders, DEFAULT_PUBLISH_BRANCH, THEMES_DIR, THEMES_CONFIG_PATH } from './githubRepo';
import {
  upsertThemeEntry,
  removeThemeEntry,
  serializeThemesConfig,
  type ThemesConfig,
  type ThemeEntryInput,
} from './themesConfig';
import { buildThemeTreeEntries, buildDeleteThemeTreeEntries, type GitTreeEntry } from './gitTree';
import { readThemeVersion, setThemeVersion, nextThemeVersion } from './themeVersion';

export interface PublishOptions {
  branch?: string;
  dryRun?: boolean;
  /** Mensaje de commit. Si se omite, se genera uno por defecto. */
  message?: string;
}

export interface PublishResult {
  dryRun: boolean;
  branch: string;
  commitSha?: string;
  /** Nº de archivos del tema creados/actualizados. */
  upserted: number;
  /** Nº de archivos obsoletos eliminados. */
  deleted: number;
  /** Plan de entradas del tree (útil en dry-run). */
  treeEntries: GitTreeEntry[];
  /** True si la operación solo editó el catálogo (metadatos), sin tocar el tema. */
  metadataOnly?: boolean;
}

// ── Helpers base64 (navegador) ───────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64ToString(b64: string): string {
  return new TextDecoder().decode(base64ToBytes(b64));
}

// ── Robustez ante el rate limit / parpadeos de red ───────────────────────────
//
// Publicar un tema son ~50 escrituras seguidas; varios temas en pocos minutos
// cruzan el "secondary rate limit" de GitHub (anti-abuso por crear contenido
// demasiado rápido). Sus respuestas llegan SIN cabecera CORS, así que en el
// navegador el fetch lanza un TypeError "Failed to fetch" en vez de un status.
// Mitigamos en dos frentes: (1) throttle entre blobs para no cruzar el umbral,
// (2) reintentos con backoff para absorber el límite o un parpadeo puntual.

/** Pausa entre subidas de blob consecutivas (~80 escrituras/min, bajo el umbral). */
const BLOB_THROTTLE_MS = 600;
/** Intentos totales por petición (1 inicial + reintentos). */
const MAX_API_ATTEMPTS = 4;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Espera del reintento `attempt` (1-based): ~2s, 6s, 15s, con jitter. */
function backoffMs(attempt: number): number {
  const base = [2000, 6000, 15000][Math.min(attempt - 1, 2)];
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

class GitHubThemePublisherClass {
  constructor(private getToken: () => string | null) {}

  private headers(): Record<string, string> {
    const token = this.getToken();
    if (!token) throw new Error('No hay sesión de administración activa.');
    return githubHeaders(token);
  }

  private async api<T>(pathSuffix: string, init?: RequestInit): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_API_ATTEMPTS; attempt++) {
      let resp: Response;
      try {
        resp = await fetch(repoApiUrl(pathSuffix), {
          ...init,
          headers: { ...this.headers(), ...(init?.headers ?? {}) },
        });
      } catch (err) {
        // TypeError "Failed to fetch": red caída o respuesta del rate limit
        // secundario sin cabecera CORS. Reintentable: la operación es atómica
        // (el repo solo cambia en updateRef; los blobs sueltos los recolecta GitHub).
        lastError = err;
        if (attempt < MAX_API_ATTEMPTS) {
          await delay(backoffMs(attempt));
          continue;
        }
        throw new Error(
          `No se pudo contactar con GitHub en ${pathSuffix} tras ${MAX_API_ATTEMPTS} intentos ` +
            `(posible límite de GitHub o red inestable). No se ha modificado nada en el repositorio.`,
        );
      }

      // 403/429 (rate limit) o 5xx (sobrecarga transitoria): esperar y reintentar,
      // respetando Retry-After si GitHub lo indica.
      if ((resp.status === 403 || resp.status === 429 || resp.status >= 500) && attempt < MAX_API_ATTEMPTS) {
        const retryAfter = Number(resp.headers.get('retry-after'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
        await delay(waitMs);
        continue;
      }

      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(`GitHub API ${resp.status} en ${pathSuffix}: ${body.slice(0, 200)}`);
      }
      return resp.json() as Promise<T>;
    }
    throw new Error(`No se pudo completar ${pathSuffix}: ${String(lastError)}`);
  }

  private async getRefSha(branch: string): Promise<string> {
    const data = await this.api<{ object: { sha: string } }>(`/git/ref/heads/${branch}`);
    return data.object.sha;
  }

  private async getBaseTreeSha(commitSha: string): Promise<string> {
    const data = await this.api<{ tree: { sha: string } }>(`/git/commits/${commitSha}`);
    return data.tree.sha;
  }

  /** Lista las rutas relativas (al tema) de los archivos existentes del tema. */
  private async listExistingThemeFiles(themeId: string, rootTreeSha: string): Promise<string[]> {
    const data = await this.api<{ tree: Array<{ path: string; type: string }> }>(
      `/git/trees/${rootTreeSha}?recursive=1`,
    );
    const prefix = `${THEMES_DIR}/${themeId}/`;
    return data.tree
      .filter((e) => e.type === 'blob' && e.path.startsWith(prefix))
      .map((e) => e.path.slice(prefix.length));
  }

  /** Lista las rutas relativas (al tema) de sus archivos ya publicados en `branch`. */
  async listThemeFiles(themeId: string, branch = DEFAULT_PUBLISH_BRANCH): Promise<string[]> {
    const headSha = await this.getRefSha(branch);
    const baseTreeSha = await this.getBaseTreeSha(headSha);
    return this.listExistingThemeFiles(themeId, baseTreeSha);
  }

  /**
   * Lee el contenido (bytes) de un archivo de un tema ya publicado en `branch`.
   * Vía Contents API: igual que `fetchPublishedThemeVersion`, así que comparte
   * su límite de ~1 MB por archivo (suficiente para CSS e imágenes de tema).
   */
  async fetchThemeFileBytes(
    themeId: string,
    relPath: string,
    branch = DEFAULT_PUBLISH_BRANCH,
  ): Promise<Uint8Array> {
    const data = await this.api<{ content: string }>(
      `/contents/${THEMES_DIR}/${themeId}/${relPath}?ref=${branch}`,
    );
    return base64ToBytes(data.content);
  }

  /** Como `fetchThemeFileBytes`, decodificado como texto UTF-8 (para CSS/XML). */
  async fetchThemeFileText(
    themeId: string,
    relPath: string,
    branch = DEFAULT_PUBLISH_BRANCH,
  ): Promise<string> {
    return new TextDecoder().decode(await this.fetchThemeFileBytes(themeId, relPath, branch));
  }

  /** Lee el catálogo actual de la rama. Devuelve el objeto parseado. */
  private async fetchThemesConfig(branch: string): Promise<ThemesConfig> {
    const data = await this.api<{ content: string }>(
      `/contents/${THEMES_CONFIG_PATH}?ref=${branch}`,
    );
    return JSON.parse(base64ToString(data.content)) as ThemesConfig;
  }

  /**
   * Lee el `<version>` del config.xml publicado de un tema en la rama.
   * Devuelve null si el tema (o su config.xml) aún no existe en el repo.
   */
  private async fetchPublishedThemeVersion(themeId: string, branch: string): Promise<number | null> {
    try {
      const data = await this.api<{ content: string }>(
        `/contents/${THEMES_DIR}/${themeId}/config.xml?ref=${branch}`,
      );
      return readThemeVersion(base64ToString(data.content));
    } catch (err) {
      // SOLO el 404 significa "tema nuevo, aún sin config.xml publicado".
      // Cualquier otro error (rate limit, red) NO debe interpretarse como tema
      // nuevo: hacerlo dejaría el <version> sin incrementar en silencio y
      // eXeLearning no detectaría la actualización. Mejor propagar el fallo.
      if ((err as Error).message.includes('404')) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Devuelve una copia de `files` con el `<version>` del config.xml incrementado.
   *
   * eXeLearning identifica un estilo por su `<name>` y usa `<version>` para
   * detectar revisiones: si el número no sube, quien ya tenga el tema instalado
   * seguiría viendo el CSS antiguo. El incremento es monótono respecto a lo ya
   * publicado, así que no depende de la versión que traiga la carpeta local.
   */
  private async withBumpedThemeVersion(
    themeId: string,
    branch: string,
    files: Record<string, Uint8Array>,
  ): Promise<Record<string, Uint8Array>> {
    const configKey = Object.keys(files).find(
      (p) => p === 'config.xml' || p.endsWith('/config.xml'),
    );
    if (!configKey) return files; // el validador ya exige config.xml; defensivo

    const localXml = new TextDecoder().decode(files[configKey]);
    const published = await this.fetchPublishedThemeVersion(themeId, branch);
    const next = nextThemeVersion(published, readThemeVersion(localXml));
    const bumpedXml = setThemeVersion(localXml, next);

    return { ...files, [configKey]: new TextEncoder().encode(bumpedXml) };
  }

  private async createBlob(bytes: Uint8Array): Promise<string> {
    const data = await this.api<{ sha: string }>(`/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: bytesToBase64(bytes), encoding: 'base64' }),
    });
    return data.sha;
  }

  private async createTree(baseTreeSha: string, entries: GitTreeEntry[]): Promise<string> {
    const data = await this.api<{ sha: string }>(`/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: baseTreeSha, tree: entries }),
    });
    return data.sha;
  }

  private async createCommit(message: string, treeSha: string, parentSha: string): Promise<string> {
    const data = await this.api<{ sha: string }>(`/git/commits`, {
      method: 'POST',
      body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
    });
    return data.sha;
  }

  private async updateRef(branch: string, commitSha: string): Promise<void> {
    try {
      await this.api(`/git/refs/heads/${branch}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commitSha, force: false }),
      });
    } catch (err) {
      // 422 not a fast forward: otro commit entró en la rama durante la subida.
      // El commit que creamos quedó suelto (no referenciado) → el repo no cambió.
      if ((err as Error).message.includes('422')) {
        throw new Error(
          'La rama cambió durante la publicación (entró otro commit en main). ' +
            'No se ha modificado nada en el repositorio; vuelve a publicar el tema.',
        );
      }
      throw err;
    }
  }

  /**
   * Publica o actualiza un tema: sube todos sus archivos, elimina los obsoletos
   * que ya no estén en la carpeta, y actualiza el catálogo.
   */
  async publishTheme(
    input: ThemeEntryInput,
    files: Record<string, Uint8Array>,
    opts: PublishOptions = {},
  ): Promise<PublishResult> {
    const branch = opts.branch ?? DEFAULT_PUBLISH_BRANCH;
    const dryRun = opts.dryRun ?? false;

    const headSha = await this.getRefSha(branch);
    const baseTreeSha = await this.getBaseTreeSha(headSha);

    const config = await this.fetchThemesConfig(branch);
    // Marca de versión por publicación: cambia la URL del .zip del tema (`?v=`)
    // para que los navegadores bajen la versión nueva en vez de reusar la cacheada.
    const newConfig = upsertThemeEntry(config, { ...input, updatedAt: new Date().toISOString() });
    const configBytes = new TextEncoder().encode(serializeThemesConfig(newConfig));

    const oldRelPaths = await this.listExistingThemeFiles(input.id, baseTreeSha);

    const upsertRelPaths = Object.keys(files);
    const deleted = oldRelPaths.filter((p) => !upsertRelPaths.includes(p)).length;

    if (dryRun) {
      // En dry-run NO creamos blobs: devolvemos el plan con SHAs simbólicos.
      const upsertBlobs: Record<string, string> = {};
      for (const p of upsertRelPaths) upsertBlobs[p] = '<dry-run>';
      const treeEntries = buildThemeTreeEntries({
        themeId: input.id,
        upsertBlobs,
        deleteRelPaths: oldRelPaths,
        configBlobSha: '<dry-run-config>',
      });
      return { dryRun: true, branch, upserted: upsertRelPaths.length, deleted, treeEntries };
    }

    // Auto-incrementar el <version> del config.xml para que eXeLearning reconozca
    // la actualización (identifica los estilos por <name> y usa <version>).
    const filesToPublish = await this.withBumpedThemeVersion(input.id, branch, files);

    // Crear blobs de cada archivo del tema. Throttle entre subidas para no
    // cruzar el límite secundario de GitHub al publicar varios temas seguidos.
    const upsertBlobs: Record<string, string> = {};
    const blobEntries = Object.entries(filesToPublish);
    for (let i = 0; i < blobEntries.length; i++) {
      const [relPath, bytes] = blobEntries[i];
      upsertBlobs[relPath] = await this.createBlob(bytes);
      if (i < blobEntries.length - 1) await delay(BLOB_THROTTLE_MS);
    }
    const configBlobSha = await this.createBlob(configBytes);

    const treeEntries = buildThemeTreeEntries({
      themeId: input.id,
      upsertBlobs,
      deleteRelPaths: oldRelPaths,
      configBlobSha,
    });

    const treeSha = await this.createTree(baseTreeSha, treeEntries);
    const message = opts.message ?? `feat(themes): publicar ${input.id}`;
    const commitSha = await this.createCommit(message, treeSha, headSha);
    await this.updateRef(branch, commitSha);

    return { dryRun: false, branch, commitSha, upserted: upsertRelPaths.length, deleted, treeEntries };
  }

  /** Elimina un tema oficial por completo: borra su carpeta y lo quita del catálogo. */
  async deleteTheme(themeId: string, opts: PublishOptions = {}): Promise<PublishResult> {
    const branch = opts.branch ?? DEFAULT_PUBLISH_BRANCH;
    const dryRun = opts.dryRun ?? false;

    const headSha = await this.getRefSha(branch);
    const baseTreeSha = await this.getBaseTreeSha(headSha);

    const config = await this.fetchThemesConfig(branch);
    const newConfig = removeThemeEntry(config, themeId);
    const configBytes = new TextEncoder().encode(serializeThemesConfig(newConfig));

    const existingRelPaths = await this.listExistingThemeFiles(themeId, baseTreeSha);

    if (dryRun) {
      const treeEntries = buildDeleteThemeTreeEntries({
        themeId,
        existingRelPaths,
        configBlobSha: '<dry-run-config>',
      });
      return { dryRun: true, branch, upserted: 0, deleted: existingRelPaths.length, treeEntries };
    }

    const configBlobSha = await this.createBlob(configBytes);
    const treeEntries = buildDeleteThemeTreeEntries({ themeId, existingRelPaths, configBlobSha });

    const treeSha = await this.createTree(baseTreeSha, treeEntries);
    const message = opts.message ?? `chore(themes): eliminar ${themeId}`;
    const commitSha = await this.createCommit(message, treeSha, headSha);
    await this.updateRef(branch, commitSha);

    return { dryRun: false, branch, commitSha, upserted: 0, deleted: existingRelPaths.length, treeEntries };
  }

  /**
   * Edita SOLO los metadatos de un tema en el catálogo (nombre, actividad,
   * descripción): un único commit que toca exclusivamente `themes-config.json`,
   * sin tocar los archivos del tema ni su `<version>`.
   *
   * Deliberadamente NO escribe `updatedAt`: los archivos del tema no cambian, así
   * que la URL del `.zip` (que usa `?v=updatedAt`) debe seguir igual para no forzar
   * descargas innecesarias. `upsertThemeEntry` conserva el `updatedAt` previo.
   *
   * Nota: el `language` no se edita aquí — el runtime lo deriva del `<language>`
   * del config.xml del tema, que tiene prioridad sobre el catálogo.
   */
  async updateThemeMetadata(
    input: ThemeEntryInput,
    opts: PublishOptions = {},
  ): Promise<PublishResult> {
    const branch = opts.branch ?? DEFAULT_PUBLISH_BRANCH;
    const dryRun = opts.dryRun ?? false;

    const headSha = await this.getRefSha(branch);
    const baseTreeSha = await this.getBaseTreeSha(headSha);

    const config = await this.fetchThemesConfig(branch);
    // Sin updatedAt: ver doc del método. upsertThemeEntry conserva el previo.
    const newConfig = upsertThemeEntry(config, input);
    const configBytes = new TextEncoder().encode(serializeThemesConfig(newConfig));

    if (dryRun) {
      const treeEntries = buildThemeTreeEntries({
        themeId: input.id,
        upsertBlobs: {},
        configBlobSha: '<dry-run-config>',
      });
      return { dryRun: true, branch, upserted: 0, deleted: 0, treeEntries, metadataOnly: true };
    }

    const configBlobSha = await this.createBlob(configBytes);
    const treeEntries = buildThemeTreeEntries({
      themeId: input.id,
      upsertBlobs: {},
      configBlobSha,
    });

    const treeSha = await this.createTree(baseTreeSha, treeEntries);
    const message = opts.message ?? `chore(themes): editar metadatos de ${input.id}`;
    const commitSha = await this.createCommit(message, treeSha, headSha);
    await this.updateRef(branch, commitSha);

    return { dryRun: false, branch, commitSha, upserted: 0, deleted: 0, treeEntries, metadataOnly: true };
  }

  /**
   * Edición rápida: sustituye o añade UN solo archivo de un tema ya publicado
   * (p. ej. style.css, una imagen) sin pasar por el selector de carpeta completo.
   *
   * En el mismo commit, sin tocar nada más del tema:
   *  - sube `relPath` con `bytes`;
   *  - incrementa el `<version>` de config.xml (eXeLearning de escritorio
   *    detecta así la revisión en instalaciones que ya tengan el tema);
   *  - actualiza `updatedAt` en el catálogo (cache-busting de la URL del .zip
   *    que sirve esta app — ver `BuiltInThemeProvider`).
   *
   * No editable por esta vía: `config.xml` en sí (cambios estructurales del
   * tema solo a través de la carpeta completa).
   */
  async updateThemeFile(
    themeId: string,
    relPath: string,
    bytes: Uint8Array,
    opts: PublishOptions = {},
  ): Promise<PublishResult> {
    const cleanRelPath = relPath.replace(/^\/+/, '');
    if (cleanRelPath === 'config.xml') {
      throw new Error('config.xml no se edita por esta vía: publica la carpeta completa del tema.');
    }

    const branch = opts.branch ?? DEFAULT_PUBLISH_BRANCH;
    const dryRun = opts.dryRun ?? false;

    const headSha = await this.getRefSha(branch);
    const baseTreeSha = await this.getBaseTreeSha(headSha);

    const currentConfigXml = await this.fetchThemeFileText(themeId, 'config.xml', branch);
    const currentVersion = readThemeVersion(currentConfigXml);
    const bumpedConfigXml = setThemeVersion(currentConfigXml, nextThemeVersion(currentVersion, currentVersion));

    const catalog = await this.fetchThemesConfig(branch);
    const newCatalog = upsertThemeEntry(catalog, { id: themeId, updatedAt: new Date().toISOString() });
    const catalogBytes = new TextEncoder().encode(serializeThemesConfig(newCatalog));

    if (dryRun) {
      const treeEntries = buildThemeTreeEntries({
        themeId,
        upsertBlobs: { [cleanRelPath]: '<dry-run>', 'config.xml': '<dry-run-version>' },
        configBlobSha: '<dry-run-config>',
      });
      return { dryRun: true, branch, upserted: 2, deleted: 0, treeEntries };
    }

    const fileBlobSha = await this.createBlob(bytes);
    await delay(BLOB_THROTTLE_MS);
    const configXmlBlobSha = await this.createBlob(new TextEncoder().encode(bumpedConfigXml));
    const catalogBlobSha = await this.createBlob(catalogBytes);

    const treeEntries = buildThemeTreeEntries({
      themeId,
      upsertBlobs: { [cleanRelPath]: fileBlobSha, 'config.xml': configXmlBlobSha },
      configBlobSha: catalogBlobSha,
    });

    const treeSha = await this.createTree(baseTreeSha, treeEntries);
    const message = opts.message ?? `chore(themes): actualizar ${cleanRelPath} en ${themeId}`;
    const commitSha = await this.createCommit(message, treeSha, headSha);
    await this.updateRef(branch, commitSha);

    return { dryRun: false, branch, commitSha, upserted: 2, deleted: 0, treeEntries };
  }
}

import { GitHubAuthService } from './GitHubAuthService';

export const GitHubThemePublisher = new GitHubThemePublisherClass(() => GitHubAuthService.getToken());
export { GitHubThemePublisherClass };
