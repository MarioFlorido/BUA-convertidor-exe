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
  private listeners = new Set<() => void>();

  /**
   * Suscribe un listener a los cambios del registry.
   *
   * Los temas se cargan en segundo plano (ver ThemeBoot), así que un componente
   * montado antes de que termine la carga debe repintarse cuando lleguen.
   *
   * @returns función para cancelar la suscripción
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Avisa a los suscriptores. La llaman `register`/`remove` y también el boot
   * cuando cambia el estado de carga del catálogo (la lista puede no variar,
   * pero la UI sí necesita saber que ya no quedan temas por llegar).
   */
  notify(): void {
    for (const listener of this.listeners) listener();
  }

  /** Registra (o sobreescribe) un tema en el registry */
  register(bundle: ThemeBundle): void {
    this.themes.set(bundle.id, bundle);
    this.notify();
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
    this.notify();
  }

  has(id: string): boolean {
    return this.themes.has(id);
  }

  get size(): number {
    return this.themes.size;
  }
}

export const ThemeRegistry = new ThemeRegistryClass();
