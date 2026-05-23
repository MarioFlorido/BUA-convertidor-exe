# 📦 Phase 1: Extract DocxParser - Guía de Implementación

**Prerequisito:** Phase 0 completado ✅  
**Riesgo:** LOW  
**Impacto:** ISOLATED (solo refactor de parsing)  
**Validación:** Binary-identical ELPX output

---

## 📖 Descripción General

**Objetivo:** Extraer la lógica de parsing DOCX a un módulo independiente.

**Cambio Visual:** NINGUNO
- Usuario ve mismo comportamiento
- ELPX generado es idéntico (byte-a-byte)
- UI no cambia
- Flujo no cambia

**Cambio Arquitectónico:** 
- Aislar lectura DOCX de orquestación
- Crear interfaz clara para entrada
- Facilitar future: múltiples formatos de entrada (Word, Google Docs, etc)

---

## 🗂️ Estructura Actual (Monolítica)

```typescript
// src/core/docxToElpx.ts (1113 líneas)

export async function convertDocxToElpx(
  file: File,
  options: DocxImportOptions,
  structure?: any,
  onProgress?: (progress: DocxImportProgress) => void
): Promise<ImportToElpxResult> {
  
  // LÍNEAS 14-52: PARSING DOCX (será extraído)
  onProgress?.({ phase: 'read', ... });
  const inputBuffer = await file.arrayBuffer();
  
  onProgress?.({ phase: 'parse', ... });
  const { value: mammothHtml } = await mammoth.convertArrayBuffer({
    arrayBuffer: inputBuffer
  });
  
  // LÍNEAS 53-85: Análisis de estructura
  const structure = parseDocumentStructure(mammothHtml);
  
  // ... resto
}

function extractDocxHtml(file: File): Promise<string> {
  // LÍNEAS 126-142: Extraction pura
  const inputBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertArrayBuffer({
    arrayBuffer: inputBuffer
  });
  return html;
}
```

**Problema:** Parsing DOCX está mezclado con:
- Callbacks de progreso
- Análisis de estructura
- Orquestación general

---

## 🎯 Estructura Deseada (Separada)

```typescript
// src/core/parsers/DocxParser.ts (NUEVA)

interface DocxParseResult {
  html: string;
  metadata?: {
    title?: string;
    author?: string;
  };
}

export class DocxParser {
  async parse(file: File): Promise<DocxParseResult> {
    const inputBuffer = await file.arrayBuffer();
    const { value: html } = await mammoth.convertArrayBuffer({
      arrayBuffer: inputBuffer
    });
    return { html };
  }
}

// Uso
const parser = new DocxParser();
const result = await parser.parse(file); // { html: "..." }
```

```typescript
// src/core/docxToElpx.ts (REFACTORIZADO)

export async function convertDocxToElpx(
  file: File,
  options: DocxImportOptions,
  structure?: any,
  onProgress?: (progress: DocxImportProgress) => void
): Promise<ImportToElpxResult> {
  
  onProgress?.({ phase: 'read', message: 'Leyendo...' });
  
  // USAR PARSER EN VEZ DE LÓGICA INLINE
  const parser = new DocxParser();
  const parseResult = await parser.parse(file);
  const mammothHtml = parseResult.html;
  
  // RESTO DEL CÓDIGO SIN CAMBIOS
  onProgress?.({ phase: 'parse', message: 'Analizando...' });
  // ... (mismo código que antes)
}
```

---

## 📋 Checklist de Implementación

### Paso 1: Crear archivo nuevo (5 min)

```bash
# Crear directorio si no existe
mkdir -p src/core/parsers

# Crear archivo vacío
touch src/core/parsers/DocxParser.ts
```

**Archivo:** `src/core/parsers/DocxParser.ts`

