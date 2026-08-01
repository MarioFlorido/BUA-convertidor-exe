# Auditoría de repositorio — BUA ConvertidoreXe (vigente)

> **Documento local, NO versionado** (gitignored junto con `audits/`). Es la **única fuente de verdad** de auditoría; los informes anteriores quedan archivados en `audits/archivo/`.
> **Última actualización:** 2026-06-21 · **Commit base:** `main` tras Fase 2 + reorganización (Fase 4) + tag `v0.3.0`.
> **Método:** análisis estático de solo lectura (grafo de imports, cruce export/import, DFS de ciclos, `npm audit`, `git`) + ejecución de tests + verificación en navegador de la reorganización de assets.
> **Leyenda confianza:** `[C]` Confirmado · `[P]` Probable · `[?]` Posible. **Acción:** 🟥 Eliminar · 🟧 Consolidar · 🟨 Revisar · 🟩 Conservar.

---

## 1. Dictamen

**Repositorio sano, maduro y limpio.** Sin problemas estructurales ni de seguridad que afecten a producción. Tras tres ciclos de auditoría (8-jun, 19-jun, 21-jun) la deuda de higiene y duplicación está prácticamente cerrada.

| Métrica | Resultado |
|---|---|
| Dependencias circulares | **0** `[C]` |
| Violaciones de capa (`core`→UI) | **0** `[C]` (núcleo no importa React) |
| Módulos huérfanos | **0** `[C]` |
| Código muerto | **0** `[C]` (tipo `Theme` eliminado en Fase 2) |
| Dependencias prod/dev sin usar | **0 / 0** `[C]` (7 prod + 9 dev, todas usadas) |
| Tests | **108 ✓ / 24 suites** `[C]` |
| Lockfiles | 1 (`package-lock.json`) |
| `tsc` strict + tests en CI (Node 24) | sí |

---

## 2. Trabajo ejecutado (histórico de saneamiento)

**Fase 2 (auditoría 21-jun), desplegada en `main`:**
- 🟥 Eliminado tipo muerto `Theme` (`src/types/index.ts`) — 0 referencias.
- 🟧 README §"Lo que me falta": retirada nota obsoleta de `DocumentStructure` (deuda cerrada en Fase 3).
- 🟥 Borrada rama fusionada `feat/estilos-agrupados-por-familia` (local + origin).
- 🟥 Borrados 2 tags `checkpoint-*` (local + origin).
- 🟢 Creado y empujado tag de release **`v0.3.0`**.

**Fase 4 — Reorganización (21-jun), desplegada en `main`:**
- 📁 `src/core/pipeline/` agrupa `parseStructure`, `docxToSemanticDocument`, `buildFromStructure` (+ sus 2 tests). Verificado: `tsc` limpio + 108 tests.
- 📁 `public/img/` agrupa logos/iconos de la app (`logo_BUA/UA/CID`, `docx`, `pdf`, `elpx-icon`, `minichrome`, `miniedge`). 9 referencias actualizadas en 4 componentes. Verificado en navegador: 0 peticiones 404, imágenes renderizadas. (Los logos del PDF salen del ZIP del tema, no de `public/` — no afectados.)
- 🗂️ Consolidados los informes locales: este `AUDITORIA.md` vigente + `audits/archivo/` con los 3 anteriores y el informe de estilo.

**Previo (auditorías 8-jun y 19-jun), ya en `main`:** favicon propio, retirada del script `lint` roto, CI ejecuta `npm test` antes de desplegar, eliminado código muerto (`BlobUrlRegistry`, `SemanticDocumentValidation`, `hasThemeEntry`, `BUA_CLASSES`, `loadThemeIfNeeded`), unificados `DocumentStructure`/`ElpxRenderOptions`, migrados alias `ImportedProject/*`, helpers de string centralizados en `utils/html`, `.mailmap` + `CONTRIBUTING`, Node alineado dev/CI a 24, `git gc` (894 MB → 275 MB), test de invariante posicional, `.docx` case-insensitive.

---

