# 🗺️ Refactoring Roadmap - Estado Actual y Próximos Pasos

**Fecha:** 2026-05-21  
**Estado del Proyecto:** Phase 0 Infrastructure Completado ✅  
**Siguiente Acción:** Phase 0 Execution (Crear fixtures, generar baseline)

---

## 📊 Estado Actual

### ✅ Completado (Phase 0 - Infrastructure)

#### Documentación (4 archivos)
- ✅ **ARCHITECTURAL_ANALYSIS.md** (725 líneas)
  - Diagnóstico arquitectónico completo
  - Identifica 5 problemas críticos en estructura monolítica
  - Documenta 6 capas implícitas ya presentes
  - Propone arquitectura clara con módulos separados
  - Detalla plan de 8 fases con riesgos ordenados

- ✅ **REGRESSION_TESTING_PLAN.md** (320+ líneas)
  - Estrategia de validación en 3 niveles (binary, semantic, regression)
  - Especifica 5 documentos de prueba necesarios
  - Describe proceso de baseline snapshot
  - Incluye matriz de decisión y casos especiales

- ✅ **PHASE_0_SETUP_CHECKLIST.md** (Ejecutable)
  - Checklist paso-a-paso para Phase 0
  - Instrucciones concretas para crear fixtures
  - Procedimiento de generación de baseline
  - Verificación pre-Phase 1

- ✅ **PHASE_1_EXTRACT_PARSER_GUIDE.md** (Implementación)
  - Guía detallada para extraer DocxParser
  - Código antes/después con ejemplos
  - 6 pasos específicos con comandos exactos
  - Métricas de éxito y validación

#### Scripts de Testing (2 archivos)
- ✅ **tests/validate-regression.ts**
  - Validador modular y reutilizable
  - Calcula SHA-256 de XML y ZIP
  - Genera reportes de validación
  - Compara contra baseline

- ✅ **tests/generate-baseline.ts**
  - Inicializador de baseline
  - Crea estructura de directorios
  - Proporciona instrucciones paso-a-paso

#### Directorio Structure
- ✅ `tests/fixtures/` - Ubicación para fixtures DOCX
- ✅ `tests/snapshots/baseline/` - ELPX de referencia
- ✅ `tests/reports/` - Reportes de validación

#### Commit Principal
- ✅ Commit: `8486b0f` "Phase 0: Regression testing infrastructure setup"
- ✅ Pushed to GitHub: main branch

---

## 📋 Próximos Pasos (Tu Responsabilidad)

### PASO 1: Crear 5 Documentos de Prueba (10-15 minutos)

**Ubicación:** `tests/fixtures/`

**Archivos necesarios:**

1. **simple.docx** (Mínimo)
   ```
   # Encabezado Principal
   Contenido simple.
   ```

2. **multipage.docx** (Múltiples H1/H2)
   ```
   # Página 1
   ## Subpágina 1.1
   Contenido
   
   # Página 2
   Contenido página 2
   ```

3. **semantic.docx** (Delimitadores BUA)
   ```
   [ejemplo] ... [fin]
   [definición] ... [fin]
   [importante] ... [fin]
   ```

4. **tables.docx** (Tablas clasificadas)
   ```
   [horizontal]
   | H1 | H2 |
   ...
   [vertical]
   | P1 | V1 |
   ```

5. **themed.docx** (Cualquier contenido)
   - Para probar con diferentes temas

**Cómo crearlos:**
- Opción 1 (Recomendado): Manual en Word/LibreOffice
- Opción 2: Programáticamente con librería `docx`

### PASO 2: Generar Baseline (5 minutos)

```bash
cd /Users/mariofloridoperez/BUA-convertidor-exe

# 1. Ejecutar generador de baseline
npm run test:baseline

# 2. Crear script de conversión (ver PHASE_0_SETUP_CHECKLIST.md)
# O ejecutar manualmente la conversión de cada DOCX

# 3. Verificar que tests/regression-checksums.json se generó
cat tests/regression-checksums.json
```

### PASO 3: Verificar Baseline Completo

```bash
# Debería ver:
# {
#   "simple.docx": { "zip_sha256": "...", ... },
#   "multipage.docx": { ... },
#   ...
# }

# Todos los 5 fixtures deben estar presentes
```

