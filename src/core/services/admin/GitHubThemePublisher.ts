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

function base64ToString(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

class GitHubThemePublisherClass {
  constructor(private getToken: () => string | null) {}

  private headers(): Record<string, string> {
    const token = this.getToken();
    if (!token) throw new Error('No hay sesión de administración activa.');
    return githubHeaders(token);
  }

  private async api<T>(pathSuffix: string, init?: RequestInit): Promise<T> {
    const resp = await fetch(repoApiUrl(pathSuffix), {
      ...init,
      headers: { ...this.headers(), ...(init?.headers ?? {}) },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`GitHub API ${resp.status} en ${pathSuffix}: ${body.slice(0, 200)}`);
    }
    return resp.json() as Promise<T>;
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

  /** Lee el catálogo actual de la rama. Devuelve el objeto parseado. */
  private async fetchThemesConfig(branch: string): Promise<ThemesConfig> {
    const data = await this.api<{ content: string }>(
      `/contents/${THEMES_CONFIG_PATH}?ref=${branch}`,
    );
    return JSON.parse(base64ToString(data.content)) as ThemesConfig;
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
    await this.api(`/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commitSha, force: false }),
    });
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
    const newConfig = upsertThemeEntry(config, input);
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

    // Crear blobs de cada archivo del tema
    const upsertBlobs: Record<string, string> = {};
    for (const [relPath, bytes] of Object.entries(files)) {
      upsertBlobs[relPath] = await this.createBlob(bytes);
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
}

import { GitHubAuthService } from './GitHubAuthService';

export const GitHubThemePublisher = new GitHubThemePublisherClass(() => GitHubAuthService.getToken());
export { GitHubThemePublisherClass };
