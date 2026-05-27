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
  /**
   * Carga los temas predefinidos.
   *
   * FASE DE TESTEO: solo se carga el tema 'base'. Los demás ZIPs siguen
   * físicamente en public/ y en themes-config.json, pero no se registran.
   * Cuando termine la fase de pruebas, eliminar el filtro `id === 'base'`
   * para volver a cargar todos los temas oficiales.
   */
  async loadAll(): Promise<void> {
    const configEntries = await this.fetchThemesConfig();
    await Promise.allSettled(
      configEntries
        .filter((entry) => entry.id === 'base')
        .map((entry) => this.loadOne(entry)),
    );
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

      // Screenshot servido directamente desde public/ — no necesita conversión
      if (files['screenshot.png'] || files['screenshot.jpg']) {
        const ext = files['screenshot.png'] ? 'png' : 'jpg';
        metadata.screenshot = `${BASE_URL}themes/${entry.id}/screenshot.${ext}`;
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
