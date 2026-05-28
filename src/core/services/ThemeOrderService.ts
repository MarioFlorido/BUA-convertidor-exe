/**
 * ThemeOrderService — orden de los temas elegido por el usuario
 *
 * El orden vive en localStorage como un array de IDs. La fuente de verdad
 * de los temas (cuáles existen) sigue siendo ThemeRegistry; este servicio
 * solo dice "en qué orden mostrarlos".
 *
 * Persistencia: localStorage (es liviana, suficiente para una lista de IDs,
 * y per-navegador como el resto del estado de usuario).
 */

const STORAGE_KEY = 'bua-theme-order';

class ThemeOrderServiceClass {
  private order: string[] = [];

  /** Lee el orden persistido. Llamar una vez en el boot. */
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        this.order = parsed;
      }
    } catch {
      // localStorage no disponible o JSON corrupto — orden por defecto
      this.order = [];
    }
  }

  /** Guarda un nuevo orden. */
  save(ids: string[]): void {
    this.order = ids.slice();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.order));
    } catch {
      // localStorage lleno o deshabilitado — sigue funcionando en memoria
    }
  }

  /**
   * Ordena una lista de temas según el orden guardado.
   * Los temas que no están en el orden guardado se añaden al final,
   * conservando su orden original (FIFO de "recién aparecidos").
   */
  applyOrder<T extends { id: string }>(themes: T[]): T[] {
    if (this.order.length === 0) return themes;
    const indexOf = new Map(this.order.map((id, i) => [id, i]));
    return [...themes].sort((a, b) => {
      const aIdx = indexOf.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bIdx = indexOf.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aIdx - bIdx;
    });
  }
}

export const ThemeOrderService = new ThemeOrderServiceClass();
