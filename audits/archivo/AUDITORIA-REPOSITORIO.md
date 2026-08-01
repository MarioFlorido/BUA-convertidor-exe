# Auditoría técnica integral — BUA ConvertidoreXe

> **Rol:** Arquitecto de Software Principal / Auditor de Repositorios Git / Gobernanza de Código
> **Fecha:** 2026-06-08 · **Commit auditado:** `5d313a2` (main) · **Método:** análisis estático de solo lectura (grafo de imports, cruce de referencias, `npm audit`, historial Git). **No se ha modificado ni borrado nada.**
> **Documento local, NO versionado.**

**Leyenda de confianza:** `[C]` Confirmado (verificado con evidencia) · `[P]` Probable · `[?]` Posible (requiere comprobación manual).
**Clasificación de acción:** 🟥 Eliminar · 🟧 Consolidar · 🟨 Revisar manualmente · 🟩 Conservar.

---

## 1. Informe ejecutivo

**Veredicto general: repositorio SANO y de calidad alta.** La arquitectura es limpia y el código está bien disciplinado. Los problemas son de *higiene y gobernanza*, no estructurales.

**Fortalezas confirmadas:**
- `[C]` **0 dependencias circulares** (grafo acíclico) y **0 violaciones de capa** (el núcleo `src/core` nunca importa la UI). El desacople import/export que promete la arquitectura es real.
- `[C]` **0 dependencias de producción sin usar** (las 6 se importan).
- `[C]` TypeScript en `strict` + `noUnusedLocals` + `noUnusedParameters`; **0 marcadores TODO/FIXME**; `console.*` mínimo y legítimo.
- `[C]` Un solo lockfile (`package-lock.json`), sin duplicación de gestores.

**Problemas principales (priorizados):**
| # | Hallazgo | Conf. | Gravedad |
|---|----------|-------|----------|
| 1 | `.git` inflado a **279 MB** por ZIPs de temas históricos | [C] | Alta (higiene) |
| 2 | **Favicon roto**: `index.html` → `/vite.svg` inexistente | [C] | Media |
| 3 | Script `lint` invoca **eslint que no está instalado** ni configurado | [C] | Media |
| 4 | **CI no ejecuta tests** (`npm test` ni regresión) | [C] | Media |
| 5 | Código muerto: `BlobUrlRegistry`, `SemanticDocumentValidation`, `hasThemeEntry`, `isValidProject` | [C] | Baja |
| 6 | Duplicados: `DocumentStructure` (divergente), `ElpxRenderOptions` (idéntico) | [C] | Baja |
| 7 | ~~Rama `admin-themes-test` ya fusionada~~ **ANULADO**: es rama-diana de ensayos del publicador (documentada en `gestionar-temas-oficiales.html`), NO borrar | [C] | — |
| 8 | 2 vulnerabilidades moderadas (`esbuild`/`vite`, **solo dev server**) | [C] | Baja |
| 9 | Sin política de ramas/releases/versionado documentada | [C] | Media (gobernanza) |

---

## 2. Código fuente — hallazgos clasificados

Análisis sobre **54 archivos fuente** (`src` + `scripts`). Grafo de alcanzabilidad desde entry points (`main.tsx`, `*.test.ts`, `scripts/*`): **53 alcanzables, 1 huérfano**.

### 🟥 Código muerto confirmado (eliminar o cablear)
| Símbolo / archivo | Evidencia | Acción | Riesgo |
|---|---|---|---|
| **`src/core/services/BlobUrlRegistry.ts`** (archivo entero) | `[C]` 0 imports en todo el repo. Singleton para revocar blob URLs; los providers ya revocan inline (`URL.revokeObjectURL` + `console.debug` en `BuiltInThemeProvider`/`UserThemeProvider`), así que quedó superseded por el fix de memory-leaks. | 🟥 Eliminar (o cablear si se quería centralizar) | Muy bajo |
| **`SemanticDocumentValidation`** (`models/SemanticDocument.ts:104`) | `[C]` 1 sola ocurrencia = solo la definición. Objeto validador (`isValidBlock/Page/Document/Project`) nunca llamado. | 🟨 Revisar → 🟥 Eliminar, **o** usarlo en tests (sería buen aprovechamiento) | Bajo |
| **`isValidProject`** (dentro del anterior) | `[C]` `@deprecated` y solo en su archivo. | 🟥 Eliminar con el objeto | Muy bajo |
| **`hasThemeEntry`** (`services/admin/themesConfig.ts:75`) | `[C]` 1 ocurrencia = solo definición. | 🟨 Revisar (¿API pensada para el panel?) → 🟥 Eliminar | Bajo |

