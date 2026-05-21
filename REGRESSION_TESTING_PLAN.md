# 🧪 Plan de Testing de Regresión - Refactorización Arquitectónica

**Objetivo:** Validar que cada fase de refactorización mantiene equivalencia funcional con el código original.

**Estado:** SETUP INICIAL (Phase 0)

---

## 1. ESTRATEGIA DE VALIDACIÓN

### 1.1 Tres niveles de verificación

```
Nivel 1: BINARY HASH (ZIP idéntico byte-a-byte)
  ↓ Si falla → Error crítico (no puede haber cambios en output)
  ↓ Si pasa → Todas las fases pasadas

Nivel 2: SEMANTIC VALIDATION (Estructura XML y contenido)
  ↓ Si falla → Error funcional (comportamiento visible changed)
  ↓ Si pasa → Refactor mantiene equivalencia semántica

Nivel 3: REGRESSION SUITE (Tests específicos por fase)
  ↓ Si falla → Regresión detectada en esa fase
  ↓ Si pasa → Fase lista para siguiente iteración
```

### 1.2 Fixtures para testing

**Documentos de prueba necesarios:**

1. **simple.docx** - Documento mínimo
   - 1 H1, 1 párrafo de contenido
   - Test: Verificar estructura basic

2. **multipage.docx** - Documento con páginas
   - 3 H1s, varios H2s, contenido variado
   - Test: Jerarquía H1/H2/H3 correcta

3. **semantic.docx** - Documento con delimitadores BUA
   - [ejemplo]...[fin]
   - [definición]...[fin]
   - [importante]...[fin]
   - Test: Clases BUA aplicadas correctamente

4. **tables.docx** - Documento con tablas
   - [horizontal] <table>
   - [vertical] <table>
   - Test: Clases bua_tabla_* aplicadas

5. **themed.docx** - Documento para tests con temas
   - Usar diferentes temas
   - Test: Cada tema genera ELPX diferente pero válido

---

## 2. BASELINE SNAPSHOT (Primera ejecución)

### 2.1 Crear snapshots de referencia

**Para cada fixture:**
1. Convertir DOCX → ELPX (versión actual)
2. Guardar ELPX en `tests/snapshots/baseline/`
3. Extraer checksums de archivos clave:
   - `content.xml` (hash SHA-256)
   - `ode.xml` (hash SHA-256)
   - ZIP completo (hash SHA-256)
4. Almacenar en `tests/regression-checksums.json`

**Archivo: `tests/regression-checksums.json`**
```json
{
  "simple.docx": {
    "zip_sha256": "abc123...",
    "content_xml_sha256": "def456...",
    "ode_xml_sha256": "ghi789...",
    "preview_html_size": 15234,
    "generated_at": "2026-05-21T10:30:00Z",
    "version": "baseline-v1"
  },
  "multipage.docx": { ... },
  "semantic.docx": { ... },
  "tables.docx": { ... },
  "themed.docx": { ... }
}
```

---

## 3. VALIDATION SCRIPT (Phase Verification)

### 3.1 Script para ejecutar después de cada fase

**Ubicación:** `tests/validate-regression.ts`

**Pseudocódigo:**
```typescript
async function validatePhase(
  phaseNumber: number,
  fixtureNames: string[]
) {
  const results = [];

  for (const fixture of fixtureNames) {
    // 1. Leer documento de prueba
    const file = readFixture(fixture);

    // 2. Ejecutar conversión (con código refactorizado)
    const result = await convertDocxToElpx(file, defaultOptions);
    const generatedElpx = result.elpxBuffer;

    // 3. Extraer checksums
    const generatedZip = unzipSync(generatedElpx);
    const contentXmlHash = sha256(generatedZip['content.xml']);
    const odeXmlHash = sha256(generatedZip['ode.xml']);
    const zipHash = sha256(generatedElpx);

    // 4. Comparar con baseline
    const baseline = REGRESSION_CHECKSUMS[fixture];
    const passed = 
      zipHash === baseline.zip_sha256 &&
      contentXmlHash === baseline.content_xml_sha256 &&
      odeXmlHash === baseline.ode_xml_sha256;

    results.push({
      fixture,
      passed,
      generated: { contentXmlHash, odeXmlHash, zipHash },
      baseline: baseline,
      timestamp: new Date().toISOString()
    });
  }

  return {
    phaseNumber,
    allPassed: results.every(r => r.passed),
    results,
    reportFile: `tests/phase-${phaseNumber}-report.json`
  };
}
```

### 3.2 Integración con proceso de refactor

**Antes de Phase X:**
1. Hacer backup de código actual
2. Ejecutar `validatePhase(X-1, allFixtures)` para confirmar baseline
3. Ejecutar refactor de Phase X
4. Ejecutar `validatePhase(X, criticalFixtures)` inmediatamente
5. Si falla: revert, investigar, corregir
6. Si pasa: commit con mensaje "Phase X validated"

---

## 4. CHECKLIST POR FASE

