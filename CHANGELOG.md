# Changelog

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