### PASO 4: Commit y Push

```bash
git add tests/fixtures/ tests/regression-checksums.json
git commit -m "Phase 0: Baseline fixtures and checksums

- Create 5 test documents (simple, multipage, semantic, tables, themed)
- Generate baseline checksums (regression-checksums.json)
- All fixtures pass binary validation
- Ready for Phase 1: Extract DocxParser"

git push origin main
```

---

## 🎯 Fase 1 (Después de Phase 0 Completado)

### CUANDO Phase 0 esté listo:

**Condiciones para proceder a Phase 1:**
- ✅ 5 fixtures DOCX creados y válidos
- ✅ Archivo `regression-checksums.json` generado
- ✅ Todos los checksums calculados
- ✅ Phase 0 committed a main
- ✅ Push completado a GitHub

**Phase 1: Extract DocxParser**
- Crear `src/core/parsers/DocxParser.ts`
- Mover lógica de parsing DOCX
- Validar que output es idéntico (byte-a-byte)
- Tiempo: ~30 minutos
- Riesgo: LOW

**PHASE_1_EXTRACT_PARSER_GUIDE.md tiene todos los detalles**

---

## 🔄 Roadmap Completo (8 Fases)

```
Phase 0: Setup Testing Infrastructure ✅ DONE
   └─ Pending: User execution (crear fixtures)

Phase 1: Extract DocxParser 📦 READY (espera Phase 0)
   │  Risk: LOW
   │  Extract: File + Mammoth parsing
   │  New module: src/core/parsers/DocxParser.ts
   │  Validation: Binary-identical output
   └─ ~30 min, LOW risk

Phase 2: Extract HtmlTransformer 📦 PLANNED
   │  Risk: LOW
   │  Extract: applyDivClasses, applyTableClasses
   │  New module: src/core/transformers/HtmlTransformer.ts
   │  Validation: Binary-identical output
   └─ ~30 min, LOW risk

Phase 3: Extract SemanticDocument 📦 PLANNED
   │  Risk: LOW
   │  Extract: ImportedProject, ImportedPage, ImportedBlock types
   │  New modules: src/core/models/
   │  Validation: XML structure identical
   └─ ~20 min, LOW risk

Phase 4: Extract SemanticBuilder 🔴 CRITICAL
   │  Risk: CRITICAL (state machine complexity)
   │  Extract: buildProjectFromHtml (H1/H2/H3 logic)
   │  New module: src/core/transformers/SemanticBuilder.ts
   │  Validation: Careful testing required
   └─ ~45 min, CRITICAL risk

Phase 5: Extract ElpxRenderer 🔴 CRITICAL
   │  Risk: CRITICAL (XML generation fragile)
   │  Extract: buildElpxFromTemplate, XML generation
   │  New modules: src/core/renderers/elpx/
   │  Validation: XML byte-identical
   └─ ~45 min, CRITICAL risk

Phase 6: Extract ThemeService 📦 MEDIUM
   │  Risk: MEDIUM
   │  Extract: loadBaseTemplate, loadThemeEntries
   │  New module: src/core/services/ThemeService.ts
   └─ ~25 min, MEDIUM risk

Phase 7: Extract PreviewService 📦 MEDIUM
   │  Risk: MEDIUM
   │  Extract: buildStandalonePreviewPages, preview HTML
   │  New module: src/core/services/PreviewService.ts
   └─ ~25 min, MEDIUM risk

Phase 8: Simplify Orchestrator 📦 LOW
   │  Risk: LOW
   │  Simplify: convertDocxToElpx main orchestration
   │  Result: Clean, testable orchestrator
   └─ ~20 min, LOW risk

TOTAL: ~290 minutos (5 horas) para refactorización completa
```

---

## 📊 Estructura Después de Refactorización