## 3. Estado de la estructura objetivo

Alcanzada salvo el adelgazado de `.git`:

```
BUA-convertidor-exe/
├── .github/workflows/deploy.yml      # CI: npm ci → test → build → deploy (Node 24)
├── audits/                           # informes locales (gitignored)
│   ├── AUDITORIA.md                  # ← este, vigente
│   └── archivo/                      # informes anteriores
├── docs/testing/REGRESSION_TESTING_PLAN.md
├── public/
│   ├── favicon.svg, base.elpx, themes-config.json
│   ├── img/                          # ← logos/iconos de la app
│   ├── docs/                         # docs de usuario (HTML)
│   └── themes/                       # 8 temas oficiales
├── scripts/                          # pack-themes + 3 CLI (fallback del panel web)
├── src/
│   ├── components/  types/  styles/  main.tsx  App.tsx
│   └── core/
│       ├── pipeline/                 # ← parseStructure, docxToSemanticDocument, buildFromStructure
│       ├── parsers/ transformers/ builders/ models/ renderers/ converters/
│       └── services/(+admin/) validation/ boot/ utils/
└── tests/                            # fixtures + harness de regresión
```

---

## 4. Único pendiente real: adelgazar `.git`

| Aspecto | Detalle |
|---|---|
| Estado | `.git` ≈ 275 MB. Causa: ZIPs de temas commiteados en el historial antes de pasar a `.gitignore`. Ya se aplicó `git gc` (lo seguro). |
| Solución | Reescritura de historial con `git filter-repo` o BFG (no instalados; requeriría `pip install git-filter-repo`). |
| Riesgo | **ALTO y outward-facing:** reescribe TODOS los hashes, exige `git push --force`, **rompe cada clon y fork existente** y los tags actuales. |
| Recomendación | Solo con **consenso de todos los que clonan/forkean** y ventana coordinada. Decisión organizativa, no técnica. Pendiente de tu visto bueno explícito. |

---

## 5. Pendientes menores / aceptados por decisión

- 🟨 `[C]` **`npm audit`: 1 high + 1 moderate** (`esbuild`/`vite`) — **solo dev server**; el sitio desplegado no está afectado. Fix = `vite@8` (breaking), desaconsejado por congelamiento.
- 🟨 `[P]` `@types/node ^25` con Node 24 — desalineación cosmética de 1 major.
- 🟩 `[C]` **3 CLI de temas** (`themes`/`publish-theme`/`unpublish-theme`) — fallback del panel web; conservados a propósito.
- 🟨 `[P]` **CI sin harness de regresión** (`tests/validate-regression.ts`) — solo unit tests; la regresión es manual.
- 🟨 `[P]` **CHANGELOG** con numeración no monótona (1.x → 0.x) — convendría una nota de reinicio de versionado.
- 🟩 `[C]` ~30 símbolos "sobre-exportados" (tipos/funciones usados solo internamente) — superficie de API, no código muerto. Conservar.

---

## 6. Conservado a propósito (NO tocar)
- Rama `admin-themes-test`: rama-diana de dry-run del publicador (`CONTRIBUTING.md`, `gestionar-temas-oficiales.html`).
- Rama `gh-pages`: artefacto del CI.
- Tag `pre-auditoria-p0p2-2026-06-19`.
- `public/themes/`, `public/base.elpx`, `public/favicon.svg`, fixtures `.docx`.

---

## 7. Checklist de validación (tras cada cambio)
- [ ] `npm ci` sin errores
- [ ] `npx tsc --noEmit` limpio
- [ ] `npm test` 108/108
- [ ] `npm run build` sin warnings nuevos
- [ ] `npm run dev` + smoke test DOCX→ELPX y DOCX→PDF; imágenes y maquetación intactas
- [ ] Panel de administración de temas publica/actualiza/elimina (rama `admin-themes-test` intacta)
- [ ] `git status` limpio; sin ramas efímeras fusionadas; `main` protegida
- [ ] `npm audit` sin nuevas vulnerabilidades alta/crítica en cadena de producción
