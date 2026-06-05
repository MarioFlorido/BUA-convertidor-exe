/**
 * GitHubAuthService — gestión del token de administración (en runtime).
 *
 * El administrador aporta un fine-grained PAT (limitado a ESTE repo, con permiso
 * `Contents: Read and write`). El token NO se guarda en el repositorio ni se
 * versiona; vive solo en memoria durante la sesión, con opción de persistirlo en
 * `sessionStorage` (se borra al cerrar la pestaña) si el admin lo acepta.
 *
 * La autorización real la impone GitHub: si el token tiene permiso de escritura
 * sobre el repo, se puede publicar; si no, no. No hay lista de administradores
 * en cliente (sería trivial de saltar y no protege nada).
 */

import { repoApiUrl, githubHeaders, GITHUB_OWNER, GITHUB_REPO } from './githubRepo';

const STORAGE_KEY = 'bua-admin-gh-token';

/**
 * Nivel de persistencia del token:
 *  - `none`    → solo en memoria (se pierde al recargar).
 *  - `session` → sessionStorage (se borra al cerrar la pestaña).
 *  - `device`  → localStorage (persiste entre cierres del navegador en este equipo).
 */
export type TokenPersistence = 'none' | 'session' | 'device';

export interface AuthResult {
  ok: boolean;
  login?: string;
  /** El token tiene permiso de escritura (push) sobre el repo. */
  canWrite?: boolean;
  error?: string;
}

class GitHubAuthServiceClass {
  private token: string | null = null;

  /** Restaura el token persistido (localStorage tiene prioridad sobre sessionStorage). */
  restore(): void {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
      if (saved) this.token = saved;
    } catch {
      /* almacenamiento no disponible: se ignora */
    }
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  /**
   * Valida el token contra GitHub y comprueba permiso de escritura sobre el repo.
   * Si es válido, lo guarda en memoria y, según `persistence`, en session/localStorage.
   */
  async authenticate(token: string, persistence: TokenPersistence = 'none'): Promise<AuthResult> {
    const trimmed = token.trim();
    if (!trimmed) return { ok: false, error: 'Token vacío' };

    let repoResp: Response;
    try {
      repoResp = await fetch(repoApiUrl(''), { headers: githubHeaders(trimmed) });
    } catch (err) {
      return { ok: false, error: `Error de red: ${err instanceof Error ? err.message : err}` };
    }

    if (repoResp.status === 401) {
      return { ok: false, error: 'Token inválido o caducado.' };
    }
    if (repoResp.status === 404) {
      return {
        ok: false,
        error: `El token no tiene acceso a ${GITHUB_OWNER}/${GITHUB_REPO} (¿permisos del fine-grained PAT?).`,
      };
    }
    if (!repoResp.ok) {
      return { ok: false, error: `Respuesta inesperada de GitHub (${repoResp.status}).` };
    }

    const repo = await repoResp.json();
    const canWrite = Boolean(repo?.permissions?.push);
    if (!canWrite) {
      return {
        ok: false,
        canWrite: false,
        error: 'El token no tiene permiso de escritura (Contents: write) sobre el repositorio.',
      };
    }

    this.token = trimmed;
    try {
      // Limpia cualquier copia previa antes de escribir en el destino elegido
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
      if (persistence === 'session') sessionStorage.setItem(STORAGE_KEY, trimmed);
      else if (persistence === 'device') localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      /* almacenamiento no disponible: se ignora, queda en memoria */
    }

    return { ok: true, login: repo?.owner?.login, canWrite: true };
  }

  /** Borra el token de memoria y de ambos almacenamientos. */
  logout(): void {
    this.token = null;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export const GitHubAuthService = new GitHubAuthServiceClass();
