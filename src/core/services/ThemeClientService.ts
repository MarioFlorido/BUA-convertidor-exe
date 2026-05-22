/**
 * ThemeClientService — carga y gestión de temas de usuario en cliente
 *
 * Reemplaza completamente la interacción con el servidor Express.
 * El ZIP se descomprime en el navegador, se valida, se registra
 * en ThemeRegistry y se persiste en IndexedDB.
 */

import { unzipSync } from 'fflate';
import type { ThemeBundle } from './ThemeBundle';
import { ThemeRegistry } from './ThemeRegistry';
import { UserThemeProvider } from './UserThemeProvider';
import { validateThemeBundle, filterSystemFiles } from './ThemeValidator';

export class ThemeClientService {
  /**
   * Carga un ZIP de tema subido por el usuario.
   *
   * Pipeline:
   *  File → ArrayBuffer → unzipSync → validate → ThemeBundle
   *       → ThemeRegistry.register + UserThemeProvider.save
   *
   * @throws Error si el archivo no es ZIP válido o le faltan archivos requeridos
   */
  async loadThemeZip(file: File): Promise<ThemeBundle> {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      throw new Error('Solo se aceptan archivos ZIP');
    }

    const zipBuffer = await file.arrayBuffer();
    const raw = unzipSync(new Uint8Array(zipBuffer));
    const files = filterSystemFiles(raw);

    const validation = validateThemeBundle(files);
    if (!validation.valid) {
      throw new Error(`ZIP inválido: ${validation.errors.join(', ')}`);
    }

    const id = file.name.replace(/\.zip$/i, '');
    const bundle: ThemeBundle = {
      id,
      name: id.replace(/_/g, ' '),
      source: 'user',
      files,
      metadata: {
        name: id.replace(/_/g, ' '),
        language: 'es',
      },
    };

    ThemeRegistry.register(bundle);
    await UserThemeProvider.save(bundle, zipBuffer);

    return bundle;
  }

  /**
   * Elimina un tema de usuario del registry y de IndexedDB.
   * Los temas built-in no pueden eliminarse con este método.
   */
  async removeTheme(id: string): Promise<void> {
    const bundle = ThemeRegistry.get(id);
    if (bundle?.id === 'base') {
      throw new Error('El tema base no se puede eliminar');
    }
    ThemeRegistry.remove(id);
    await UserThemeProvider.remove(id);
  }

  /** Todos los temas disponibles (built-in + usuario) */
  getAllThemes(): ThemeBundle[] {
    return ThemeRegistry.getAll();
  }

  /** Solo temas de usuario */
  getUserThemes(): ThemeBundle[] {
    return ThemeRegistry.getAll().filter((t) => t.source === 'user');
  }
}

export const themeClientService = new ThemeClientService();