```typescript
import mammoth from 'mammoth';

/**
 * Parser para archivos DOCX
 * Responsabilidad única: Convertir DOCX → HTML semántico
 * 
 * Validación: Output HTML debe ser idéntico al de Mammoth.js
 */

export interface DocxParseResult {
  html: string;
  metadata?: {
    title?: string;
    author?: string;
  };
}

export class DocxParser {
  /**
   * Convierte archivo DOCX a HTML
   * @param file Archivo DOCX (File API)
   * @returns HTML string extraído de DOCX
   */
  async parse(file: File): Promise<DocxParseResult> {
    const inputBuffer = await file.arrayBuffer();
    
    const { value: html } = await mammoth.convertArrayBuffer({
      arrayBuffer: inputBuffer
    });

    return {
      html,
      metadata: {}
    };
  }
}
```

### Paso 2: Modificar docxToElpx.ts (15 min)

**En el archivo:** `src/core/docxToElpx.ts`

**ANTES:**
```typescript
export async function convertDocxToElpx(
  file: File,
  options: DocxImportOptions,
  structure?: any,
  onProgress?: (progress: DocxImportProgress) => void
): Promise<ImportToElpxResult> {
  onProgress?.({ phase: 'read', ... });
  const inputBuffer = await file.arrayBuffer();
  
  onProgress?.({ phase: 'parse', ... });
  const { value: mammothHtml } = await mammoth.convertArrayBuffer({
    arrayBuffer: inputBuffer
  });
  
  // ... resto
}
```

**DESPUÉS:**
```typescript
import { DocxParser } from './parsers/DocxParser'; // NUEVA LÍNEA

export async function convertDocxToElpx(
  file: File,
  options: DocxImportOptions,
  structure?: any,
  onProgress?: (progress: DocxImportProgress) => void
): Promise<ImportToElpxResult> {
  onProgress?.({ phase: 'read', message: '...' });
  
  // USAR PARSER EN VEZ DE CÓDIGO INLINE
  const parser = new DocxParser();
  const parseResult = await parser.parse(file);
  const mammothHtml = parseResult.html;
  
  onProgress?.({ phase: 'parse', message: '...' });
  
  // ... resto sin cambios
}
```

**Cambios específicos:**

1. **Agregar import al inicio:**
   ```typescript
   import { DocxParser } from './parsers/DocxParser';
   ```

2. **Reemplazar líneas 14-42 (parsing):**
   ```typescript
   // ANTES: 28 líneas de Mammoth + callbacks
   
   // DESPUÉS:
   const parser = new DocxParser();
   const parseResult = await parser.parse(file);
   const mammothHtml = parseResult.html;
   ```

3. **Eliminar función `extractDocxHtml()`:**
   - Ya no es necesaria
   - Si se usa en otros lados, reemplazar con `DocxParser`

### Paso 3: Actualizar imports en otros archivos (5 min)

**Si hay otros archivos que usen `extractDocxHtml()`:**

```bash
# Buscar referencias
grep -r "extractDocxHtml" src/

# Si hay referencias, reemplazar:
# Antes: import { extractDocxHtml } from './docxToElpx'
# Después: import { DocxParser } from './parsers/DocxParser'
```

### Paso 4: Prueba manual rápida (5 min)

```bash
# 1. Compilar TypeScript
npm run build

# 2. Ver errores (si los hay)
# Si hay errores de import, revisar y corregir

# 3. Verificar que no hay imports rotos
npm run lint
```

### Paso 5: Ejecutar validación de regresión (5 min)

```bash
# Ejecutar validación contra baseline
npm run test:phase 1 simple.docx
npm run test:phase 1 multipage.docx
npm run test:phase 1 semantic.docx
npm run test:phase 1 tables.docx
npm run test:phase 1 themed.docx

# ESPERADO: ✅ Todos pasan (checksums idénticos)
```

**Si alguno falla:**
1. Revisar reporte: `tests/reports/phase-1-report-*.json`
2. Comparar checksums: ¿Qué cambió?
3. Investigar: ¿Código introdujo cambio no intencional?
4. REVERT: `git checkout -- src/core/`
5. Fix y reintentar

### Paso 6: Commit (2 min)

