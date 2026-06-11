import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.tsx';
import { bootThemeSystem } from './core/boot/ThemeBoot.ts';

// ── Auto-recuperación tras un despliegue nuevo ──────────────────────────────
// Al publicar una versión nueva, los chunks con hash antiguo desaparecen del
// servidor. Si alguien tenía la pestaña abierta, un import dinámico (p. ej. el
// renderer de PDF) falla con "error loading dynamically imported module". Vite
// emite `vite:preloadError` en ese caso: recargamos para tomar la versión nueva
// en lugar de mostrar el error. Guarda anti-bucle: como mucho una recarga cada
// 10 s por esta causa (si tras recargar sigue fallando, hay un problema real y
// se deja ver el error sin recargar en bucle).
window.addEventListener('vite:preloadError', () => {
  const KEY = 'bua:last-preload-reload';
  const last = Number(sessionStorage.getItem(KEY) ?? '0');
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  }
});

const rootEl = document.getElementById('root')!;

// Indicador de carga mínimo durante el boot (antes de React)
rootEl.innerHTML =
  '<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:Arial,sans-serif;color:#666"><p>Cargando temas...</p></div>';

bootThemeSystem()
  .then((result) => {
    if (result.errors.length > 0) {
      console.warn('[Boot] Advertencias:', result.errors);
    }

    // FASE 10 — UI habilitada: ThemeRegistry tiene al menos un tema válido
    rootEl.innerHTML = '';
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  })
  .catch((err) => {
    // Error crítico irrecuperable
    rootEl.innerHTML = `
      <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;font-family:Arial,sans-serif;padding:2rem;text-align:center">
        <h2 style="color:#c62828">Error de inicio</h2>
        <p style="color:#666">${err instanceof Error ? err.message : 'Error desconocido'}</p>
        <button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1.5rem;cursor:pointer">
          Reintentar
        </button>
      </div>
    `;
  });
