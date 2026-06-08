/**
 * UserThemeProvider — persistencia de temas de usuario via IndexedDB
 *
 * Los temas subidos por el usuario se guardan en IndexedDB para
 * sobrevivir recargas de página. No usa backend ni filesystem.
 *
 * Usa la librería `idb` para una API basada en Promises.
 */

import { openDB, deleteDB, type IDBPDatabase } from 'idb';
import { unzipSync } from 'fflate';
import type { ThemeBundle } from './ThemeBundle';
import { ThemeRegistry } from './ThemeRegistry';
import { validateThemeBundle, filterSystemFiles } from './ThemeValidator';
import { screenshotToObjectUrl } from './themeConfigParser';

const DB_NAME = 'bua-themes';
const STORE_NAME = 'user-themes';
const DB_VERSION = 2;
// Nota: en v2 había además un store 'deleted-builtins' para marcar built-ins
// secundarios como eliminados. Ya no se usa (en testeo solo existe 'base',
// y en producción los oficiales se gestionan vía repo Git). Si la BD lo
// contiene, se ignora — no causa problemas.

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
  private generatedObjectUrls: string[] = [];

  /** Inicializa IndexedDB. Debe llamarse durante el boot. */
  async init(): Promise<void> {
    const openWithUpgrade = () =>
      openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
          console.log(`[UserThemeProvider] upgrade ${oldVersion} → ${DB_VERSION}`);
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        },
        blocked() {
          console.warn('[UserThemeProvider] Migración bloqueada — cierra otras pestañas con la app abierta');
        },
        blocking() {
          console.warn('[UserThemeProvider] Otra pestaña inició migración — cerrando conexión local');
        },
      });

    const db = await openWithUpgrade();

    // Verificación post-apertura: si falta el store (BD corrupta), resetear.
    const missing = [STORE_NAME].filter((s) => !db.objectStoreNames.contains(s));
    if (missing.length > 0) {
      console.warn(`[UserThemeProvider] Stores faltantes: ${missing.join(', ')} — reseteando BD`);
      db.close();
      await deleteDB(DB_NAME);
      this.db = await openWithUpgrade();
    } else {
      this.db = db;
    }
  }

  /** True si el store con el nombre dado existe en la conexión actual */
  private hasStore(name: string): boolean {
    return !!this.db && this.db.objectStoreNames.contains(name);
  }

  /**
   * Carga todos los temas de usuario desde IndexedDB y los registra en ThemeRegistry.
   * Los temas corruptos se ignoran silenciosamente.
   *
   * NOTA: Revoca Object URLs anteriores antes de crear nuevos para evitar memory leaks.
   */
  async loadAll(): Promise<ThemeBundle[]> {
    if (!this.db) return [];
    if (!this.hasStore(STORE_NAME)) return [];

    // Revocar Object URLs anteriores para liberar memoria
    this.revokeGeneratedUrls();

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

        const screenshotUrl = screenshotToObjectUrl(files);
        if (screenshotUrl) {
          this.generatedObjectUrls.push(screenshotUrl);
        }

        const bundle: ThemeBundle = {
          id: record.id,
          name: record.name,
          source: 'user',
          files,
          // El Object URL de la sesión anterior ya no es válido — regenerar
          metadata: { ...record.metadata, screenshot: screenshotUrl },
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
    if (!this.db || !this.hasStore(STORE_NAME)) throw new Error('UserThemeProvider no inicializado');

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
    if (!this.db || !this.hasStore(STORE_NAME)) throw new Error('UserThemeProvider no inicializado');
    await this.db.delete(STORE_NAME, id);
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
        console.debug('[UserThemeProvider] No se pudo revocar URL:', url, err);
      }
    }
    this.generatedObjectUrls = [];
  }

}

export const UserThemeProvider = new UserThemeProviderClass();
