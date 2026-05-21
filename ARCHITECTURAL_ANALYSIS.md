# 📐 Análisis Arquitectónico - BUA Convertidor eXe

**Fecha:** Mayo 2026  
**Objetivo:** Refactorización arquitectónica conservadora  
**Estado:** ANÁLISIS (Sin cambios de código)

---

## 1. DIAGNÓSTICO ARQUITECTÓNICO

### 1.1 Estado Actual del Sistema

El sistema actual funciona correctamente pero concentra **demasiadas responsabilidades en un único módulo**.

```
src/core/docxToElpx.ts (1,113 líneas)
  ├── Parsing de DOCX (Mammoth)
  ├── Transformación HTML
  ├── Análisis de estructura H1/H2/H3
  ├── Generación de XML eXeLearning
  ├── Construcción de ZIP (ELPX)
  ├── Carga de themes
  ├── Generación de preview HTML
  └── Orquestación general
```

### 1.2 Problemas Identificados

#### **P1: Acoplamiento excesivo (CRÍTICO)**

**`docxToElpx.ts` depende de:**
- `fflate` (ZIP - bajo nivel)
- `mammoth` (DOCX - bajo nivel)
- `buildFromStructure.ts` (procesamiento HTML)
- Sistema de temas (carga dinámica)
- DOMParser (parsing HTML)

**Resultado:** Cambios en cualquier parte requieren entender el archivo completo.

#### **P2: Responsabilidades mezcladas (ALTO)**

El archivo maneja:
- **Lectura:** DOCX → Buffer (I/O)
- **Parsing:** HTML parsing (DOM)
- **Transformación:** Aplicar clases BUA (semántica)
- **Mapeo:** HTML → estructura eXe (lógica documental)
- **Generación:** Proyecto → XML (rendering)
- **Packeting:** XML → ZIP (serialización)

Sin límites claros entre fases.

#### **P3: Capas implícitas no declaradas (MEDIO)**

El código ya actúa como si tuviera capas, pero **no están explícitas:**

- Hay un "parser implícito" (líneas 145-303: `buildProjectFromHtml`)
- Hay un "renderer implícito" (líneas 478-790: `buildElpxFromTemplate` + XML generation)
- Hay un "semantic model implícito" (`ImportedProject` / `ImportedPage` / `ImportedBlock`)

**Problema:** La arquitectura existe pero está oculta en el código procedural.

#### **P4: Difícil testabilidad (MEDIO)**

No hay forma fácil de:
- Testear parsing DOCX sin generar ZIP
- Testear transformación HTML sin DOCX
- Testear XML generation sin tema
- Testear tema loading sin conversión completa

#### **P5: Extensibilidad limitada (FUTURO)**

Si en Phase 2 queremos agregar PDF export:
- ¿Duplicamos toda la lógica de HTML parsing?
- ¿Compartimos el modelo semántico pero con otro renderer?
- ¿Cómo reutilizamos el transformador HTML?

**Respuesta actual:** No hay forma limpia. Habría acoplamiento masivo.

---

## 2. CAPAS IMPLÍCITAS DETECTADAS

El código ACTUAL ya contiene una arquitectura de capas, pero está **enmascarada**.

### 2.1 Capa 1: INPUT READING (I/O)

**Ubicación:** `convertDocxToElpx()` líneas 14-52, `extractDocxHtml()` líneas 126-142

**Responsabilidad:**
- Leer buffer de File
- Usar Mammoth para extraer HTML
- Retornar HTML string

**Código implícito:**
```typescript
File → Buffer → Mammoth → HTML string
```

**Está mezclado con:** Orquestación (líneas 27-51 tienen callbacks de progreso)

---

### 2.2 Capa 2: HTML TRANSFORMATION (Semántica)

**Ubicación:** `buildFromStructure.ts` completo

**Responsabilidad:**
- Aplicar clases BUA ([ejemplo], [fin], [horizontal], [vertical])
- Detectar y clasificar tablas
- Aplicar reglas de clasificación semántica

**Código implícito:**
```typescript
HTML string → HTML string (con clases BUA aplicadas)
```

**Está limpio aquí:** Este módulo ya está bien separado.

---

### 2.3 Capa 3: SEMANTIC MODELING (Análisis)

**Ubicación:** `buildProjectFromHtml()` líneas 145-303

**Responsabilidad:**
- Parsear estructura H1/H2/H3 del HTML
- Construir árbol de páginas y bloques
- Aplicar reglas de heading mode (page/block)
- Mapear contenido HTML a estructura eXeLearning

