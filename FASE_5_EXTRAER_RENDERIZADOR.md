# Fase 5: Extraer ElpxRenderer

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

**Responsabilidades que quedan**:
- Orquestación principal (convertDocxToElpx, convertHtmlToElpx, convertProjectToElpx)
- Loading de templates (loadBaseTemplate, loadThemeEntries)
- Construcción de proyecto (buildProjectFromHtml)

**Cambios**:
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
- [x] Crear clase ElpxRenderer
- [x] Copiar generación de contenido XML
- [x] Copiar generación de preview
- [x] Extraer todas las funciones auxiliares

### Paso 2: Refactorizar docxToElpx.ts (20 min)
- [x] Actualizar convertProjectToElpx() para usar ElpxRenderer
- [x] Mantener convertDocxToElpx, convertHtmlToElpx, loadTemplates
- [x] Limpiar funciones eliminadas

### Paso 3: Validar (10 min)
- [x] TypeScript compile sin errores
- [x] Build exitoso
- [x] No cambiar XML output (byte-identical)

### Paso 4: Test en Navegador (10 min)
- [x] Preview funciona
- [x] ELPX generado correctamente
- [x] Temas funcionan

## Notas Críticas

⚠️ **XML Generation**: La generación XML es frágil con indentación específica. Mantener exactamente igual.

⚠️ **IDs Únicos**: createBlockId() y createIdeviceId() generan IDs únicos. Deben mantenerse.

⚠️ **Preview Generation**: La lógica de resolveEntryPath() es compleja y crítica para la preview.

⚠️ **CDATA Escaping**: Deben mantenerse exactamente las funciones escapeCdata(), escapeXml().

## Cambios Visibles al Usuario

❌ NINGUNO - solo refactorización interna

---

**Estimado**: 85 minutos
**Riesgo**: CRÍTICA (XML generation es core)
**Beneficio**: Claridad, testabilidad, reutilización en Phase 7

**RESULTADO**: ✅ ElpxRenderer listo para Fase 6 y 7