### Phase 0 ✅ (SETUP - AHORA)
- [ ] Crear directorio `tests/fixtures/`
- [ ] Crear documentos de prueba (5 fixtures)
- [ ] Ejecutar conversión actual en todos los fixtures
- [ ] Generar `regression-checksums.json` con baseline
- [ ] Crear `validate-regression.ts` script
- [ ] Documentar proceso en README
- [ ] Commit inicial: "Phase 0: Regression testing setup"

### Phase 1 (EXTRACT PARSER)
- [ ] Crear `src/core/parsers/DocxParser.ts`
- [ ] Migrar `extractDocxHtml()` sin cambios funcionales
- [ ] Ejecutar `validatePhase(1, allFixtures)`
- [ ] Verificar checksums idénticos
- [ ] Si pasa: commit "Phase 1: Extract DocxParser"
- [ ] Si falla: rollback y diagnosticar

### Phase 2 (EXTRACT TRANSFORMER)
- [ ] Crear `src/core/transformers/HtmlTransformer.ts`
- [ ] Migrar clases BUA, tabla classification
- [ ] Ejecutar `validatePhase(2, allFixtures)`
- [ ] Commit: "Phase 2: Extract HtmlTransformer"

### Phase 3 (EXTRACT SEMANTIC MODEL)
- [ ] Crear `src/core/models/SemanticDocument.ts`
- [ ] Migrar tipos `ImportedProject`, `ImportedPage`, `ImportedBlock`
- [ ] Ejecutar `validatePhase(3, multipage, semantic)`
- [ ] Commit: "Phase 3: Extract SemanticDocument"

### Phase 4-8
- [ ] Aplicar mismo patrón para cada fase
- [ ] Mantener validación incremental
- [ ] No proceder hasta que Phase anterior pase

---

## 5. ESTRUCTURA DE CARPETAS (POST-REFACTOR)

```
src/core/
├── models/
│   ├── SemanticDocument.ts
│   ├── types.ts
│   └── constants.ts
├── parsers/
│   ├── DocxParser.ts
│   └── DocumentStructureParser.ts
├── transformers/
│   ├── HtmlTransformer.ts
│   └── SemanticClassifier.ts
├── renderers/
│   └── elpx/
│       ├── ElpxRenderer.ts
│       ├── ContentXmlBuilder.ts
│       └── OdeXmlBuilder.ts
├── services/
│   ├── ThemeService.ts
│   └── PreviewService.ts
├── utils/
│   ├── HtmlUtils.ts
│   ├── XmlUtils.ts
│   ├── ZipUtils.ts
│   └── IdGenerator.ts
└── Converter.ts (orchestrator)
```

---

## 6. HERRAMIENTAS NECESARIAS

```bash
# Instalación (si no está):
npm install --save-dev crypto-js
# O usar Node.js crypto built-in

# Para generar fixtures:
npm install --save-dev @types/docx
npm install docx  # para crear DOCXs de prueba

# Scripts en package.json:
"test:regression": "ts-node tests/validate-regression.ts",
"test:baseline": "ts-node tests/generate-baseline.ts",
"test:phase": "ts-node tests/validate-phase.ts"
```

---

## 7. MATRIZ DE DECISIÓN

| Resultado | Acción |
|-----------|--------|
| Phase N pasa checksums | ✅ Continuar a Phase N+1 |
| Phase N falla checksums | 🔴 Revert fase, investigar |
| Falla código antiguo (baseline) | ⚠️ Ajustar fixture/código viejo |
| Pasa parsial (algunos fixtures) | 🟡 Investigar por fixture |

---

## 8. VALIDACIÓN ESPECIAL: TEMAS

**Consideración:** Diferentes temas producen diferentes ELPXs (archivos de tema incluidos)

**Estrategia:**
- Baseline para `theme:base` solamente
- Validar que estructura XML es idéntica
- Validar que archivos de tema se incluyen correctamente
- Aceptar que ZIP total puede diferir (archivos binarios de tema)

**Métricas:**
- SHA-256 de `content.xml` DEBE ser idéntico
- SHA-256 de `ode.xml` DEBE ser idéntico
- ZIP total PUEDE diferir (si tema cambió)

---

## 9. PRÓXIMOS PASOS

**Orden de acciones (Phase 0):**

1. ✅ Crear `REGRESSION_TESTING_PLAN.md` (este archivo)
2. 📋 Crear fixture documents (5 DOCX archivos)
3. 🏗️ Crear `tests/validate-regression.ts` script
4. 📊 Generar `regression-checksums.json` baseline
5. 📝 Actualizar README.md con instrucciones de testing
6. 🔗 Commit: "Phase 0: Regression testing infrastructure"
7. ✔️ **Esperar aprobación antes de Phase 1**

---

**CRITICAL:** No proceder a Phase 1 hasta que:
- Baseline esté generado ✅
- Todos los fixtures pasen ✅
- Validation script esté funcional ✅
- Plan de rollback esté claro ✅
