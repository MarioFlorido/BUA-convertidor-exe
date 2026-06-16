# Changelog

## v0.3.0 — Junio 2026

### PDF — motor y rendimiento
- **Paged.js embebido** (dep `pagedjs@0.4.3`, importado como `?raw`): el motor de paginación ya **no** se descarga de un CDN. El PDF se genera 100% offline. El polyfill va en su propio chunk lazy (carga diferida desde `DownloadButton`).
- **Optimización automática de imágenes** antes de generar el PDF (`optimizeImagesForPrint.ts`): redimensionado (máx. 1600×2200) y recompresión (JPEG 0.82; PNG si hay transparencia). Nunca empeora el original. Reduce el peso del PDF y acelera la paginación.

### PDF — maquetación
- Portada a una página exacta (`297mm`) sin página en blanco.
- Índice con puntos líderes + número de página (técnica flex, porque Paged.js 0.4.3 no soporta `leader()`).
- `break-inside` ajustado: iDevices, tablas, cajas y acordeones pueden partir entre páginas (sin huecos); imágenes y figuras se mantienen unidas. Protecciones para cabeceras y filas.
- Títulos de página uniformes: todos los niveles (página / subpágina / 3er nivel) se renderizan igual (20 pt, página nueva), ya que todos provienen de un H1 en Word. La jerarquía se conserva en el índice.
- Tablas horizontal/vertical: cabecera con fondo gris y borde mostaza, distinguible del cuerpo.
- iDevice con título: al partir entre páginas no se dibujan bordes en el punto de corte.

### Administración de temas oficiales
- **Panel de administración integrado en la app** (`OfficialThemeAdmin.tsx`, en «Estilos eXeLearning»): crear, actualizar y eliminar temas oficiales sin Terminal, autenticando con un token fine-grained de GitHub. Núcleo en `src/core/services/admin/`. El flujo por CLI queda como _fallback_.

### Calidad
- Tests automatizados de `HtmlTransformer` (27 tests) con `node:test` vía `tsx` (`npm test`), sin dependencias nuevas.
- Consolidada `escapeHtml` en una única definición canónica (`src/core/utils/html.ts`).

### UX impresión
- Overlay «Preparando…» + barra con botón de impresión/guardado, fuera del DOM al imprimir para que no salgan en el PDF.

### UX — Ayuda contextual
- **Globo de ayuda por pantalla** (`WelcomeTour.tsx`): modal centrado con fondo
  oscurecido a pantalla completa (bloquea la interacción mientras está
  visible), uno por paso del asistente (subir / estructura / tema /
  resultado), con texto en varios párrafos independientes.
- **Switch «Ayuda» en la cabecera** (`AppHeader.tsx`): activado por defecto,
  preferencia persistida en `localStorage` (`bua-help-enabled`). Mientras está
  activo, el globo de cada pantalla reaparece en cada visita; el botón
  «Entendido» solo cierra esa visita concreta, no el conjunto.

---

## v0.2.0 — Mayo 2026

### Arquitectura
- Eliminado backend Express/Multer completamente
- Sistema de temas migrado a 100% client-side
- Introducido ThemeRegistry como fuente de verdad única
- Añadido ThemeClientService: carga ZIPs en navegador con fflate
- Añadido UserThemeProvider: persistencia de temas en IndexedDB
- Añadido BuiltInThemeProvider: carga temas predefinidos desde public/*.zip
- Boot sequence determinista en 10 fases (ThemeBoot.ts) antes de montar React
- ThemeService y PrintThemeLoader consultan ThemeRegistry antes de hacer fetch

### Despliegue
- Compatible con GitHub Pages (arquitectura 100% estática)
- Añadido GitHub Actions para CI/CD automático en push a main
- Añadido script `npm run deploy` (gh-pages)
- vite.config.ts: base path `/BUA-convertidor-exe/`

### Gestión de temas
- Solo el tema `base` es intocable; los temas institucionales son eliminables
- Subir un ZIP con el mismo ID reemplaza el tema existente (actualización de curso)
- Lista de temas unificada en ThemeManager

---

## v1.1 — Enero 2026

- Renderer HTML Print / PDF (Paged.js)
- Portada con imagen, logos BUA/UA y licencia CC multilingüe
- Índice con paginación automática via Paged.js
- Cabecera y pie de página con logos en PDF
- Metadatos ELPX: autoría BUA + licencia CC BY-NC-SA
- Detección de idioma del tema en 3 capas (CSS > ID > fallback)
- Opción H2 "Pestañas" en el configurador de estructura

---

## v1.0 — 2025

- Conversión DOCX → ELPX con SemanticDocument como modelo central
- Pipeline de 3 capas: Parser → SemanticDocument → Renderer
- Configurador de estructura H1/H2/H3 (iDevice / HTML / Acordeón)
- Sistema de temas ZIP con servidor Express
- Selector de tema visual con preview
