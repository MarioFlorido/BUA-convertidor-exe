import React from 'react';
import ReactDOM from 'react-dom/client';
// Inter auto-alojada (sin CDN): Vite la empaqueta → la app funciona offline.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import { App } from './App.tsx';
import { bootEssential, loadThemeCatalog } from './core/boot/ThemeBoot.ts';

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

try {
  // Arranque mínimo (sin red): deja el registry con el tema base y la UI lista.
  bootEssential();

  rootEl.innerHTML = '';
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // El catálogo de temas se carga DESPUÉS de pintar, sin bloquear al usuario:
  // puede subir su DOCX y configurar la estructura mientras llega.
  // ThemeSelector se repinta solo al registrarse cada tema.
  loadThemeCatalog().then((result) => {
    if (result.errors.length > 0) {
      console.warn('[Boot] Advertencias:', result.errors);
    }
  });
} catch (err) {
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
}
