/**
 * ThemeRegistry — fuente de verdad única del sistema de temas
 *
 * Singleton que agrega temas built-in y de usuario.
 * Todos los renderers y componentes consultan aquí.
 * Nunca acceden directamente a public/, fetch o IndexedDB.
 */

import type { ThemeBundle } from './ThemeBundle';

class ThemeRegistryClass {
  private themes = new Map<string, ThemeBundle>();

  /** Registra (o sobreescribe) un tema en el registry */
  register(bundle: ThemeBundle): void {
    this.themes.set(bundle.id, bundle);
  }

  /** Obtiene un tema por ID. undefined si no existe. */
  get(id: string): ThemeBundle | undefined {
    return this.themes.get(id);
  }

  /** Todos los temas registrados, built-ins primero */
  getAll(): ThemeBundle[] {
    const builtin = Array.from(this.themes.values()).filter(
      (t) => t.source === 'builtin'
    );
    const user = Array.from(this.themes.values()).filter(
      (t) => t.source === 'user'
    );
    return [...builtin, ...user];
  }

  /** Elimina un tema del registry (solo temas de usuario) */
  remove(id: string): void {
    this.themes.delete(id);
  }

  has(id: string): boolean {
    return this.themes.has(id);
  }

  get size(): number {
    return this.themes.size;
  }
}

export const ThemeRegistry = new ThemeRegistryClass();