### 🟧 Duplicados a consolidar
| Caso | Evidencia | Acción |
|---|---|---|
| **`DocumentStructure`** en `types/index.ts:70` **y** `models/SemanticDocument.ts:79` | `[C]` **Divergentes**: la de `types/` tiene `id` en `H1Section`/`H2Item`; la del modelo es inline sin `id`. Única deuda viva de la "Fase 3". | 🟧 Unificar en una sola fuente (recomendado: la de `types/` con `id`) e importar desde el modelo | 
| **`ElpxRenderOptions`** en `converters/semanticDocumentToElpx.ts:58` **y** `renderers/ElpxRenderer.ts:7` | `[C]` **Idénticas** (`{ themeId?: string }`). | 🟧 Definir una vez (en el renderer) e importar en el converter |
| Aliases `ImportedProject/Page/Block` (`models/SemanticDocument.ts`) | `[C]` `@deprecated` pero **aún usados en 5 archivos** (buildFromStructure, semanticDocumentToElpx, ElpxRenderer, PreviewService, SemanticBuilder). | 🟧 **Migrar** los usos a `SemanticDocument/Page/Block` y luego eliminar los alias | 

### 🟩 Exportado pero solo usado internamente (NO es muerto — opcional reducir superficie)
`[C]` Se usan dentro de su propio archivo; solo sobra el `export`:
`convertHtmlToSemanticDocument`, `validateStructure`, `packAllThemes`, `GITHUB_API_BASE`, `extractPalette`.
→ 🟩 Conservar (o quitar `export` si se quiere API mínima; algunos `export` existen para tests futuros).

### 🟩 Interfaces de tipo exportadas como API pública de su módulo
`[C]` ~15 interfaces (`DocxParseResult`, `RenderedElpx`, `PrintHtmlResult`, `PrintRenderOptions`, `ThemeValidationResult`, `AuthResult`, `PublishOptions`, `ReadDirectoryResult`, `ImageOptimizeOptions`, etc.) son tipos de retorno/parámetro. No son muertas: documentan contratos. → 🟩 Conservar.

### Calidad de código
- `[C]` **0 TODO/FIXME/HACK**. **0 ciclos**. `console.*`: 19 usos, todos legítimos (1 en JSDoc, resto `warn`/`error`/`debug` defensivos en `catch`).

---

## 3. Dependencias

`package.json`: **6 prod + 9 dev**. Lockfile único: `package-lock.json` (no hay `pnpm-lock`/`yarn.lock`).

| Dependencia | Uso | Estado |
|---|---|---|
| `fflate` | zip/unzip (6+ archivos) | 🟩 [C] usada |
| `idb` | IndexedDB (`UserThemeProvider`) | 🟩 [C] usada |
| `mammoth` | DOCX→HTML (`DocxParser`) | 🟩 [C] usada |
| `pagedjs` | PDF (import `?raw` por ruta relativa) | 🟩 [C] usada |
| `react`, `react-dom` | UI / `main.tsx` | 🟩 [C] usadas |
| devDeps (`vite`, `tsx`, `typescript`, `@vitejs/plugin-react`, `gh-pages`, `jsdom`, `@types/*`) | build/test/tipos | 🟩 [C] usadas |

