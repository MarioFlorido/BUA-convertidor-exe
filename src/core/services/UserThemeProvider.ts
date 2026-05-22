/**
 * UserThemeProvider — persistencia de temas de usuario via IndexedDB
 *
 * Los temas subidos por el usuario se guardan en IndexedDB para
 * sobrevivir recargas de página. No usa backend ni filesystem.
 *
 * Usa la librería `idb` para una API basada en Promises.
 */

import { openDB, type IDBPDatabase } from 'idb';
import { unzipSync } from 'fflate';
import type { ThemeBundle } from './ThemeBundle';
import { ThemeRegistry } from './ThemeRegistry';
import { validateThemeBundle, filterSystemFiles } from './ThemeValidator';

const DB_NAME = 'bua-themes';
const STORE_NAME = 'user-themes';
const DB_VERSION = 1;

/** Estructura almacenada en IndexedDB (sin los Uint8Array, que no serializan bien como objetos planos) */
interface StoredTheme {
  id: string;
  name: string;
  /** ZIP original como ArrayBuffer para poder re-deserializar */
  zipBuffer: ArrayBuffer;
  metadata: ThemeBundle['metadata'];
}

class UserThemeProviderClass {
  private db: IDBPDatabase | null = null;

  /** Inicializa IndexedDB. Debe llamarse durante el boot. */
  async init(): Promise<void> {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }

  /**
   * Carga todos los temas de usuario desde IndexedDB y los registra en ThemeRegistry.
   * Los temas corruptos se ignoran silenciosamente.
   */
  async loadAll(): Promise<ThemeBundle[]> {
    if (!this.db) return [];

    const stored: StoredTheme[] = await this.db.getAll(STORE_NAME);
    const bundles: ThemeBundle[] = [];

    for (const record of stored) {
      try {
        const raw = unzipSync(new Uint8Array(record.zipBuffer));
        const files = filterSystemFiles(raw);
        const validation = validateThemeBundle(files);

        if (!validation.valid) {
          console.warn(
            `[UserThemeProvider] Tema "${record.id}" inválido en IndexedDB:`,
            validation.errors
          );
          continue;
        }

        const bundle: ThemeBundle = {
          id: record.id,
          name: record.name,
          source: 'user',
          files,
          metadata: record.metadata,
        };

        ThemeRegistry.register(bundle);
        bundles.push(bundle);
      } catch (err) {
        console.warn(
          `[UserThemeProvider] Error cargando tema "${record.id}" desde IndexedDB:`,
          err
        );
      }
    }

    return bundles;
  }

  /** Guarda un tema de usuario en IndexedDB (como ZIP para reutilizar en el descompresor) */
  async save(bundle: ThemeBundle, zipBuffer: ArrayBuffer): Promise<void> {
    if (!this.db) throw new Error('UserThemeProvider no inicializado');

    const record: StoredTheme = {
      id: bundle.id,
      name: bundle.name,
      zipBuffer,
      metadata: bundle.metadata,
    };

    await this.db.put(STORE_NAME, record);
  }

  /** Elimina un tema de usuario de IndexedDB */
  async remove(id: string): Promise<void> {
    if (!this.db) throw new Error('UserThemeProvider no inicializado');
    await this.db.delete(STORE_NAME, id);
  }
}

export const UserThemeProvider = new UserThemeProviderClass();