**Código implícito:**
```typescript
HTML string (con delimitadores H1/H2/H3) 
  → ImportedProject
    → ImportedPage[]
      → ImportedBlock[]
```

**Está mezclado con:** Lógica procedural compleja (líneas 159-273 es una máquina de estados implícita)

**Modelo implícito:**
```typescript
interface ImportedProject {
  pages: ImportedPage[]
}

interface ImportedPage {
  title, level, parentIndex
  blocks: ImportedBlock[]
}

interface ImportedBlock {
  title, html
}
```

---

### 2.4 Capa 4: THEME LOADING (Recursos)

**Ubicación:** `convertDocxToElpx()` líneas 35-42, `loadBaseTemplate()`, `loadThemeEntries()`

**Responsabilidad:**
- Cargar plantilla base eXeLearning
- Cargar tema personalizado si existe
- Retornar archivos como Record<string, Uint8Array>

**Código implícito:**
```typescript
themeId → ZIP entries (Dict of files)
```

**Está mezclado con:** Orquestación

---

### 2.5 Capa 5: RENDERING (XML Generation)

**Ubicación:** `buildElpxFromTemplate()` líneas 478-489, `generateContentXml()` líneas 673-707, `generateOdeNavStructureXml()` líneas 716-733

**Responsabilidad:**
- Tomar `ImportedProject` + `template entries`
- Generar `content.xml` (página/bloque eXeLearning)
- Generar `ode.xml` (estructura eXeLearning)
- Insertar en ZIP template
- Retornar ZIP final

**Código implícito:**
```typescript
ImportedProject + Theme entries 
  → XML documents
    → ZIP template (mutado)
      → ELPX (Uint8Array)
```

**Está mezclado con:** ZIP manipulation directo

---

### 2.6 Capa 6: PREVIEW GENERATION (Output alternativo)

**Ubicación:** `buildStandalonePreviewPages()` líneas 490-503, `generatePreviewPageHtml()` líneas 851-887

**Responsabilidad:**
- Generar HTML standalone para preview
- Inyectar CSS inline
- Resolver assets del tema
- Retornar HTML string por página

**Código implícito:**
```typescript
ImportedProject + Theme entries
  → Preview HTML (Record<filename, htmlString>)
```

**Está mezclado con:** Rendering de ELPX

---

## 3. IDENTIFICACIÓN DE ACOPLAMIENTO

### 3.1 Flujo de datos actual

```
File
  ↓ (readFile + Mammoth)
HTML string
  ↓ (applyDivClasses + applyTableClasses)
HTML with classes
  ↓ (buildProjectFromHtml) [MÁQUINA DE ESTADOS IMPLÍCITA]
ImportedProject
  ↓ (loadBaseTemplate + loadThemeEntries)
ImportedProject + Theme entries
  ↓ (buildElpxFromTemplate + XML generation)
ELPX (Uint8Array)
  ↓ (blob creation)
ImportToElpxResult
```

### 3.2 Problemas de acoplamiento

| Acoplamiento | Ubicación | Riesgo |
|--------------|-----------|--------|
| HTML parser depende de Mammoth | `convertDocxToElpx()` | Si cambiamos Mammoth, todo se rompe |
| Proyecto depende de theme | `convertProjectToElpx()` | No se puede renderizar sin theme |
| XML depends on hardcoded IDs | `generateContentXml()` | Generación de IDs frágil |
| Preview genera HTML extra | `buildStandalonePreviewPages()` | Lógica de rendering duplicada |
| Options de heading inline | `buildProjectFromHtml()` | Máquina de estados sin claridad |

---

## 4. MODELO ACTUAL vs MODELO DESEADO

### 4.1 Actual (Procedural)

```typescript
async function convertDocxToElpx(file, options) {
  // Step 1: Read
  const buffer = await file.arrayBuffer();
  
  // Step 2: Parse
  const html = await extractDocxHtml(buffer);
  
  // Step 3: Transform
  const htmlWithClasses = applyDivClasses(html);
  
  // Step 4: Model
  const project = buildProjectFromHtml(htmlWithClasses, options);
  
  // Step 5: Load theme
  const theme = await loadBaseTemplate();
  
  // Step 6: Render
  const elpx = buildElpxFromTemplate(project, theme);
  
  // Step 7: Package
  return createBlob(elpx);
}
```

