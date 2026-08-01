# Inventario exhaustivo del repositorio — BUA ConvertidoreXe

> Generado el 2026-06-08 mediante análisis de solo lectura del repositorio local
> sincronizado con `origin` (todas las ramas y tags fetched). **Documento local,
> NO versionado.**

---

## 1. Identidad y remotos

| Dato | Valor |
|------|-------|
| Remoto | `origin` → `git@github.com:MarioFlorido/BUA-convertidor-exe.git` |
| Rama por defecto | `main` (`origin/HEAD → origin/main`) |
| HEAD local | `5d313a2` (sincronizado con `origin/main`) |
| Rango temporal | 2026-05-10 (`f89b300` Initial commit) → 2026-06-08 |
| Commits totales (todas las ramas) | **331** |
| Autor único | Mario Florido (4 identidades git distintas, ver §7) |

### Salud del repositorio ⚠️
- **`.git` pesa 279 MB**; working tree completo 515 MB.
- El historial está **inflado por ZIPs de temas** (`PhD_26-27.zip` y similares, ~3,5 MB cada uno) commiteados decenas de veces antes de moverse a `.gitignore` (`public/*.zip`). Son los 15 blobs más grandes del historial, todos el mismo tipo de artefacto.
- Limpiar esto requeriría reescritura de historial (`git filter-repo`/BFG) — **decisión a tomar contigo**, no lo he hecho.

---

## 2. Ramas

| Rama | Commits | Estado |
|------|---------|--------|
| `origin/main` | 190 | Rama activa de desarrollo |
| `origin/admin-themes-test` | 168 | **Totalmente fusionada en main** (no tiene nada exclusivo; main va 21 commits por delante). Rama de pruebas del panel admin, ya superada → candidata a borrado. |
| `origin/gh-pages` | 141 | Artefacto de despliegue (CI). 397 archivos (build de `dist/`). No editar a mano. |
| `admin-themes-test` (local) | — | En `0a09254`, desactualizada respecto a su remota. |

---

## 3. Inventario del árbol actual (`main`) — 463 archivos tracked

### Por extensión
| Ext | Nº | Notas |
|-----|----|-------|
| png | 286 | Casi todo, assets de temas |
| woff2 | 48 | Fuentes de temas |
| **ts** | **48** | **Lógica del proyecto** |
| **tsx** | **10** | **Componentes React** |
| css | 10 | Estilos (1 global + 8 de temas + 1 print) |
| xml | 8 | `config.xml` de cada tema |
| js | 8 | `style.js` de temas |
| jpg | 8 | Imágenes de temas |
| html | 8 | 7 docs + `index.html` |
| gif | 8 | Assets de temas |
| json | 7 | config, package, checksums |
| docx | 5 | Fixtures de test |
| md | 4 | README, CHANGELOG, FASE-3, REGRESSION |
| Otros | yml, sh, elpx, LICENSE, gitignore | |

### Por zona
| Zona | Nº | Contenido |
|------|----|-----------|
| `public/themes/` | 368 | 8 temas × 46 archivos (assets) |
| `src/core/` | 40 | Núcleo de la lógica |
| `src/components/` | 8 | UI React |
| `public/` (raíz) | 8 | base.elpx, themes-config, iconos |
| `public/docs/` | 7 | Documentación de usuario (HTML) |
| `tests/` | 10 | Fixtures + scripts de regresión |
| `scripts/` | 4 | Utilidades de build/temas |
| raíz | 10 | Config + README/CHANGELOG + LICENSE |

---

## 4. Código fuente (`src/`) — mapa completo

### Entrada / orquestación
- `src/main.tsx` — bootstrap React
- `src/App.tsx` — orquestador del wizard (upload → structure → theme → result)
- `src/types/index.ts` — tipos compartidos (⚠️ define `DocumentStructure`, duplicada con el modelo)
- `src/styles/globals.css` — 44 KB, estilos globales de la app

### Componentes (`src/components/`)
`AppHeader` · `UploadZone` · `StructureConfigurator` · `ThemeSelector` · `ThemeManager` · `OfficialThemeAdmin` · `DownloadButton` · `StepIndicator`

### Núcleo (`src/core/`)
**Pipeline de conversión:**
- `parsers/DocxParser.ts` — Mammoth.js (DOCX→HTML)
- `transformers/HtmlTransformer.ts` (+ `.test.ts`) — transformaciones HTML (cajas, tablas, iframes, links)
- `transformers/ImageExtractor.ts`
- `parseStructure.ts` — detecta jerarquía H1/H2/H3
- `builders/SemanticBuilder.ts` — construye el modelo semántico
- `buildFromStructure.ts`
- `docxToSemanticDocument.ts` — orquestador del pipeline
- `models/SemanticDocument.ts` — modelo central (⚠️ define `DocumentStructure`, duplicada con types/)

**Renderizadores:**
- `renderers/ElpxRenderer.ts` — salida .elpx
- `converters/semanticDocumentToElpx.ts`
- `renderers/html-print/` — salida PDF:
  - `semanticDocumentToPrintHtml.ts` (20 KB, el más grande del renderer)
  - `printStyles.css` (20 KB, CSS Paged Media)
  - `renderCoverPage.ts` · `renderTableOfContents.ts`
  - `PrintThemeLoader.ts` · `optimizeImagesForPrint.ts`

