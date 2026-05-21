# ✅ Phase 0: Regression Testing Setup - Checklist

**Status:** READY FOR EXECUTION  
**Date:** 2026-05-21  
**Objetivo:** Establecer infraestructura de validación ANTES de refactorizar

---

## 📋 Items Completados

### A. Documentación (DONE ✅)
- [x] `ARCHITECTURAL_ANALYSIS.md` (725 líneas) - Análisis completo
- [x] `REGRESSION_TESTING_PLAN.md` (300+ líneas) - Plan detallado
- [x] `PHASE_0_SETUP_CHECKLIST.md` (este archivo)

### B. Infraestructura de Directorios (DONE ✅)
- [x] Crear `tests/fixtures/` - Documentos de prueba
- [x] Crear `tests/snapshots/baseline/` - ELPXs de referencia
- [x] Crear `tests/reports/` - Reportes de validación

### C. Scripts de Validación (DONE ✅)
- [x] `tests/validate-regression.ts` - Validador modular
- [x] `tests/generate-baseline.ts` - Generador de baseline

### D. Configuración de Package.json (PENDING ⏳)
- [ ] Agregar scripts en `package.json`:
  ```json
  {
    "test:regression": "ts-node tests/validate-regression.ts",
    "test:baseline": "ts-node tests/generate-baseline.ts",
    "test:phase": "ts-node tests/validate-phase.ts"
  }
  ```

### E. Documento de Conversión de Fixtures (PENDING ⏳)
- [ ] Crear `tests/convert-fixtures.ts` - Convertir DOCX → baseline

---

## 🎯 Items Pendientes (Para Usuario)

### 1. Crear Documentos de Prueba (CRÍTICO)

**Ubicación:** `tests/fixtures/` - Necesitas estos 5 archivos DOCX:

#### a) **simple.docx** (Documento mínimo)
```
# Encabezado Principal
Contenido simple del documento.
```
**Propósito:** Test de estructura básica H1 → página

#### b) **multipage.docx** (Múltiples páginas)
```
# Página 1
## Subpágina 1.1
Contenido 1.1
## Subpágina 1.2
Contenido 1.2

# Página 2
Contenido página 2

# Página 3
## Subpágina 3.1
Contenido 3.1
```
**Propósito:** Test de jerarquía H1/H2/H3 compleja

#### c) **semantic.docx** (Delimitadores BUA)
```
# Conceptos

[ejemplo]
Este es un ejemplo de código o concepto.
[fin]

[definición]
Definición clara de un término importante.
[fin]

[importante]
Nota muy importante que el estudiante debe entender.
[fin]
```
**Propósito:** Test de clases BUA (ejemplo, definición, importante)

#### d) **tables.docx** (Tablas clasificadas)
```
# Tablas Horizontales

[horizontal]
| Encabezado 1 | Encabezado 2 |
|---|---|
| Celda 1 | Celda 2 |
| Celda 3 | Celda 4 |
[fin]

# Tablas Verticales

[vertical]
| Propiedad | Valor |
|---|---|
| Color | Rojo |
| Tamaño | Grande |
[fin]
```
**Propósito:** Test de clasificación de tablas

#### e) **themed.docx** (Documento cualquiera con tema)
```
# Documento para Temas

## Sección 1
[ejemplo]
Este documento se convertirá con diferentes temas.
[fin]

## Sección 2
Contenido normal que debe aparecer igual en todos los temas.

[importante]
La apariencia visual cambia, pero estructura es idéntica.
[fin]
```
**Propósito:** Test de independencia de XML vs. tema

### ✋ CÓMO CREARLOS:

**Opción 1 (Recomendado):** Manual en Word/LibreOffice
- Crea archivos DOCX simples
- Coloca en `tests/fixtures/`

**Opción 2:** Programáticamente con `docx` library
```bash
npm install docx
```
Luego crea script que genere documentos.

---

## 🚀 Procedimiento Ejecutable (Paso a Paso)

### PASO 1: Preparar fixtures (10 minutos)

```bash
# Entrar al directorio
cd /Users/mariofloridoperez/BUA-convertidor-exe

# Verificar que directorio tests/ existe
ls -la tests/

# Debería mostrar:
# fixtures/
# reports/
# snapshots/
# generate-baseline.ts
# validate-regression.ts
```

**✋ ACCIÓN MANUAL:** 
- Crea 5 archivos DOCX (simple.docx, multipage.docx, etc.)
- Colócalos en `tests/fixtures/`

### PASO 2: Generar baseline (10 minutos)

```bash
# Ejecutar generador (crea estructura vacía)
npm run test:baseline

# Debería mostrar:
# ✅ Creado: tests/regression-checksums.json
# ✅ Creado: tests/snapshots/baseline/
```

### PASO 3: Crear checksums iniciales (5 minutos)