```
src/core/
├── models/
│   ├── SemanticDocument.ts       (tipos + interfaces)
│   ├── constants.ts              (constantes BUA)
│   └── types.ts                  (tipos compartidos)
│
├── parsers/
│   ├── DocxParser.ts             (DOCX → HTML)
│   └── DocumentStructureParser.ts (HTML → estructura)
│
├── transformers/
│   ├── HtmlTransformer.ts        (clases BUA, tablas)
│   ├── SemanticBuilder.ts        (H1/H2/H3 → proyecto)
│   └── SemanticClassifier.ts     (reglas de clasificación)
│
├── renderers/
│   └── elpx/
│       ├── ElpxRenderer.ts       (proyecto → ELPX)
│       ├── ContentXmlBuilder.ts  (content.xml generation)
│       └── OdeXmlBuilder.ts      (ode.xml generation)
│
├── services/
│   ├── ThemeService.ts           (temas + ZIP)
│   └── PreviewService.ts         (preview HTML)
│
├── utils/
│   ├── HtmlUtils.ts              (HTML manipulation)
│   ├── XmlUtils.ts               (XML generation)
│   ├── ZipUtils.ts               (ZIP operations)
│   └── IdGenerator.ts            (ID generation)
│
├── buildFromStructure.ts         (YA EXISTENTE - no cambiar)
├── parseStructure.ts             (YA EXISTENTE - no cambiar)
└── Converter.ts                  (orchestrator limpio)
```

---

## 🎯 Beneficios de Esta Refactorización

### Mantenibilidad ⬆️
- Módulos con única responsabilidad
- Interfaces claras entre componentes
- Código más legible y documentable

### Testabilidad ⬆️
- Cada componente testeable independientemente
- Fácil crear tests unitarios
- Validación de regresión integrada

### Extensibilidad ⬆️
- Agregar PDF export sin duplicar código
- Soportar múltiples formatos entrada (Google Docs, etc)
- Reutilizar modelo semántico

### Seguridad ⬆️
- Refactorización validada con regresión
- Cero cambios en comportamiento visible
- Binary-identical validation como garantía

---

## 🚨 Puntos Críticos

### ✋ NO MODIFIQUES DIRECTAMENTE:
- `tests/regression-checksums.json` (es la fuente de verdad)
- `tests/snapshots/baseline/` (son referencias)
- `buildFromStructure.ts` (ya está limpio)
- `parseStructure.ts` (ya está limpio)

### ✅ NECESITAS HACER:
- Crear 5 fixtures DOCX
- Ejecutar baseline generation
- Commit Phase 0
- Proceder a Phase 1

---

## 📞 Preguntas Frecuentes

**P: ¿Cuánto tiempo tarda todo?**
R: ~6 horas total (si haces fase por fase)

**P: ¿Puedo hacer múltiples fases en paralelo?**
R: No, cada fase depende de la anterior

**P: ¿Qué pasa si falla validación?**
R: Revert cambios, investigar diferencia, fix, reintentar

**P: ¿Necesito hacer todo?**
R: No, puedes parar en cualquier fase completada

**P: ¿Se puede usar el código durante refactorización?**
R: Sí, cada fase es independiente y validada

**P: ¿Qué pasa si ignoro validación?**
R: Riesgo de regresar bugs a usuarios

---

## ✅ Checklist Actual

**Phase 0 (CURRENT):**
- [x] Crear documentación arquitectónica
- [x] Crear plan de testing
- [x] Crear scripts de validación
- [x] Crear estructura de directorios
- [x] Commit infrastructure a GitHub
- [ ] ⏳ Crear 5 fixtures DOCX (TU RESPONSABILIDAD)
- [ ] ⏳ Generar baseline checksums (TU RESPONSABILIDAD)
- [ ] ⏳ Commit Phase 0 completo (TU RESPONSABILIDAD)

**Phase 1 (READY, espera Phase 0):**
- [ ] Crear DocxParser.ts
- [ ] Validar regresión
- [ ] Commit Phase 1

---

## 🎯 Próximo Paso Inmediato

**Acción:** Ejecutar Phase 0 (crear fixtures y baseline)

**Tiempo:** ~20 minutos

**Instrucciones:** Ver `PHASE_0_SETUP_CHECKLIST.md`

**Resultado:** Proyecto listo para Phase 1

---

**Status:** 🟢 TODO LISTO PARA PHASE 0 EXECUTION

Cuando completes Phase 0, notifícame y procedemos con Phase 1.
