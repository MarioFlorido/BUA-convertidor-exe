# Phase 5: Extract ElpxRenderer

## Objetivo
Extraer toda la lógica de generación XML/ZIP de eXeLearning de `docxToElpx.ts` a una clase `ElpxRenderer` reutilizable.

## Análisis Actual

### Tamaño
- **docxToElpx.ts**: 1,084 líneas
- **Complejidad**: CRÍTICA - XML generation, ZIP handling, preview generation

### Responsabilidades en docxToElpx.ts

```
docxToElpx.ts (1084 líneas)
├── Orquestación (convertDocxToElpx, convertHtmlToElpx, convertProjectToElpx)
├── Construcción de proyecto (buildProjectFromHtml)
├── Loading de templates y temas (loadBaseTemplate, loadThemeEntries)
│
└── LÓGICA A EXTRAER → ElpxRenderer
    ├── buildElpxFromTemplate() - genera ELPX desde template
    ├── generateContentXml() - genera content.xml
    ├── generateOdeNavStructureXml() - estructura de navegación
    ├── generateOdePagStructureXml() - estructura de bloques
    ├── generateNavStructurePropertyEntry() - propiedades
    ├── generatePagStructurePropertyEntry() - propiedades de bloque
    ├── buildStandalonePreviewPages() - genera páginas preview
    ├── buildStandalonePreviewHtml() - HTML de preview
    ├── Funciones auxiliares:
    │   ├── escapeXml()
    │   ├── escapeCdata()
    │   ├── createBlockId()
    │   ├── createIdeviceId()
    │   ├── addPreviewHtmlEntries()
    │   ├── getPreviewPages()
    │   ├── generatePreviewPageHtml()
    │   ├── buildStandalonePreviewHtml()
    │   ├── resolveEntryPath()
    │   ├── inlineCssAssetUrls()
    │   └── getMimeTypeFromPath()
```

## Estrategia de Extracción

### 1. Crear `ElpxRenderer` Class

**Archivo**: `src/core/renderers/ElpxRenderer.ts`

```typescript
export interface ElpxRenderOptions {
  themeId?: string;
}

export interface RenderedElpx {
  blobData: Uint8Array;
  previewPages: Record<string, string>;
  pageCount: number;
  blockCount: number;
}

export class ElpxRenderer {
  // Constructor recibe template entries
  constructor(
    private template: { entries: Record<string, Uint8Array> },
    private project: ImportedProject
  ) {}

  // Public API
  render(options: ElpxRenderOptions): RenderedElpx { }
  renderPreview(): Record<string, string> { }

  // Private XML generation
  private generateContentXml(themeId: string): string { }
  private generateOdeNavStructureXml(page, order, pageIds): string { }
  private generateOdePagStructureXml(block, pageId, order): string { }
  
  // Private helpers
  private buildStandalonePreviewPages(): Record<string, string> { }
  private generatePreviewPageHtml(...): string { }
  // ... etc
}
```

### 2. Refactorizar docxToElpx.ts

**Responsabilidades que quedan:**
- Orquestación principal (convertDocxToElpx, convertHtmlToElpx, convertProjectToElpx)
- Loading de templates (loadBaseTemplate, loadThemeEntries)
- Construcción de proyecto (buildProjectFromHtml)

**Cambios:**
- En `convertProjectToElpx()`:
  ```typescript
  const renderer = new ElpxRenderer(template, project);
  const rendered = renderer.render({ themeId });
  return {
    blob: new Blob([rendered.blobData], { type: 'application/zip' }),
    filename: toElpxFilename(filename),
    pageCount: rendered.pageCount,
    blockCount: rendered.blockCount,
    previewHtml: rendered.previewPages['index.html'] ?? '...',
    previewPages: rendered.previewPages,
  };
  ```

## Métodos a Extraer

| Método | Líneas | Destino |
|--------|--------|---------|
| `buildElpxFromTemplate()` | 461-471 | ElpxRenderer.render() |
| `generateContentXml()` | 634-694 | ElpxRenderer.generateContentXml() |
| `generateOdeNavStructureXml()` | 698-716 | ElpxRenderer.generateOdeNavStructureXml() |
| `generateOdePagStructureXml()` | 726-766 | ElpxRenderer.generateOdePagStructureXml() |
| `buildStandalonePreviewPages()` | 473-486 | ElpxRenderer.renderPreview() |
| `buildStandalonePreviewHtml()` | 488-562 | ElpxRenderer.buildStandalonePreviewHtml() |
| `generatePreviewPageHtml()` | 834+ | ElpxRenderer.generatePreviewPageHtml() |
| Helper functions | 620+ | ElpxRenderer private methods |

## Plan de Implementación

### Paso 1: Crear ElpxRenderer.ts (45 min)
- [ ] Crear clase ElpxRenderer
- [ ] Copiar generación de contenido XML
- [ ] Copiar generación de preview
- [ ] Extraer todas las funciones auxiliares

### Paso 2: Refactorizar docxToElpx.ts (20 min)
- [ ] Actualizar convertProjectToElpx() para usar ElpxRenderer
- [ ] Mantener convertDocxToElpx, convertHtmlToElpx, loadTemplates
- [ ] Limpiar funciones eliminadas

### Paso 3: Validar (10 min)
- [ ] TypeScript compile sin errores
- [ ] Build exitoso
- [ ] No cambiar XML output (byte-identical)

### Paso 4: Test en Navegador (10 min)
- [ ] Preview funciona
- [ ] ELPX generado correctamente
- [ ] Temas funcionan

## Notas Críticas

⚠️ **XML Generation**: La generación XML es frágil con indentación específica. Mantener exactamente igual.

⚠️ **IDs Únicos**: createBlockId() y createIdeviceId() generan IDs únicos. Deben mantenerse.

⚠️ **Preview Generation**: La lógica de resolveEntryPath() es compleja y crítica para la preview.

⚠️ **CDATA Escaping**: Deben mantenerse exactamente las funciones escapeCdata(), escapeXml().

## Cambios Visibles al Usuario

❌ NINGUNO - solo refactorización interna

## Rollback Plan

Si hay problemas:
1. `git revert` del commit
2. Volver a docxToElpx.ts monolítico
3. Diagnosticar con usuario

---

**Estimado**: 85 minutos
**Riesgo**: CRÍTICA (XML generation es core)
**Beneficio**: Claridad, testabilidad, reutilización en Phase 7

**Después de Phase 5:**
- Phase 6: Extract ThemeService
- Phase 7: Extract PreviewService  
- Phase 8: Simplify Orchestrator