**Hallazgos:**
- 🟥 `[C]` **Script `lint` roto:** `package.json` define `"lint": "eslint ..."` pero **eslint NO está en devDependencies** ni hay config (`.eslintrc*`/`eslint.config.*`). → O se añade `eslint` + `@typescript-eslint` + config, o se elimina el script.
- 🟨 `[C]` **`esbuild`/`vite`: 2 vulnerabilidades moderadas** (GHSA-67mh-4wv8-2f99). **Solo afectan al dev server**, no al build estático de producción. → Actualizar `vite` cuando convenga (fix mayor = vite 8, breaking). Riesgo de prod ≈ nulo.
- 🟨 `[?]` `@types/node` `^25` mientras el CI usa Node 20 → desalineación menor de tipos. Bajar a `^20` para coherencia.

---

## 4. Git — ramas, historial, gobernanza

**Estado actual:** 331 commits totales, autor único (Mario) bajo **4 identidades git**, rango 2026-05-10 → hoy.

| Rama | Commits | Diagnóstico | Acción |
|---|---|---|---|
| `main` | 190 | Activa, por defecto | 🟩 Conservar |
| `admin-themes-test` | 168 | `[C]` Fusionada en main, PERO es **rama-diana de ensayos** del publicador de temas (documentada en `gestionar-temas-oficiales.html`; `GitHubThemePublisher` exige que exista) | 🟩 **CONSERVAR** (borrarla rompe el flujo de dry-run del panel) |
| `gh-pages` | 141 | Artefacto de despliegue (CI) | 🟩 Conservar, no editar a mano |

**Salud del historial:**
- 🟥 `[C]` **`.git` = 279 MB.** Los 15 blobs más grandes son ZIPs de temas (`PhD_26-27.zip` ~3,5 MB) commiteados decenas de veces antes de moverse a `.gitignore`. → Adelgazable con `git filter-repo`/BFG (**reescribe historial**: coordinar con todos los equipos, romperá hashes y forks).
- 🟨 `[C]` **4 identidades de autor** (`MarioFlorido@users…`, `mariofloridoperez@iMac…`, `mario@MacBook-Air…`, `68684595+…`). → `.mailmap` para unificar + configurar `git config user.email` global en cada equipo.
- 2 tags de checkpoint (`checkpoint-pre-cambio-importante-2026-06-05`, `checkpoint-pre-imagenes`).

**Propuesta de gobernanza (no existe hoy):**
- **Nomenclatura de ramas:** `feat/…`, `fix/…`, `docs/…`, `chore/…`, `exp/…` (experimentales, efímeras).
- **Política:** `main` protegida (PR + CI verde para mergear); ramas de trabajo efímeras borradas al fusionar; `gh-pages` solo CI.
- **Releases:** SemVer + tags `vX.Y.Z` alineados con `package.json` (hoy v0.3.0) + secciones de `CHANGELOG.md`. Tag al cerrar cada versión.

---

## 5. Documentación

(Gran parte ya racionalizada en sesiones previas.)

| Documento | Estado | Acción |
|---|---|---|
| `public/docs/*.html` (7) | `[C]` Fuente de verdad de usuario, enlazados desde la UI, al día | 🟩 Mantener |
| `README.md` | Actualizado a v0.3.0 | 🟩 Mantener |
| `CHANGELOG.md` | Con sección v0.3.0 | 🟩 Mantener |
| `docs/FASE-3-pendiente.md` | Plan casi completado (solo queda unificar `DocumentStructure`) | 🟨 Archivar/eliminar al cerrar esa deuda |
| `docs/testing/REGRESSION_TESTING_PLAN.md` | Describe un harness real pero **no automatizado** | 🟨 Mantener + decidir si se automatiza |
| `INFORME-ESTILO-INTERFAZ.html`, `INVENTARIO-REPOSITORIO.md`, este informe | Entregables locales | 🟩 gitignored (no versionar) |

Histórico ya eliminado correctamente (no reaparecer): roadmap `PHASE_*`/`FASE_*`, `ARCHITECTURAL_ANALYSIS`, `RESUMEN_FINAL_MODULARIZACION`, 4 MD duplicados de los HTML, `DASHBOARD-TEMAS.md`.