**Problema:** Responsabilidades saltan entre funciones sin contexto claro.

---

### 4.2 Deseado (Capas explícitas)

```typescript
// Abstract layer: Semantic model
interface SemanticDocument {
  title: string;
  pages: SemanticPage[];
  // ... metadata ...
}

// Separate concerns:
async function convertDocxToElpx(file, options) {
  // 1. INPUT: Read file
  const docStream = await parseDocxFile(file);
  
  // 2. TRANSFORM: Apply semantics
  const transformedDoc = applySemanticRules(docStream);
  
  // 3. MODEL: Build semantic document
  const semanticDoc = buildSemanticDocument(transformedDoc, options);
  
  // 4. RENDER: Choose renderer
  const renderer = new ElpxRenderer();
  const elpx = await renderer.render(semanticDoc, theme);
  
  // 5. OUTPUT: Return result
  return createExportResult(elpx);
}
```

**Ventaja:** Cada capa es independiente, testeable, extensible.

---

## 5. ARQUITECTURA PROPUESTA

### 5.1 Estructura de carpetas

```
src/core/
├── models/                          # Modelo semántico
│   ├── SemanticDocument.ts          # Core semantic model
│   ├── SemanticPage.ts              # Page representation
│   └── SemanticBlock.ts             # Block representation
│
├── parsers/                         # Transformación DOCX → HTML
│   ├── DocxParser.ts                # Extract HTML from DOCX
│   └── DocumentStructureParser.ts   # Parse H1/H2/H3
│
├── transformers/                    # HTML → Semantic
│   ├── HtmlTransformer.ts           # Apply classes, clean HTML
│   └── SemanticClassifier.ts        # Detect BUA classes
│
├── renderers/                       # Semantic → Output
│   ├── Renderer.ts                  # Interface base
│   └── elpx/
│       ├── ElpxRenderer.ts          # ELPX-specific rendering
│       ├── ContentXmlBuilder.ts     # Generate content.xml
│       └── OdeXmlBuilder.ts         # Generate ode.xml
│
├── services/                        # Cross-cutting concerns
│   ├── ThemeService.ts              # Load & manage themes
│   └── PreviewService.ts            # Generate preview HTML
│
├── utils/                           # Helpers
│   ├── HtmlUtils.ts                 # HTML manipulation
│   ├── XmlUtils.ts                  # XML escaping, generation
│   ├── ZipUtils.ts                  # ZIP creation
│   └── IdGenerator.ts               # ID generation
│
└── docxToElpx.ts                    # Orchestrator (simplified)
```

### 5.2 Responsabilidades claras

| Módulo | Responsabilidad | Input | Output |
|--------|-----------------|-------|--------|
| **DocxParser** | Leer DOCX → HTML limpio | File + Mammoth | HTML string |
| **HtmlTransformer** | Aplicar clases BUA | HTML | HTML (con clases) |
| **DocumentStructureParser** | Detectar H1/H2/H3 | HTML | DocumentStructure |
| **SemanticClassifier** | Clasificar contenido semántico | HTML + structure | Clasificaciones |
| **SemanticDocumentBuilder** | Construir modelo | Classified HTML + options | SemanticDocument |
| **ElpxRenderer** | Renderizar a ELPX | SemanticDocument + theme | ELPX bytes |
| **ThemeService** | Cargar themes | themeId | Theme files |
| **PreviewService** | Generar preview | SemanticDocument + theme | HTML pages |

### 5.3 Flujo de datos claro

```
DOCX file
    ↓
DocxParser.parse()
    ↓
HTML string
    ↓
HtmlTransformer.apply()
    ↓
HTML (transformed)
    ↓
DocumentStructureParser.parse()
    ↓
DocumentStructure
    ↓
SemanticClassifier.classify()
    ↓
ClassifiedContent
    ↓
SemanticDocumentBuilder.build(options)
    ↓
SemanticDocument
    ↓
ThemeService.load(themeId)
    ↓
Theme
    ↓
ElpxRenderer.render(semantic + theme)
    ↓
ELPX (Uint8Array)
    ↓
ExportResult
```

---

## 6. IDENTIFICACIÓN DE RIESGOS

### 6.1 Riesgos de la refactorización

