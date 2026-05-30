import { unzipSync } from 'fflate';
import { ThemeRegistry } from './ThemeRegistry';

export interface TemplateData {
  entries: Record<string, Uint8Array>;
}

/**
 * ThemeService - Gestiona carga y caché de temas y plantillas eXeLearning
 *
 * Responsabilidades:
 * - Cargar plantilla base (base.elpx)
 * - Cargar temas personalizados (*.zip)
 * - Cachear temas para evitar recargas
 * - Prefixar entries de tema con "theme/"
 * - Filtrar archivos del sistema (__MACOSX, .DS_Store)
 */
export class ThemeService {
  private static readonly cache = new Map<string, Record<string, Uint8Array>>();
  private static templateCache: TemplateData | null = null;

  /**
   * Cargar plantilla base de eXeLearning
   * Cacheada en memoria para evitar fetch repetidos en la misma sesión.
   *
   * @returns TemplateData con entries descomprimidas de base.elpx
   * @throws Error si no se puede cargar o no contiene content.xml
   */
  static async loadTemplate(): Promise<TemplateData> {
    if (this.templateCache) {
      // Devolver copia para que el caller pueda mutar entries sin afectar la caché
      return { entries: { ...this.templateCache.entries } };
    }

    const baseUrl = import.meta.env.BASE_URL ?? '/';
    const url = `${baseUrl}base.elpx`;

    const entries = await this.fetchAndUnzip(url);

    if (!entries['content.xml']) {
      throw new Error('La plantilla base no contiene content.xml.');
    }

    this.templateCache = { entries };
    return { entries: { ...entries } };
  }

  /**
   * Cargar tema personalizado
   *
   * @param themeId ID del tema (ej: "miTema")
   * @returns Record con entries prefixadas con "theme/"
   * @throws Error si no se puede cargar
   *
   * Usa caché: la segunda vez que se pide el mismo tema, se devuelve cacheado.
   */
  static async loadTheme(themeId: string): Promise<Record<string, Uint8Array>> {
    // Verificar caché
    if (this.cache.has(themeId)) {
      return this.cache.get(themeId)!;
    }

    // Consultar ThemeRegistry primero (temas built-in pre-cargados + temas de usuario)
    const bundle = ThemeRegistry.get(themeId);
    if (bundle && Object.keys(bundle.files).length > 0) {
      const prefixedEntries = this.filterAndPrefixThemeEntries(bundle.files);
      this.cache.set(themeId, prefixedEntries);
      return prefixedEntries;
    }

    // Fallback: fetch desde URL (compatibilidad dev sin registry completo)
    const baseUrl = import.meta.env.BASE_URL ?? '/';
    const url = `${baseUrl}${themeId}.zip`;

    const rawEntries = await this.fetchAndUnzip(url);
    const prefixedEntries = this.filterAndPrefixThemeEntries(rawEntries);

    // Guardar en caché
    this.cache.set(themeId, prefixedEntries);

    return prefixedEntries;
  }

  /**
   * Cargar tema si es necesario (helper para lógica condicional)
   *
   * @param themeId ID del tema o undefined
   * @returns Record con entries prefixadas, o undefined si themeId es falsy o "base"
   */
  static async loadThemeIfNeeded(themeId?: string): Promise<Record<string, Uint8Array> | undefined> {
    if (themeId && themeId !== 'base') {
      return this.loadTheme(themeId);
    }
    return undefined;
  }

  /**
   * Limpiar caché (útil para testing o cambio de tema)
   */
  static clearCache(): void {
    this.cache.clear();
    this.templateCache = null;
  }

  /**
   * Helper privado: Fetch y descomprimir ZIP desde URL
   */
  private static async fetchAndUnzip(url: string): Promise<Record<string, Uint8Array>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`Tiempo de espera agotado al cargar: ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`No se ha podido cargar: ${url}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    return unzipSync(uint8Array);
  }

  /**
   * Helper privado: Prefixar entries de tema con "theme/" y filtrar archivos del sistema
   */
  private static filterAndPrefixThemeEntries(entries: Record<string, Uint8Array>): Record<string, Uint8Array> {
    const prefixedEntries: Record<string, Uint8Array> = {};

    for (const [path, data] of Object.entries(entries)) {
      // Filtrar archivos del sistema
      if (path === '__MACOSX' || path.startsWith('__MACOSX/') || path === '.DS_Store') {
        continue;
      }

      // Prefixar con "theme/" - esto reemplaza completamente el tema base
      // Cada ELPX contiene exactamente UN tema (el seleccionado)
      // El config.xml del tema contiene el ID/nombre del tema
      prefixedEntries[`theme/${path}`] = data;
    }

    return prefixedEntries;
  }
}
