# Fase 8: Simplificar Orquestador

## Objetivo
Limpiar y simplificar docxToElpx.ts (el orquestador principal) ahora que todas las responsabilidades de especialidad han sido extraídas a servicios/renderizadores.

## Análisis Actual

### Estructura docxToElpx.ts (446 líneas)

```
docxToElpx.ts (446 líneas)
├── Orquestación
│   ├── convertDocxToElpx() - entrada principal (DOCX → File)
│   ├── convertHtmlToElpx() - entrada HTML (útil para testing)
│   └── convertProjectToElpx() - entrada proyecto (proyecto → ELPX)
│
├── Construcción de Proyecto (Legacy)
│   ├── buildProjectFromHtml() - parsea HTML a páginas/bloques
│   ├── ensurePage()
│   ├── createPage()
│   ├── ensureBlock()
│   └── appendParagraphHtml()
│
├── Normalización HTML
│   ├── sanitizeImportedHtml()
│   ├── normalizeImportedNode()
│   ├── wrapTag()
│   └── hasMeaningfulHtml()
│
└── Utilidades
    ├── normalizeWhitespace()
    ├── escapeHtml()
    ├── stemFromFilename()
    └── toElpxFilename()
```

### Responsabilidades por Fase

| Componente | Responsabilidad | Fase |
|-----------|-----------------|------|
| DocxParser | Parsear DOCX → HTML | Fase 1 |
| HtmlTransformer | Transformar HTML (divs, tablas) | Fase 2 |
| SemanticBuilder | Construir páginas/bloques desde HTML estructurado | Fase 4 |
| buildProjectFromHtml | Fallback legacy (H1/H2/H3 parsing) | - |
| ElpxRenderer | Generar XML/ZIP de eXeLearning | Fase 5 |
| ThemeService | Cargar templates y temas | Fase 6 |
| PreviewService | Generar HTML preview | Fase 7 |

## Oportunidades de Simplificación

### 1. buildProjectFromHtml - Lógica Legacy

**Estado**: Es un fallback para documentos sin estructura definida (H1/H2/H3 parsing).

**Opciones**:
- A) Mantenerlo como está (compatibilidad hacia atrás)
- B) Refactorizar a clase separada (ProjectBuilder)
- C) Documentar como deprecated

**Recomendación**: Opción A (mantener, pero documentar). Es importante para usuarios sin estructura configurada.

### 2. Normalización HTML

**Estado**: sanitizeImportedHtml, normalizeImportedNode, etc. son funciones muy específicas.

**Mejora**: Podrían consolidarse en un helper o moverse a HtmlTransformer si son reutilizables.

**Acción**: Documentar su propósito. Si no se usan fuera de docxToElpx, están bien aquí.

### 3. Utilidades Genéricas

**Estado**: 
- normalizeWhitespace() - usada en hasMeaningfulHtml()
- escapeHtml() - usada en normalizeImportedNode()
- stemFromFilename() - usada en buildProjectFromHtml()
- toElpxFilename() - usada en convertProjectToElpx()

**Acción**: Ya están optimizadas. Son utilities locales necesarias.

### 4. Flujo de Tres Funciones

**Actual**:
```
convertDocxToElpx()
  → DocxParser.parse()
  → convertHtmlToElpx()
    → applyDivClasses() + applyTableClasses()
    → buildProjectFromHtml()
    → convertProjectToElpx()
      → ThemeService.loadTemplate()
      → ElpxRenderer.render()
      → ThemeService.loadThemeIfNeeded() [implícito]
```

**Mejora**: Las tres funciones públicas son necesarias porque ofrecen diferentes puntos de entrada:
- `convertDocxToElpx()` - users con archivos DOCX (la mayoría)
- `convertHtmlToElpx()` - testing, HTML manual
- `convertProjectToElpx()` - API avanzado, proyectos preconstruidos

## Cambios Concretos para Fase 8

### 1. Documentación Mejorada

Agregar JSDoc completo a:
- convertDocxToElpx() - explica el flujo completo
- convertHtmlToElpx() - explica cuándo usar vs convertDocxToElpx
- convertProjectToElpx() - explica la API de bajo nivel
- buildProjectFromHtml() - documenta como fallback legacy

### 2. Reorganización Opcional

Si hay código duplicado o mejorable:
- Consolidar imports al tope
- Agrupar funciones por responsabilidad
- Eliminar cualquier función no usada

### 3. Sin Grandes Cambios

NO refactorizar:
- No mover buildProjectFromHtml a clase separada (no beneficio)
- No extraer utilidades triviales (normalizeWhitespace, etc.)
- No cambiar estructura de convertDocxToElpx, convertHtmlToElpx, convertProjectToElpx

## Plan de Implementación

### Paso 1: Documentación y Audit (15 min)
- [x] Agregar JSDoc a funciones públicas
- [x] Verificar que no hay código muerto
- [x] Verificar que todas las imports se usan

### Paso 2: Validar Arquitectura (10 min)
- [x] Confirmar que docxToElpx.ts solo orquesta
- [x] Confirmar que especialidades están en sus módulos
- [x] Confirmar que no hay dependencias circulares

### Paso 3: Build Final (5 min)
- [x] npm run build - debe pasar
- [x] Verificar que no hay warnings

### Paso 4: Commit Final (5 min)
- [x] Commit con mensaje describiendo arquitectura final

## Cambios Visibles al Usuario

❌ NINGUNO - solo limpieza interna y documentación

## Checklist de Arquitectura Final

✅ DocxParser - Parsea DOCX a HTML
✅ HtmlTransformer - Transforma HTML (divs, tablas)
✅ SemanticBuilder - Construye proyecto desde estructura
✅ buildFromStructure - Orquesta parseo → builder
✅ ElpxRenderer - Genera XML/ZIP
✅ ThemeService - Carga templates/temas
✅ PreviewService - Genera preview HTML
✅ docxToElpx.ts - Orquestador principal

Flujo:
```
DOCX File
  ↓
DocxParser (Fase 1)
  ↓
HTML
  ↓
HtmlTransformer (Fase 2)
  ↓
Processed HTML
  ↓
buildFromStructure + SemanticBuilder (Fase 4)
  ↓
ImportedProject
  ↓
ElpxRenderer (Fase 5)
  + ThemeService (Fase 6)
  + PreviewService (Fase 7)
  ↓
ELPX Blob + Preview HTML
```

## Métricas Finales

| Componente | Líneas | Tipo |
|-----------|--------|------|
| docxToElpx.ts | ~446 | Orquestación |
| buildFromStructure.ts | ~71 | Orquestación |
| ElpxRenderer.ts | ~263 | Rendering |
| PreviewService.ts | ~288 | Preview |
| ThemeService.ts | ~120 | Services |
| SemanticBuilder.ts | ~317 | Builders |
| DocxParser.ts | Large | Parsers |
| HtmlTransformer.ts | ~150 | Transformers |
| **Total Core** | **~1,655** | **Modularizado** |

Comparación:
- Antes (Fase 0): docxToElpx.ts monolítico (~1,084 líneas)
- Después (Fase 8): Arquitectura modular (~1,655 líneas con separación clara)

**Resultado**: +571 líneas de código modular, limpio, y reutilizable vs 1 archivo monolítico.

---

**Estimado**: 35 minutos
**Riesgo**: MUY BAJA (solo limpieza, sin cambios funcionales)
**Beneficio**: Claridad, mantenibilidad, documentación

**FINAL**: ✅ Arquitectura completamente modularizada (100%)