| Riesgo | Severidad | Mitigación |
|--------|-----------|-----------|
| Cambio en XML generado | CRÍTICA | Snapshots de ELPX + comparación binaria |
| Comportamiento H1/H2/H3 diferente | CRÍTICA | Tests con múltiples DOCX + outputs iguales |
| Pérdida de clases BUA | ALTA | Validación de HTML generado |
| Theme loading roto | ALTA | Test con todos los themes incluidos |
| Preview generation error | MEDIA | Visual regression testing |
| Performance degradation | MEDIA | Benchmarking antes/después |

### 6.2 Puntos críticos que NO deben cambiar

1. **Salida ELPX:** Estructura XML interna debe ser idéntica
2. **Comportamiento H1/H2/H3:** Mismo mapeo a páginas/bloques
3. **Clases BUA:** Mismo reconocimiento y aplicación
4. **Theme system:** Mismo loading y aplicación
5. **Preview HTML:** Visualmente idéntico (excepto cambios menores permitidos)

---

## 7. PLAN INCREMENTAL DE MIGRACIÓN

### Fase 0: Preparación (Sin código)

- ✅ Análisis arquitectónico (este documento)
- [ ] Crear suite de tests de regresión
- [ ] Generar snapshots de referencia
- [ ] Documentar casos de prueba críticos

### Fase 1: Extraer Parser (Semana 1)

**Cambios mínimos:**
- Crear `parsers/DocxParser.ts` con `extractDocxHtml()`
- Mover de `docxToElpx.ts`
- Verificar output idéntico

**Validación:**
- Comparar HTML output (byte-level)
- Tests de regresión DOCX → HTML

**Riesgo:** BAJO

---

### Fase 2: Extraer Transformador (Semana 1)

**Cambios mínimos:**
- Crear `transformers/HtmlTransformer.ts`
- Mover `applyDivClasses` + `applyTableClasses`
- Crear interfaz `HtmlTransformer`

**Validación:**
- Comparar HTML transformado
- Tests de clases BUA

**Riesgo:** BAJO

---

### Fase 3: Extraer Model Semántico (Semana 2)

**Cambios mínimos:**
- Crear `models/SemanticDocument.ts`
- Definir interfaces explícitamente
- Mover `ImportedProject` / `ImportedPage` / `ImportedBlock`

**Validación:**
- Mismos tipos, mismo comportamiento
- Tests de estructura

**Riesgo:** BAJO

---

### Fase 4: Extraer Semantic Builder (Semana 2)

**Cambios MÁS complejos:**
- Extraer `buildProjectFromHtml()` a `SemanticDocumentBuilder.ts`
- Refactorizar máquina de estados implícita
- Mantener comportamiento idéntico

**Validación:**
- Comparar `ImportedProject` output
- Tests exhaustivos de H1/H2/H3 combinaciones
- Tests de edge cases

**Riesgo:** CRÍTICA (máquina de estados compleja)

---

### Fase 5: Extraer Renderer (Semana 3)

**Cambios complejos:**
- Crear `renderers/elpx/ElpxRenderer.ts`
- Extraer XML generation a `ContentXmlBuilder.ts`
- Crear interfaz `Renderer`

**Validación:**
- Comparar ELPX byte-a-byte
- Comparar XML interno
- Theme loading tests

**Riesgo:** CRÍTICA (generación XML frágil)

---

### Fase 6: Extraer Theme Service (Semana 3)

**Cambios simples:**
- Crear `services/ThemeService.ts`
- Mover `loadBaseTemplate` + `loadThemeEntries`
- Crear interfaz limpia

**Validación:**
- Tests de carga de temas
- Tests de fallback

**Riesgo:** MEDIA

---

### Fase 7: Extraer Preview Service (Semana 4)

**Cambios medianos:**
- Crear `services/PreviewService.ts`
- Mover `buildStandalonePreviewPages` + `generatePreviewPageHtml`
- Reutilizar desde ElpxRenderer

**Validación:**
- HTML preview visualmente idéntico
- Tests de asset resolution

**Riesgo:** MEDIA

---

### Fase 8: Orquestador Simplificado (Semana 4)

**Cambios finales:**
- Simplificar `docxToElpx.ts`
- Ahora es solo coordinador
- Llamar a servicios en orden

**Validación:**
- Flujo completo DOCX → ELPX
- Comparar resultado final con original
- Tests de integración

**Riesgo:** BAJA

---

## 8. ESTRATEGIA DE VALIDACIÓN/REGRESIÓN

### 8.1 Tests de referencia a capturar ANTES de refactorizar

