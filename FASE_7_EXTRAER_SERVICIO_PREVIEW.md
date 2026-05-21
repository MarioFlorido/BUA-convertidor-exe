# Fase 7: Extraer PreviewService

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

### Responsabilidades en ElpxRenderer después de extracción

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

  // Métodos privados
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
| Funciones auxiliares | 478-514 | PreviewService privadas |

## Plan de Implementación

### Paso 1: Crear PreviewService.ts (25 min)
- [x] Crear clase PreviewService(project)
- [x] buildPages() - público, retorna Record<string, string>
- [x] addToZipEntries() - público, modifica entries
- [x] getPageInfo() - privado
- [x] generatePageHtml() - privado
- [x] generateNavHtml() - privado
- [x] generateBlockHtml() - privado
- [x] Extraer funciones auxiliares (createPageDomId, slugifyPageTitle, sanitizePreviewBlockHtml, escapeHtml)

### Paso 2: Refactorizar ElpxRenderer.ts (15 min)
- [x] Importar PreviewService
- [x] En render(): crear PreviewService, usar buildPages() y addToZipEntries()
- [x] Remover todos los métodos de preview
- [x] Remover funciones auxiliares de preview

### Paso 3: Validar (10 min)
- [x] TypeScript compile sin errores
- [x] Build exitoso
- [x] No cambiar preview output

### Paso 4: Test en Navegador (10 min)
- [x] Preview funciona correctamente
- [x] Navegación de preview funciona
- [x] Bloques visibles

## Notas Críticas

⚠️ **Numeración de Páginas**: Las páginas se numeran 1-based pero se indexan 0-based. Mantener exactamente igual.

⚠️ **Rutas HTML**: index.html vs html/nombre.html. Lógica de rutas relativas es compleja.

⚠️ **Sanitización**: sanitizePreviewBlockHtml() remueve scripts/iframes pero mantiene contenido válido.

⚠️ **Navegación**: renderBranch() es recursiva y calcula parentIndex correctamente.

⚠️ **Escaping**: escapeHtml es función local, pero ya existe en docxToElpx. Considerar compartida.

## Cambios Visibles al Usuario

❌ NINGUNO - solo refactorización interna

---

**Estimado**: 60 minutos
**Riesgo**: MEDIA (lógica compleja de preview)
**Beneficio**: Reutilización, testabilidad, separación clara

**RESULTADO**: ✅ Arquitectura completamente modularizada
