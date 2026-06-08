/**
 * BuiltInThemeProvider — carga de temas predefinidos desde public/
 *
 * Los temas built-in son parte de la aplicación, no plugins externos.
 * Se cargan desde archivos ZIP estáticos en public/ via fetch.
 * No usan IndexedDB ni upload.
 *
 * BASE_URL se encapsula aquí completamente, compatible con GitHub Pages.
 */

import { unzipSync } from 'fflate';
import type { ThemeBundle, ThemeMetadata } from './ThemeBundle';
import { ThemeRegistry } from './ThemeRegistry';
import { validateThemeBundle, filterSystemFiles } from './ThemeValidator';
import { extractLanguageFromConfigXml } from './themeConfigParser';

const BASE_URL = import.meta.env.BASE_URL ?? '/';

interface ThemesConfigEntry {
  id: string;
  name: string;
  activity?: string;
  language?: string;
  description?: string;
  screenshot?: string | null;
}

class BuiltInThemeProviderClass {
  private generatedObjectUrls: string[] = [];

  /**
   * Carga todos los temas predefinidos declarados en themes-config.json.
   * Los fallos individuales no bloquean el boot.
   *
   * NOTA: Revoca Object URLs anteriores antes de crear nuevos para evitar memory leaks.
   */
  async loadAll(): Promise<void> {
    // Revocar Object URLs anteriores para liberar memoria
    this.revokeGeneratedUrls();

    const configEntries = await this.fetchThemesConfig();
    await Promise.allSettled(configEntries.map((entry) => this.loadOne(entry)));
  }

  private async fetchThemesConfig(): Promise<ThemesConfigEntry[]> {
    try {
      const url = `${BASE_URL}themes-config.json`;
      const response = await fetch(url);
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
   * Genera un Object URL para la screenshot si existe en los archivos del tema.
   */
  private generateScreenshotUrl(files: Record<string, Uint8Array>): string | undefined {
    const screenshotBuffer = files['screenshot.png'] || files['screenshot.jpg'];
    if (!screenshotBuffer) return undefined;

    try {
      // Convertir Uint8Array a un Blob directamente
      const type = files['screenshot.png'] ? 'image/png' : 'image/jpeg';
      const blob = new Blob([new Uint8Array(screenshotBuffer)], { type });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.warn('[BuiltInThemeProvider] Error generando Object URL para screenshot:', err);
      return undefined;
    }
  }

  /**
   * Revoca todos los Object URLs generados para liberar memoria.
   * Se llama automáticamente en loadAll() antes de crear nuevas URLs.
   */
  private revokeGeneratedUrls(): void {
    for (const url of this.generatedObjectUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (err) {
        // Algunos navegadores pueden lanzar error si la URL ya no es válida
        console.debug('[BuiltInThemeProvider] No se pudo revocar URL:', url, err);
      }
    }
    this.generatedObjectUrls = [];
  }

  private async loadOne(entry: ThemesConfigEntry): Promise<void> {
    const metadata: ThemeMetadata = {
      name: entry.name,
      activity: entry.activity,
      language: entry.language,
      description: entry.description,
      screenshot: entry.screenshot,
    };

    // El tema "base" no tiene ZIP propio — usa base.elpx como plantilla.
    // Solo lo registramos en el registry para que aparezca en ThemeSelector.
    if (entry.id === 'base') {
      ThemeRegistry.register({
        id: 'base',
        name: entry.name,
        source: 'builtin',
        files: {},
        metadata,
      });
      return;
    }

    try {
      const url = `${BASE_URL}${entry.id}.zip`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[BuiltInThemeProvider] No se pudo cargar ${url}`);
        return;
      }

      const buffer = await response.arrayBuffer();
      const raw = unzipSync(new Uint8Array(buffer));
      const files = filterSystemFiles(raw);

      const validation = validateThemeBundle(files);
      if (!validation.valid) {
        console.warn(
          `[BuiltInThemeProvider] Tema "${entry.id}" inválido:`,
          validation.errors
        );
        return;
      }

      // El <language> del config.xml tiene prioridad sobre themes-config.json
      const langFromConfig = extractLanguageFromConfigXml(files);
      if (langFromConfig) {
        metadata.language = langFromConfig;
      }

      // Screenshot: preferir URL estática desde public/
      if (files['screenshot.png'] || files['screenshot.jpg']) {
        const ext = files['screenshot.png'] ? 'png' : 'jpg';
        metadata.screenshot = `${BASE_URL}themes/${entry.id}/screenshot.${ext}`;
      } else {
        // Fallback: generar Object URL si no existe screenshot estático
        const screenshotUrl = this.generateScreenshotUrl(files);
        if (screenshotUrl) {
          metadata.screenshot = screenshotUrl;
          this.generatedObjectUrls.push(screenshotUrl);
        }
      }

      const bundle: ThemeBundle = {
        id: entry.id,
        name: entry.name,
        source: 'builtin',
        files,
        metadata,
      };

      ThemeRegistry.register(bundle);
    } catch (err) {
      console.warn(`[BuiltInThemeProvider] Error cargando "${entry.id}":`, err);
    }
  }
}

export const BuiltInThemeProvider = new BuiltInThemeProviderClass();