**✋ ACCIÓN:** Crear script `tests/convert-fixtures.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { convertDocxToElpx } from '../src/core/docxToElpx';
import { extractChecksums, loadChecksums, saveChecksums } 
  from './validate-regression';

const fixturesDir = path.join(__dirname, 'fixtures');
const checksumsPath = path.join(__dirname, 'regression-checksums.json');

async function generateBaseline() {
  const checksums = loadChecksums(checksumsPath);
  const fixtures = fs.readdirSync(fixturesDir)
    .filter(f => f.endsWith('.docx'));

  for (const fixture of fixtures) {
    const filePath = path.join(fixturesDir, fixture);
    const file = new File(
      [fs.readFileSync(filePath)],
      fixture,
      { type: 'application/vnd.openxmlformats' }
    );

    try {
      const result = await convertDocxToElpx(file, {
        theme: 'base',
        h1Mode: 'page',
        h2Mode: 'block'
      });

      const checksumEntry = extractChecksums(result.elpxBuffer, fixture);
      checksums[fixture] = checksumEntry;

      console.log(`✅ ${fixture} - Checksums generados`);
    } catch (err) {
      console.error(`❌ ${fixture} - Error: ${err}`);
    }
  }

  saveChecksums(checksumsPath, checksums);
  console.log('🎉 Baseline completado');
}

generateBaseline();
```

**Ejecutar:**
```bash
npm run test:baseline:convert
```

### PASO 4: Verificar baseline (2 minutos)

```bash
# Ver checksums generados
cat tests/regression-checksums.json

# Debería mostrar algo como:
# {
#   "simple.docx": {
#     "zip_sha256": "abc123...",
#     "content_xml_sha256": "def456...",
#     ...
#   }
# }
```

### PASO 5: Commit baseline (2 minutos)

```bash
# Agregar archivos
git add tests/
git add REGRESSION_TESTING_PLAN.md
git add PHASE_0_SETUP_CHECKLIST.md

# Commit
git commit -m "Phase 0: Regression testing infrastructure

- Create tests/ directory structure
- Add validate-regression.ts validation script  
- Add generate-baseline.ts baseline generator
- Add regression testing plan (REGRESSION_TESTING_PLAN.md)
- Add Phase 0 setup checklist (PHASE_0_SETUP_CHECKLIST.md)
- Establish baseline checksums for all fixtures
- Ready for Phase 1: Extract DocxParser"

# Push
git push origin main
```

---

## 📊 Verification Checklist

**Antes de continuar a Phase 1, verifica:**

- [ ] Directorio `tests/fixtures/` tiene 5 archivos DOCX
- [ ] Archivo `tests/regression-checksums.json` contiene checksums
- [ ] Todos los fixtures tienen entrada en checksums
- [ ] Script `npm run test:phase` ejecutable sin errores
- [ ] Archivo `tests/reports/` vacío pero listo
- [ ] `REGRESSION_TESTING_PLAN.md` committed
- [ ] `PHASE_0_SETUP_CHECKLIST.md` committed
- [ ] Branch limpio: `git status` muestra nada sin commitear

---

## 🔄 Workflow de Validación por Fase

**Para cada fase de refactorización:**

```
1. ANTES: Crear rama para Phase N
   git checkout -b phase-N-extract-X

2. DURANTE: Refactorizar preservando comportamiento
   - Extraer módulo X
   - Mantener interfaces idénticas
   - Validar internamente

3. DESPUÉS: Ejecutar validación
   npm run test:phase N simple.docx
   npm run test:phase N multipage.docx
   npm run test:phase N semantic.docx
   npm run test:phase N tables.docx
   npm run test:phase N themed.docx

4. RESULTADO: 
   ✅ Todos pasan → Continuar a Phase N+1
   ❌ Alguno falla → Investigar y revert

5. COMMIT:
   git commit -m "Phase N: Extract X [VALIDATED]"

6. MERGE:
   git checkout main
   git merge phase-N-extract-X
   git push origin main
```

---

## ⚠️ Puntos Críticos

### NUNCA modificar manualmente:
- `tests/regression-checksums.json` 
- `tests/snapshots/baseline/`

**Razón:** Son fuente de verdad para regresión

### SI cambias fixture:
1. Regenera baseline
2. Commit nuevo baseline
3. Continúa refactorización

### SI falla validación:
1. No ignores el error
2. Investiga la diferencia
3. Fix el código refactorizado
4. Rerun validación
5. Solo después: commit

---

## 📝 Estado del Proyecto

```
Fase Completada: Phase 0 ✅ (Setup)
Infraestructura: ✅ Completa
Documentación: ✅ Completa
Fixtures: ⏳ Pendiente (usuario)
Baseline: ⏳ Pendiente (usuario)

Próximo: Phase 1 - Extract DocxParser (espera aprobación)
```

---

## 🎯 Conclusión

**Phase 0 está LISTO para ejecutar.**

Cuando hayas:
1. ✅ Creado los 5 fixtures DOCX
2. ✅ Generado los checksums baseline
3. ✅ Committed Phase 0 a GitHub

Entonces: **Aprueba refactorización y comienza Phase 1.**

---

**Preguntas frecuentes:**

**P: ¿Cuánto tarda Phase 0?**
R: 30-45 minutos (principalmente crear fixtures)

**P: ¿Puedo saltarme algunos fixtures?**
R: No, necesitas los 5 para cobertura completa

**P: ¿Qué pasa si falla un fixture?**
R: Investiga, fix el código refactorizado, rerun

**P: ¿Cuándo hago commit del baseline?**
R: Cuando todos los fixtures pasen (sin cambios)

