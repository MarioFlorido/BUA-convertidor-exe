/**
 * BuiltInThemeProvider — catálogo de temas predefinidos desde public/
 *
 * Los temas built-in son parte de la aplicación, no plugins externos.
 * No usan IndexedDB ni upload.
 *
 * SOLO REGISTRA METADATOS, NO DESCARGA LOS ZIP. Todo lo que la interfaz
 * necesita para listar y elegir un estilo (nombre, actividad, idioma,
 * descripción, miniatura) está en `themes-config.json`, que pesa 4 KB. Los ZIP
 * suman ~23 MB y solo hacen falta al generar el ELPX o el PDF: los descargan
 * bajo demanda `ThemeService.loadTheme` y `PrintThemeLoader`, que ya saben
 * hacerlo cuando el bundle del registry viene sin ficheros (y luego lo cachean).
 *
 * La miniatura sale de `public/themes/<id>/screenshot.png`, que se sirve como
 * archivo estático y con `loading="lazy"`: solo baja la de los estilos que el
 * usuario llega a ver.
 *
 * BASE_URL se encapsula aquí completamente, compatible con GitHub Pages.
 */

import type { ThemeBundle, ThemeMetadata } from './ThemeBundle';
import { ThemeRegistry } from './ThemeRegistry';

const BASE_URL = import.meta.env.BASE_URL ?? '/';

interface ThemesConfigEntry {
  id: string;
  name: string;
  activity?: string;
  language?: string;
  description?: string;
  screenshot?: string | null;
  updatedAt?: string;
}

class BuiltInThemeProviderClass {
  /**
   * Registra en el registry todos los temas declarados en themes-config.json.
   * Una sola petición de 4 KB; los ZIP no se tocan.
   */
  async loadAll(): Promise<void> {
    const configEntries = await this.fetchThemesConfig();
    for (const entry of configEntries) this.registerOne(entry);
  }

  private async fetchThemesConfig(): Promise<ThemesConfigEntry[]> {
    try {
      const url = `${BASE_URL}themes-config.json`;
      // Revalidar siempre el catálogo: es pequeño y debe reflejar la última
      // publicación (incluido el `updatedAt` que versiona los .zip de los temas).
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) {
        console.warn(`[BuiltInThemeProvider] No se pudo cargar ${url}`);
        return [];
      }
      const data = await response.json();
      return data.themes ?? [];
    } catch (err) {
      console.warn('[BuiltInThemeProvider] Error cargando themes-config.json:', err);
      return [];
    }
  }

  /**
   * Registra un tema del catálogo con `files: {}`.
   *
   * El ZIP se descarga la primera vez que el tema se usa de verdad (exportar
   * ELPX o PDF). `updatedAt` viaja en los metadatos para que quien lo descargue
   * pueda versionar la URL y no comerse una copia vieja de la caché.
   */
  private registerOne(entry: ThemesConfigEntry): void {
    const metadata: ThemeMetadata = {
      name: entry.name,
      activity: entry.activity,
      language: entry.language,
      description: entry.description,
      // Los temas oficiales publican su miniatura como archivo estático. Si un
      // tema no la tuviera, ThemeSelector oculta la imagen rota.
      screenshot: entry.screenshot ?? (entry.id === 'base' ? null : `${BASE_URL}themes/${entry.id}/screenshot.png`),
      updatedAt: entry.updatedAt,
    };

    const bundle: ThemeBundle = {
      id: entry.id,
      name: entry.name,
      source: 'builtin',
      // El tema "base" tampoco tiene ZIP propio: usa base.elpx como plantilla.
      files: {},
      metadata,
    };

    ThemeRegistry.register(bundle);
  }
}

export const BuiltInThemeProvider = new BuiltInThemeProviderClass();