```typescript
// 1. Snapshot del HTML parsing
const testCases = [
  'simple.docx',
  'with-tables.docx',
  'with-images.docx',
  'with-headings.docx',
  'with-classes.docx',  // [ejemplo], [definicion], etc
];

// 2. Snapshot del modelo semántico
for each testCase:
  - DOCX → ImportedProject
  - Comparar estructura
  - Comparar contenido

// 3. Snapshot del ELPX generado
for each testCase:
  - DOCX → ELPX
  - Extraer ZIP
  - Comparar content.xml
  - Comparar ode.xml

// 4. Tests de regresión visual
for each testCase + each theme:
  - Generar preview
  - Capturar HTML
  - Comparar contra referencia
```

### 8.2 Validación durante refactorización

**Después de cada fase:**
1. Ejecutar snapshots test
2. Verificar output idéntico
3. No proceder si hay diferencias
4. Si hay diferencias menores "aceptables", documentar

**Herramientas recomendadas:**
- Jest snapshots para comparación
- Binary comparison para ELPX
- Visual regression (opcional) para preview

### 8.3 Checklist de validación final

- [ ] ELPX generado es byte-identical al original
- [ ] content.xml es idéntico
- [ ] ode.xml es idéntico
- [ ] Preview HTML visualmente igual
- [ ] Todos los themes funcionan
- [ ] H1/H2/H3 comportamiento idéntico
- [ ] Clases BUA aplicadas correctamente
- [ ] Imágenes incrustadas funcionan
- [ ] Tablas clasificadas correctamente

---

## 9. BENEFICIOS ESPERADOS

### 9.1 Mantenibilidad

- **Antes:** 1,113 líneas en un archivo
- **Después:** ~200 líneas dispersas en módulos cohesionados
- **Ganancia:** Entendibilidad, localidad, cambios seguros

### 9.2 Testabilidad

- **Antes:** Difícil testear parser sin ELPX
- **Después:** Cada capa independiente, testeable
- **Ganancia:** Tests unitarios + regresión fuerte

### 9.3 Extensibilidad

- **Antes:** Agregar PDF requeriría duplicación masiva
- **Después:** Solo crear `renderers/pdf/PdfRenderer.ts`
- **Ganancia:** Reutilización de parser, transformer, model

### 9.4 Claridad Arquitectónica

- **Antes:** Arquitectura implícita en procedimiento
- **Después:** Capas explícitas, responsabilidades claras
- **Ganancia:** Nuevos desarrolladores entienden rápido

---

## 10. CONSIDERACIONES ESPECIALES

### 10.1 Módulos que NO necesitan cambios

- `buildFromStructure.ts` - Ya está bien separado
- `parseStructure.ts` - Ya está limpio
- Componentes React - Intactos

### 10.2 Cambios que NO haremos

- Reescribir lógica de H1/H2/H3
- Cambiar modelo `ImportedProject` (mantener compatible)
- Modificar XML schema
- Cambiar tema loading

### 10.3 Cambios que SÍ haremos

- Mover código a módulos cohesionados
- Clarificar responsabilidades
- Extraer máquina de estados implícita
- Crear interfaces explícitas
- Reducir acoplamiento

---

## 11. PRÓXIMOS PASOS

### Antes de implementar

1. **Crear test suite de regresión**
   - Snapshots de parsing
   - Snapshots de modelo
   - Snapshots de ELPX

2. **Documentar casos críticos**
   - Todas las combinaciones H1/H2/H3
   - Todos los themes
   - Edge cases

3. **Confirmar arquitectura propuesta**
   - ¿La estructura de carpetas es clara?
   - ¿Las responsabilidades están bien definidas?
   - ¿Faltan módulos?

4. **Aprobar plan de migración**
   - ¿Order es correcto?
   - ¿Riesgos mitigados?
   - ¿Timeline realista?

---

## RESUMEN EJECUTIVO

**La aplicación actual es funcional pero arquitectónicamente frágil.**

**Problema:** Demasiadas responsabilidades en `docxToElpx.ts` hacen que:
- Sea difícil de mantener
- Sea difícil de testear
- Sea difícil de extender

**Solución:** Refactorización conservadora que:
- Extrae capas implícitas
- Clarifica responsabilidades
- Mantiene comportamiento idéntico
- Prepara para Phase 2 (PDF)

**Riesgo:** BAJO si seguimos plan incremental + validación

**Ganancia:** ALTA en mantenibilidad, testabilidad, extensibilidad

---

**Documento preparado para review y aprobación antes de implementación.**
