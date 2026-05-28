/**
 * ThemeBoot — secuencia de arranque determinista del sistema de temas
 *
 * 10 fases según la especificación de arquitectura:
 *
 * FASE 1  — Instancias singleton (ya existen, son módulos ES)
 * FASE 2  — BASE_URL resuelto en BuiltInThemeProvider
 * FASE 3  — Carga temas built-in (public/*.zip)
 * FASE 4  — Inicializa IndexedDB + carga temas de usuario
 * FASE 5  — Merge en ThemeRegistry (ya ocurre al registrar)
 * FASE 6  — Validación global del registry
 * FASE 7  — Selección de tema activo
 * FASE 8  — Pipeline de renderers listo (ya está, no requiere init)
 * FASE 9  — Inyección inicial de CSS
 * FASE 10 — UI habilitada (la gestiona el caller en main.tsx)
 *
 * Garantía: al resolverse la Promise, ThemeRegistry tiene al menos
 * un tema válido y la UI puede renderizarse de forma segura.
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

export async function bootThemeSystem(): Promise<BootResult> {
  const errors: string[] = [];

  // Orden personalizado de temas elegido por el usuario (localStorage)
  ThemeOrderService.load();

  // FASE 3a — Inicializar IndexedDB primero (necesario para que built-ins
  // puedan consultar la lista de built-ins marcados como eliminados)
  try {
    await UserThemeProvider.init();
  } catch (err) {
    const msg = `Error inicializando IndexedDB: ${err instanceof Error ? err.message : err}`;
    console.warn('[ThemeBoot]', msg);
    errors.push(msg);
  }

  // FASE 3b — Temas built-in (omite los marcados como eliminados)
  try {
    await BuiltInThemeProvider.loadAll();
  } catch (err) {
    const msg = `Error cargando temas built-in: ${err instanceof Error ? err.message : err}`;
    console.error('[ThemeBoot]', msg);
    errors.push(msg);
  }

  // FASE 4 — Temas de usuario desde IndexedDB
  try {
    await UserThemeProvider.loadAll();
  } catch (err) {
    const msg = `Error cargando temas de usuario: ${err instanceof Error ? err.message : err}`;
    console.warn('[ThemeBoot]', msg);
    errors.push(msg);
  }

  // FASE 6 — Validación global: debe existir al menos un tema
  if (ThemeRegistry.size === 0) {
    // Hard fallback: registrar tema base vacío para no bloquear la UI
    ThemeRegistry.register({
      id: 'base',
      name: 'Base eXeLearning',
      source: 'builtin',
      files: {},
      metadata: { name: 'Base eXeLearning' },
    });
    errors.push('No se cargó ningún tema; usando fallback base.');
  }

  // FASE 7 — Selección del tema activo
  const activeTheme =
    ThemeRegistry.get('base') ?? ThemeRegistry.getAll()[0];
  const activeThemeId = activeTheme?.id ?? 'base';

  // FASE 9 — Inyección de CSS del tema activo
  if (activeTheme && activeTheme.files['style.css']) {
    const css = new TextDecoder().decode(activeTheme.files['style.css']);
    ThemeCssManager.apply(css);
  }

  return {
    activeThemeId,
    themeCount: ThemeRegistry.size,
    errors,
  };
}
