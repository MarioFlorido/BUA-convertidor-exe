/**
 * ThemeBoot — arranque del sistema de temas en dos tiempos
 *
 * ARRANQUE INMEDIATO (`bootEssential`) — síncrono, sin red:
 *   FASE 1 — Instancias singleton (ya existen, son módulos ES)
 *   FASE 2 — Orden de temas del usuario (localStorage)
 *   FASE 3 — Tema "base" registrado como fallback → el registry nunca está vacío
 *   La UI puede renderizarse ya. No espera a ningún ZIP.
 *
 * CATÁLOGO EN SEGUNDO PLANO (`loadThemeCatalog`) — asíncrono:
 *   FASE 4 — IndexedDB
 *   FASE 5 — Catálogo de temas built-in (themes-config.json, 4 KB)
 *   FASE 6 — Temas de usuario (IndexedDB)
 *   FASE 7 — Selección de tema activo + inyección de su CSS
 *
 * POR QUÉ EN DOS TIEMPOS: aunque el catálogo ya no descarga los ZIP (eso lo
 * hace `ThemeService` bajo demanda), sigue habiendo una petición de red y una
 * apertura de IndexedDB por delante. No hay razón para que la pantalla de
 * subida del DOCX espere a ninguna de las dos. Solo la pantalla de selección
 * de estilo necesita el catálogo, y consulta `getCatalogStatus()`.
 */

import { BuiltInThemeProvider } from '../services/BuiltInThemeProvider';
import { UserThemeProvider } from '../services/UserThemeProvider';
import { ThemeRegistry } from '../services/ThemeRegistry';
import { ThemeCssManager } from '../services/ThemeCssManager';
import { ThemeOrderService } from '../services/ThemeOrderService';

export interface BootResult {
  activeThemeId: string;
  themeCount: number;
  errors: string[];
}

/** Estado de la carga del catálogo de temas. */
export type CatalogStatus = 'pending' | 'loading' | 'ready';

let catalogStatus: CatalogStatus = 'pending';
let catalogPromise: Promise<BootResult> | null = null;

/** Estado actual de la carga del catálogo (para la UI). */
export function getCatalogStatus(): CatalogStatus {
  return catalogStatus;
}

function setCatalogStatus(status: CatalogStatus): void {
  catalogStatus = status;
  // Los suscriptores del registry son los mismos que necesitan saber si aún
  // quedan temas por llegar (p. ej. ThemeSelector, para no anunciar "no hay
  // estilos disponibles" cuando en realidad todavía se están cargando).
  ThemeRegistry.notify();
}

/**
 * Arranque mínimo, sin red ni IndexedDB. Al volver, la UI puede renderizarse:
 * el registry tiene al menos el tema base.
 */
export function bootEssential(): void {
  // Orden personalizado de temas elegido por el usuario (localStorage)
  ThemeOrderService.load();

  // Fallback base: garantiza registry no vacío antes de cualquier carga.
  // `loadThemeCatalog` lo sobreescribe con los metadatos de themes-config.json.
  if (!ThemeRegistry.has('base')) {
    ThemeRegistry.register({
      id: 'base',
      name: 'Base eXeLearning',
      source: 'builtin',
      files: {},
      metadata: { name: 'Base eXeLearning' },
    });
  }
}

/**
 * Carga el catálogo completo de temas (built-in + usuario) en segundo plano.
 *
 * Idempotente: llamadas concurrentes comparten la misma promesa. Los fallos
 * individuales no rompen el arranque; se devuelven en `errors`.
 */
export function loadThemeCatalog(): Promise<BootResult> {
  if (catalogPromise) return catalogPromise;
  catalogPromise = runCatalogLoad();
  return catalogPromise;
}

async function runCatalogLoad(): Promise<BootResult> {
  const errors: string[] = [];
  setCatalogStatus('loading');

  // FASE 4 — Inicializar IndexedDB (temas locales del usuario)
  try {
    await UserThemeProvider.init();
  } catch (err) {
    const msg = `Error inicializando IndexedDB: ${err instanceof Error ? err.message : err}`;
    console.warn('[ThemeBoot]', msg);
    errors.push(msg);
  }

  // FASE 5 — Catálogo de temas built-in (solo metadatos; los ZIP van aparte)
  try {
    await BuiltInThemeProvider.loadAll();
  } catch (err) {
    const msg = `Error cargando temas built-in: ${err instanceof Error ? err.message : err}`;
    console.error('[ThemeBoot]', msg);
    errors.push(msg);
  }

  // FASE 6 — Temas de usuario desde IndexedDB
  try {
    await UserThemeProvider.loadAll();
  } catch (err) {
    const msg = `Error cargando temas de usuario: ${err instanceof Error ? err.message : err}`;
    console.warn('[ThemeBoot]', msg);
    errors.push(msg);
  }

  if (ThemeRegistry.size === 0) {
    // No debería ocurrir (bootEssential registra el base), pero si alguien
    // vacía el registry entre medias, la UI no puede quedarse sin temas.
    bootEssential();
    errors.push('No se cargó ningún tema; usando fallback base.');
  }

  // FASE 7 — Tema activo + inyección de su CSS
  const activeTheme = ThemeRegistry.get('base') ?? ThemeRegistry.getAll()[0];
  const activeThemeId = activeTheme?.id ?? 'base';

  if (activeTheme && activeTheme.files['style.css']) {
    const css = new TextDecoder().decode(activeTheme.files['style.css']);
    ThemeCssManager.apply(css);
  }

  setCatalogStatus('ready');

  return {
    activeThemeId,
    themeCount: ThemeRegistry.size,
    errors,
  };
}