---

## 6. Scripts y automatización

| Script | Propósito | Diagnóstico | Acción |
|---|---|---|---|
| `scripts/pack-themes.ts` | Genera ZIPs desde `public/themes/` (hook `predev`/`prebuild`, usado por CI) | `[C]` Esencial | 🟩 Conservar |
| `scripts/themes.ts` | Gestión **interactiva** de temas | `[C]` Reimplementa `publishTheme()` internamente (no invoca a los otros) | 🟨 Revisar solape |
| `scripts/publish-theme.ts` | Publica tema por CLI con args | `[C]` Lógica solapada con `themes.ts` | 🟨 Revisar |
| `scripts/unpublish-theme.ts` | Retira tema por CLI | `[C]` Solapa con `themes.ts` | 🟨 Revisar |

- `[C]` Los 3 CLI (`themes`/`publish-theme`/`unpublish-theme`) son **fallback ya superado por el panel web `OfficialThemeAdmin`**. Solapan funcionalidad entre sí y con el panel. → Decisión: ¿se mantienen como fallback de emergencia o se eliminan? (No bloquean nada; son ~ruido de mantenimiento.)
- 🟨 `[C]` **CI (`deploy.yml`) NO ejecuta tests** — solo `npm run build` + deploy. `npm test` y la regresión nunca corren en CI. → Añadir paso `npm test` (y opcionalmente regresión) antes del deploy.
- `[C]` `scripts/publicar-tema-completo.sh` (mencionado en memoria, en el Escritorio) **no está en el repo** — OK.

---

## 7. Recursos del repositorio — inventario

| Recurso | Estado |
|---|---|
| `public/docx.png`, `pdf.png`, `elpx-icon.png` | `[C]` 🟩 Todas referenciadas (App/UploadZone/DownloadButton) |
| `public/logo_BUA.png`, `logo_CID.png`, `logo_UA.png` | `[C]` 🟩 Referenciadas (AppHeader/App/cover PDF/docs) |
| `public/base.elpx` (448 KB) | `[C]` 🟩 Plantilla base, usada por 4 módulos |
| `public/themes/` (368 archivos, 8 temas × 46) | 🟩 Fuente de verdad de temas |
| `public/*.zip` | 🟩 Artefactos generados (gitignored) |
| **Favicon `/vite.svg`** | 🟥 `[C]` **NO existe** → 404. `index.html:5` lo referencia. → Añadir un favicon propio (o `public/favicon.svg`) y corregir la ruta. |
| `tests/fixtures/themed.docx` (752 KB), `multipage.docx` (220 KB) | 🟩 Fixtures legítimos (grandes pero necesarios) |
| Imágenes/PDF/logs sin uso | `[C]` 🟩 **Ninguno detectado** |

---

## 8. Calidad arquitectónica

| Dimensión | Evaluación | Evidencia |
|---|---|---|
| **Cohesión** | Alta | Capas claras: `parsers→transformers→builders→models→renderers/converters`; servicios de temas agrupados; admin aislado |
| **Acoplamiento** | Bajo y sano | `[C]` Fan-in concentrado en hub correcto (`ThemeRegistry` 11, `SemanticDocument`/`types` 8, `utils/html` 6). Fan-out alto solo en `App.tsx` (14, orquestador) |
| **Modularidad** | Alta | Importación/exportación desacopladas; modelo `SemanticDocument` agnóstico al formato |
| **Dependencias circulares** | `[C]` **Ninguna** | DFS sobre grafo real |
| **Violaciones de capa** | `[C]` **Ninguna** | `core` nunca importa `components`/`App` |
| **Escalabilidad** | Buena | Añadir un renderer = un archivo nuevo sin tocar el resto |
| **Testabilidad** | Media | Núcleo testeable (desacoplado), pero **cobertura fina**: solo 2 archivos de test (`HtmlTransformer`, `semanticTagBalance`). Renderers, servicios de temas y panel admin sin tests |
| **Mantenibilidad / legibilidad** | Alta | strict TS, sin ciclos, sin TODO, nombres claros, JSDoc presente |

