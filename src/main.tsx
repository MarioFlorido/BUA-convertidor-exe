import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.tsx';
import { bootThemeSystem } from './core/boot/ThemeBoot.ts';

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
