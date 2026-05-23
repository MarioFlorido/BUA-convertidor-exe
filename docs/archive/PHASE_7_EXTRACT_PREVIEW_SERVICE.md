# Phase 7: Extract PreviewService

## Objetivo
Extraer toda la lógica de generación de preview HTML de `ElpxRenderer` a una clase `PreviewService` reutilizable.

## Análisis Actual

### Responsabilidades de Preview en ElpxRenderer

```
ElpxRenderer (500+ líneas)
├── render() - orquestación principal
├── generateContentXml() - XML de contenido (NO preview)
├── generateOdeNavStructureXml() - XML de navegación (NO preview)
├── generateOdePagStructureXml() - XML de bloques (NO preview)
│
└── LÓGICA A EXTRAER → PreviewService
    ├── buildStandalonePreviewPages() - construye Record de páginas
    ├── getPreviewPages() - metadatos de páginas
    ├── generatePreviewPageHtml() - HTML completo de página
    ├── generatePreviewNavHtml() - nav HTML
    ├── generatePreviewBlockHtml() - bloque/iDevice HTML
    ├── addPreviewHtmlEntries() - agrega HTML a ZIP
    └── Funciones auxiliares:
        ├── createPageDomId()
        ├── slugifyPageTitle()
        ├── sanitizePreviewBlockHtml()
        └── escapeHtml()
```

### Responsabilidades en ElpxRenderer

Después de extracción, ElpxRenderer solo generará:
- `generateContentXml()` - content.xml para eXeLearning
- `generateOdeNavStructureXml()` - estructura de navegación XML
- `generateOdePagStructureXml()` - estructura de bloques XML
- `generateNavStructurePropertyEntry()` - propiedades nav
- `generatePagStructurePropertyEntry()` - propiedades bloque

## Estrategia de Extracción

### 1. Crear `PreviewService` Class

**Archivo**: `src/core/services/PreviewService.ts`

```typescript
export interface PreviewPageInfo {
  title: string;
  href: string;
  pageNumber: number;
  level: 1 | 2 | 3 | 4;
  parentIndex: number | null;
}

export class PreviewService {
  constructor(private project: ImportedProject) {}

  // Public API
  buildPages(): Record<string, string> { }
  addToZipEntries(entries: Record<string, Uint8Array>): void { }

  // Private methods
  private getPageInfo(): PreviewPageInfo[] { }
  private generatePageHtml(pages, activeIndex): string { }
  private generateNavHtml(pages, activePageNumber, activeIndex): string { }
  private generateBlockHtml(block, pageNumber, blockIndex): string { }
}
```

### 2. Refactorizar ElpxRenderer.ts

**Responsabilidades que quedan**:
- `render()` - orquestación
- `generateContentXml()` - XML contenido
- `generateOdeNavStructureXml()` - XML navegación
- `generateOdePagStructureXml()` - XML bloques
- Propiedades auxiliares

**Cambios**:
- En `render()`:
  ```typescript
  const previewService = new PreviewService(this.project);
  const previewPages = previewService.buildPages();
  previewService.addToZipEntries(entries);
  ```

## Métodos a Extraer

| Método | Líneas | Destino |
|--------|--------|---------|
| `buildStandalonePreviewPages()` | 196-206 | PreviewService.buildPages() |
| `getPreviewPages()` | 211-252 | PreviewService.getPageInfo() |
| `generatePreviewPageHtml()` | 257-328 | PreviewService.generatePageHtml() |
| `generatePreviewNavHtml()` | 333-367 | PreviewService.generateNavHtml() |
| `generatePreviewBlockHtml()` | 372-391 | PreviewService.generateBlockHtml() |
| `addPreviewHtmlEntries()` | 396-408 | PreviewService.addToZipEntries() |
| Helper functions | 478-514 | PreviewService privadas |

## Plan de Implementación

### Paso 1: Crear PreviewService.ts (25 min)
- [ ] Crear clase PreviewService(project)
- [ ] buildPages() - público, retorna Record<string, string>
- [ ] addToZipEntries() - público, modifica entries
- [ ] getPageInfo() - privado
- [ ] generatePageHtml() - privado
- [ ] generateNavHtml() - privado
- [ ] generateBlockHtml() - privado
- [ ] Extraer funciones auxiliares (createPageDomId, slugifyPageTitle, sanitizePreviewBlockHtml, escapeHtml)

### Paso 2: Refactorizar ElpxRenderer.ts (15 min)
- [ ] Importar PreviewService
- [ ] En render(): crear PreviewService, usar buildPages() y addToZipEntries()
- [ ] Remover todos los métodos de preview
- [ ] Remover funciones auxiliares de preview

### Paso 3: Validar (10 min)
- [ ] TypeScript compile sin errores
- [ ] Build exitoso
- [ ] No cambiar preview output

### Paso 4: Test en Navegador (10 min)
- [ ] Preview funciona correctamente
- [ ] Navegación de preview funciona
- [ ] Bloques visibles

## Notas Críticas

⚠️ **Page Numbering**: Las páginas se numeran 1-based pero se indexan 0-based. Mantener exactamente igual.

⚠️ **HTML Paths**: index.html vs html/nombre.html. Lógica de rutas relativas es compleja.

⚠️ **Sanitization**: sanitizePreviewBlockHtml() remueve scripts/iframes pero mantiene contenido válido.

⚠️ **Navigation**: renderBranch() es recursiva y calcula parentIndex correctamente.

⚠️ **Escaping**: escapeHtml es función local, pero ya existe en docxToElpx. Considerar compartida.

## Cambios Visibles al Usuario

❌ NINGUNO - solo refactorización interna

## Rollback Plan

Si hay problemas:
1. `git revert` del commit
2. Volver a ElpxRenderer monolítico con preview
3. Diagnosticar con usuario

---

**Estimado**: 60 minutos
**Riesgo**: MEDIA (lógica compleja de preview)
**Beneficio**: Reutilización, testabilidad, separación clara

**Después de Phase 7:**
- Phase 8: Simplify Orchestrator
- Resultado final: Arquitectura completamente modularizada