**Validación:**
- `validation/semanticTagBalance.ts` (+ `.test.ts`) — avisa de cajas semánticas sin cerrar (añadido hoy)

**Servicios de temas (`src/core/services/`):**
- `ThemeRegistry.ts` (fuente de verdad), `ThemeService.ts`, `ThemeClientService.ts`
- `BuiltInThemeProvider.ts`, `UserThemeProvider.ts` (IndexedDB)
- `ThemeBundle.ts`, `ThemeCssManager.ts`, `ThemeOrderService.ts`, `ThemeValidator.ts`
- `themeConfigParser.ts`, `PreviewService.ts`, `BlobUrlRegistry.ts`
- `boot/ThemeBoot.ts` — secuencia de arranque

**Panel admin (`src/core/services/admin/`):**
- `GitHubAuthService.ts`, `GitHubThemePublisher.ts`, `gitTree.ts`, `githubRepo.ts`
- `readThemeDirectory.ts`, `themeValidation.ts`, `themesConfig.ts`

**Utilidades:**
- `utils/html.ts` — `escapeHtml` canónica

### Tests con runner (`node:test` vía `tsx`)
- `src/core/transformers/HtmlTransformer.test.ts` (27 tests)
- `src/core/validation/semanticTagBalance.test.ts` (~nuevo)

---

## 5. Temas oficiales — 8 temas × 46 archivos c/u

4 conceptos × 2 idiomas (es / va o en):
- **CID:** `CID_es_26-27`, `CID_va_26-27`
- **Ciencia abierta:** `Ciencia_abierta_26-27`, `Ciencia_oberta_26-27`
- **Doctorado:** `Doctorado_26-27`, `Doctorat_26-27`
- **PhD / Open Science:** `PhD_26-27`, `Open_Science_26-27`

Fuente de verdad en git: `public/themes/<id>/` + `public/themes-config.json`.
Los `.zip` (`public/*.zip`) son artefactos generados por `pack-themes` → gitignored.
Plantilla base inmutable: `public/base.elpx` (448 KB).

---

## 6. Recursos de test (`tests/`)
- **Fixtures DOCX:** `simple.docx` (16K), `semantic.docx` (20K), `tables.docx` (20K), `multipage.docx` (220K), `themed.docx` (736K — el archivo vigente más pesado)
- **Regresión:** `generate-baseline.ts`, `generate-checksums.ts`, `validate-regression.ts`, `regression-checksums.json`, `setup-baseline.sh`

---

## 7. Autoría del historial

Un solo desarrollador real (Mario Florido) bajo 4 identidades git:
| Identidad | Commits |
|-----------|---------|
| `MarioFlorido@users.noreply.github.com` | 139 |
| `mariofloridoperez@iMac-de-PuntBIU.local` | 114 |
| `mario@MacBook-Air-de-Tere.local` | 51 |
| `68684595+MarioFlorido@users.noreply.github.com` | 27 |

> Nota: las identidades `*.local` provienen de no tener `git config user.email` global
> configurado (Git lo avisa en cada commit). Unificar con un `.mailmap` o configurar
> el email global daría un historial de autoría limpio.

---

## 8. Memoria histórica: archivos borrados (172 de main, 1130 distintos jamás)

El historial revela un **gran esfuerzo de modularización/refactor pasado**, luego archivado y borrado:

**Roadmap de refactor (borrado):**
`PHASE_0_SETUP_CHECKLIST` … `PHASE_8`, `FASE_5`–`FASE_9`, `REFACTORING_ROADMAP_SUMMARY`, `RESUMEN_FINAL_MODULARIZACION`, `ARCHITECTURAL_ANALYSIS` (existieron en raíz y en `docs/archive/`).

**Docs migrados a HTML (borrados en limpieza de hoy):**
`docs/COMPARISON.md`, `docs/GUIA-USO.md`, `docs/architecture/ARCHITECTURE.md`, `docs/gestion-temas-oficiales.md`, `docs/DASHBOARD-TEMAS.md`, `docs/ACKNOWLEDGEMENTS.md`.

**Scripts de debug desechables (borrados):**
`debug-docx.ts`, `debug-pages.mjs`, `debug-sections.mjs`, `simple-debug.{js,mjs}`, `scripts/test-*.{js,mjs}`, `scripts/simple-debug.*`.

**Artefactos que no debían estar versionados (borrados):**
ZIPs de temas (`public/*.zip`), `.DS_Store`, iconos sueltos (`public/docx.svg`, `public/pdf.svg`), y un archivo anómalo llamado **`BUA-convertidor-exe`** (sin extensión — posible binario/archivo accidental; conviene confirmar que su borrado fue intencional y que no quedó rastro pesado en el historial).

---

## 9. Observaciones accionables (para tu tarea futura)

1. **Bloat de `.git` (279 MB):** dominado por ZIPs de temas históricos. Si el tamaño importa, valorar `git filter-repo`/BFG (reescribe historial → coordinar, romperá hashes).
2. **`admin-themes-test`:** ya fusionada en main; se puede borrar local y remota para reducir ruido.
3. **`DocumentStructure` duplicada:** `src/types/index.ts` vs `src/core/models/SemanticDocument.ts` (única deuda viva de la "Fase 3").
4. **Autoría fragmentada en 4 identidades:** un `.mailmap` la unificaría.
5. **Archivo anómalo `BUA-convertidor-exe`** en el historial: verificar qué era.