**Inconsistencia menor de organización** `[?]`: algunos módulos del núcleo viven en la raíz de `src/core/` (`buildFromStructure.ts`, `docxToSemanticDocument.ts`, `parseStructure.ts`) mientras otros están en subcarpetas temáticas. Unificar criterio (ver §9).

---

## 9. Estructura objetivo recomendada

La estructura actual ya es buena; los cambios son de *consistencia*, no de refactor:

```
BUA-convertidor-exe/
├── .github/workflows/        # CI (añadir paso de tests)
├── docs/                     # documentación de DESARROLLO (interna)
│   ├── FASE-3-pendiente.md
│   └── testing/REGRESSION_TESTING_PLAN.md
├── public/
│   ├── favicon.svg           # ← NUEVO (corrige el 404)
│   ├── base.elpx
│   ├── docs/                 # documentación de USUARIO (HTML, fuente de verdad)
│   ├── img/                  # ← agrupar logos/iconos sueltos (docx.png, pdf.png, logo_*.png…)
│   ├── themes/               # 8 temas oficiales (fuente de verdad)
│   └── themes-config.json
├── scripts/                  # automatización (pack-themes esencial; CLI de temas = revisar)
├── src/
│   ├── components/           # UI React
│   ├── core/
│   │   ├── pipeline/         # ← agrupar buildFromStructure, docxToSemanticDocument, parseStructure
│   │   ├── parsers/ transformers/ builders/ models/
│   │   ├── renderers/ converters/
│   │   ├── services/ (+ admin/)
│   │   ├── validation/ boot/ utils/
│   ├── types/  styles/  main.tsx  App.tsx
└── tests/                    # fixtures + harness de regresión
```
**Convenciones:** ficheros de componente `PascalCase.tsx`; servicios `PascalCase.ts`; utilidades `camelCase.ts`; un tipo compartido = una única definición (sin duplicar entre `types/` y `models/`).
> Nota: mover ficheros de `public/` a `public/img/` obliga a actualizar todas las rutas que los referencian — hacerlo en su propia fase y verificar.

---

## 10. Plan de limpieza por fases

Para cada acción: **Riesgo · Impacto · Beneficio · Prioridad**.

### Fase 1 — Auditoría y clasificación ✅ (este documento)
Hecho. Inventario y hallazgos clasificados con nivel de confianza.

### Fase 2 — Eliminación segura ✅ COMPLETADA (commit 347c918)
| Acción | Estado |
|---|---|
| `public/favicon.svg` propio + `index.html` corregido (quita 404 de `/vite.svg`) | ✅ Hecho |
| Quitar script `lint` roto de `package.json` (eslint no instalado) | ✅ Hecho |
| Eliminar `BlobUrlRegistry.ts` (verificado: providers revocan inline) | ✅ Hecho |
| Eliminar `SemanticDocumentValidation` + `isValidProject` | ✅ Hecho |
| Eliminar `hasThemeEntry` | ✅ Hecho |
| Borrar rama `admin-themes-test` | ❌ **Anulado** — es rama-diana de ensayos (ver §4) |
| **Verificación:** `tsc --noEmit` limpio + `npm test` 38/38 + `npm run build` OK | ✅ |

> Observación de build (para fase futura, no Fase 2): `DocxParser.ts` se importa **dinámicamente** en `App.tsx` y **estáticamente** en `docxToSemanticDocument.ts` → el dynamic import no llega a separar chunk. Unificar el criterio de import.