```bash
# Ver cambios
git status
git diff src/

# Stage cambios
git add src/core/parsers/DocxParser.ts
git add src/core/docxToElpx.ts

# Commit con mensaje descriptivo
git commit -m "Phase 1: Extract DocxParser [VALIDATED]

- Create src/core/parsers/DocxParser.ts
- Extract DOCX parsing logic from docxToElpx.ts
- Maintain identical output (binary-validated)
- Clean separation: File → HTML conversion
- Ready for Phase 2: Extract HtmlTransformer

Validation:
- All 5 fixtures pass binary validation
- Checksums identical to baseline
- No functional changes observed"

# Push
git push origin main
```

---

## 🧪 Validation Details

### Qué se valida:

1. **content.xml** - SHA-256 debe ser IDÉNTICO
   - Estructura de páginas/bloques sin cambios
   - Texto exacto sin modificaciones
   - Clases BUA aplicadas igual

2. **ode.xml** - SHA-256 debe ser IDÉNTICO
   - Navegación de estructura igual
   - Titles y hierarchy sin cambios

3. **manifest.xml** - SHA-256 puede diferir (timestamps)
   - Se permite si solo cambió metadata

4. **ZIP completo** - SHA-256 debe ser IDÉNTICO
   - O muy similar (solo si cambió metadata no funcional)

### Por qué importa:

- **Output idéntico** = Refactor preservó comportamiento
- **Fallida validación** = Algo cambió sin intención
- **Mismo ELPX** = Usuarios ven mismo resultado

---

## ⚠️ Puntos Clave

### QUÉ NO CAMBIAR:
- ✋ Lógica de parsing Mammoth
- ✋ Formato HTML generado
- ✋ Comportamiento de conversion
- ✋ Manejo de errores (si funciona)

### QUÉ SÍ CAMBIAR:
- ✅ Dónde vive el código (archivo nuevo)
- ✅ Cómo se accede (clase en lugar de función)
- ✅ Separación de responsabilidades

### Regla Fundamental:
**If output changes → Refactor is wrong, revert**

---

## 🔄 Workflow Completo

```bash
# 1. Asegurar Phase 0 completado
npm run test:baseline

# 2. Crear rama
git checkout -b phase-1-extract-parser

# 3. Crear archivo DocxParser.ts
# (ver Paso 1 arriba)

# 4. Modificar docxToElpx.ts
# (ver Paso 2 arriba)

# 5. Compilar y revisar
npm run build

# 6. Validar regresión
npm run test:phase 1

# 7. Si pasa:
git add .
git commit -m "Phase 1: Extract DocxParser [VALIDATED]"
git push origin main

# 8. Si falla:
git checkout -- .  # Revert
# Investigar qué cambió
# Corregir
# Reintentar
```

---

## 📊 Métricas de Éxito

| Métrica | Esperado |
|---------|----------|
| Archivos creados | 1 nuevo (`DocxParser.ts`) |
| Archivos modificados | 1 (`docxToElpx.ts`) |
| Líneas eliminadas | ~28 (parsing inline) |
| Líneas agregadas | ~30 (clase DocxParser) |
| Tests pasados | 5/5 fixtures ✅ |
| Checksums idénticos | 100% ✅ |
| Compilación | ✅ Sin errores |

---

## 🎯 Siguiente: Phase 2

**Después de Phase 1 aprobado:**

Phase 2 = Extract HtmlTransformer
- Mover lógica de `applyDivClasses`, `applyTableClasses`
- Crear `src/core/transformers/HtmlTransformer.ts`
- Mismo proceso: extract → validate → commit

---

## 📝 Resumen Rápido

```
Phase 1 = Extraer parsing DOCX a módulo independiente

ANTES: docxToElpx.ts (1113 líneas)
       ├─ Parsing DOCX (28 líneas)
       ├─ Análisis estructura (...)
       └─ Generación ELPX (...)

DESPUÉS: docxToElpx.ts (1085 líneas) + DocxParser.ts (30 líneas)
         ├─ Parsing DOCX (DocxParser.ts)
         ├─ Análisis estructura (aquí)
         └─ Generación ELPX (aquí)

RESULTADO: Mismo ELPX, código mejor organizado ✅
```