### Fase 3 — Consolidación ✅ COMPLETADA (rama → merge e5b7024 a main)
Refactor puro verificado commit a commit (tsc + 38 tests + build); flujo rama + merge --no-ff con aprobación (producción intacta hasta verde).
| Acción | Estado |
|---|---|
| Unificar `DocumentStructure` (1 sola fuente, en `types/`) | ✅ Hecho (el duplicado del modelo estaba muerto) |
| Unificar `ElpxRenderOptions` (idéntico) | ✅ Hecho (fuente única en `ElpxRenderer.ts`) |
| Migrar `ImportedProject/Page/Block` → `SemanticDocument/*` y eliminar alias | ✅ Hecho (5 usos migrados) |
| Decidir destino de los 3 CLI de temas (mantener fallback / eliminar) | ✅ Decidido: **conservar como fallback** del panel web |

### Fase 4 — Reorganización ⏭️ SALTADA (decisión consciente)
Cosmética y la de más riesgo en producción (rutas en código + 7 HTML de docs). La estructura actual ya es buena (0 ciclos, 0 violaciones de capa). Se re-evaluará si algún día compensa.
| Acción | Estado |
|---|---|
| Agrupar `src/core/pipeline/` | ⏭️ Pospuesto |
| Agrupar assets en `public/img/` | ⏭️ Pospuesto |
| Adelgazar `.git` con filter-repo/BFG (reescribe historial) | ⏭️ Pendiente (requiere consenso de equipos) |

### Fase 5 — Documentación y gobernanza ✅ COMPLETADA (merge c565c5d)
| Acción | Estado |
|---|---|
| `CONTRIBUTING.md` (ramas, releases, verja, identidad git) | ✅ Hecho |
| `.mailmap` (4 identidades → 1, verificado con `git shortlog`) | ✅ Hecho |
| Eliminar `FASE-3-pendiente.md` (deuda cerrada) | ✅ Hecho |

### Fase 6 — Validación final ✅ COMPLETADA (merge c565c5d + fix CI 951d3ba)
| Acción | Estado |
|---|---|
| `npm test` en el CI antes de build+deploy | ✅ Hecho y **validado en vivo** (un test rojo bloquea el deploy) |
| Fix: script `test` independiente de la versión de Node (`find` en vez de glob) | ✅ Hecho (CI usa Node 20; glob necesitaba Node 21+) |
| `App.tsx`: `DocxParser` import estático (quita aviso de build) | ✅ Hecho |
| `npm audit` / actualizar vite (esbuild dev-only) | ⏳ Pendiente (riesgo prod ≈ nulo) |

---

## 11. Comprobaciones manuales pendientes (no determinables automáticamente)
- `[?]` **`BlobUrlRegistry`**: ¿se quería centralizar la gestión de blob URLs y se quedó a medias (bug latente), o es definitivamente descartado? Confirmar antes de borrar.
- `[?]` **`hasThemeEntry` / `SemanticDocumentValidation`**: ¿API pensada para uso futuro del panel/tests? Si sí → cablear; si no → eliminar.
- `[?]` **3 CLI de temas**: ¿se conservan como fallback ante fallo del panel web? Decisión de producto.
- `[?]` **Adelgazar `.git`**: requiere consenso de TODOS los equipos (reescribe hashes). Coordinar.
- `[?]` Revisar visualmente que ningún tema dependa de un asset que se mueva en la Fase 4.

---

## 12. Checklist final de validación (ejecutar tras cada fase)
- [ ] `npm ci` instala sin errores
- [ ] `npm run build` compila (tsc strict + vite) sin errores ni warnings nuevos
- [ ] `npm test` pasa (HtmlTransformer + semanticTagBalance)
- [ ] `npm run lint` ejecuta (una vez arreglado) sin errores
- [ ] La app arranca (`npm run dev`) y el flujo DOCX→ELPX y DOCX→PDF funciona con un documento real
- [ ] El favicon carga (sin 404 en consola)
- [ ] Generar un ELPX y un PDF y abrirlos: maquetación intacta
- [ ] El panel de administración de temas sigue publicando/actualizando/eliminando
- [ ] `git status` limpio; ramas efímeras borradas; `main` protegida
- [ ] `npm audit`: sin vulnerabilidades nuevas de severidad alta/crítica
