# FASE 3 — Infraestructura de calidad: tests y consolidaciones

> 📌 **Estado a junio 2026 (parcialmente hecho):**
> - ✅ **Tests** — implementados, pero con `node:test` vía `tsx` (script `npm test`),
>   **no** con Vitest como proponía el Paso 1. Cubren `HtmlTransformer` (27 tests).
> - ✅ **`escHtml` consolidada** (Paso 3) — una sola definición canónica en
>   `src/core/utils/html.ts`.
> - ⏳ **Unificar `DocumentStructure` (Paso 4) — PENDIENTE.** Sigue definida en
>   `src/types/index.ts` y en `src/core/models/SemanticDocument.ts` con una
>   divergencia (la primera lleva `id` en los items). Es lo único que queda.

**Proyecto:** BUA ConvertidoreXe (`/Users/mario/BUA-convertidor-exe`)  
**Prerequisito:** Las Fases 1 y 2 están aplicadas. El programa funciona al 100%.  
**Estimación:** 3-4 horas de trabajo concentrado.  
**Política:** enfoque conservador — sin refactorizar lo que funciona, solo añadir tests y eliminar duplicaciones verificadas.

---

## Por qué es necesaria

El proyecto tiene tres deudas técnicas que, sin ser bugs activos hoy, representan riesgos reales para el futuro:

1. **Sin tests:** las transformaciones HTML del pipeline son complejas (marcadores BUA, bookmarks de Word, sanitización). Cualquier cambio futuro en `HtmlTransformer.ts`, `SemanticBuilder.ts` o `docxToSemanticDocument.ts` puede introducir regresiones silenciosas que ningún CI detectará. La ausencia de tests no es un problema ahora; lo será en el momento en que haya que tocar esas funciones.

2. **`escHtml` duplicada en 3 archivos:** existe una función canónica en `src/core/utils/html.ts` (`escapeHtml`, 5 sustituciones) y tres copias locales idénticas entre sí pero con 4 sustituciones (sin escapar `'`). Las copias están en `semanticDocumentToPrintHtml.ts` línea ~364, `renderTableOfContents.ts` línea ~80 y `renderCoverPage.ts` línea ~132. Son funcionalmente equivalentes en sus contextos actuales, pero si alguien modifica una copia creyendo que cambia todas, introduce un bug silencioso.

3. **`DocumentStructure` definida dos veces con divergencias:** existe en `src/core/models/SemanticDocument.ts` (línea ~79, sin `id` en los items) y en `src/types/index.ts` (línea ~70, con `id: string` en `H2Item` y `H1Section`). TypeScript no se queja porque son estructuralmente compatibles, pero son dos fuentes de verdad que pueden divergir con el tiempo.

---

## Paso 1 — Instalar y configurar Vitest

Vitest es el test runner nativo de Vite. No requiere configuración adicional compleja si ya hay un `vite.config.ts`.

### 1.1 Instalar dependencias

```bash
npm install -D vitest @vitest/coverage-v8 jsdom
```

- `vitest`: el runner
- `@vitest/coverage-v8`: cobertura de código (opcional pero útil)
- `jsdom`: entorno DOM para las funciones que usan `DOMParser`

### 1.2 Actualizar `vite.config.ts`

Añadir la sección `test` al objeto de configuración existente:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/BUA-convertidor-exe/',
  test: {
    environment: 'jsdom',
    globals: true,
  },
  // ... resto de la configuración existente sin tocar
});
```

### 1.3 Añadir scripts en `package.json`

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### 1.4 Verificar que funciona

```bash
npx vitest run
# Debe salir "No test files found" sin errores de configuración
```

---

## Paso 2 — Escribir los tests

Crear el directorio `src/core/__tests__/` y los archivos de test. Orden recomendado: de más simple a más complejo.

### 2.1 Test de `HtmlTransformer` (el más valioso)

**Archivo:** `src/core/__tests__/HtmlTransformer.test.ts`

Este transformer convierte `[importante]...[fin]` en `<div class="bua_importante">`. Los edge cases son numerosos y este es el archivo con mayor riesgo de regresión.

```typescript
import { describe, it, expect } from 'vitest';
import { applyDivClasses, applyTableClasses } from '../transformers/HtmlTransformer';

describe('applyDivClasses', () => {

  it('convierte marcador en párrafo propio a div', () => {
    const input = '<p>[importante]</p><p>Texto</p><p>[fin]</p>';
    const result = applyDivClasses(input);
    expect(result).toContain('class="bua_importante"');
    expect(result).not.toContain('[importante]');
    expect(result).not.toContain('[fin]');
  });

  it('es case-insensitive', () => {
    const input = '<p>[IMPORTANTE]</p><p>Texto</p><p>[FIN]</p>';
    expect(applyDivClasses(input)).toContain('class="bua_importante"');
  });

  it('acepta variante sin tilde', () => {
    const input = '<p>[definicion]</p><p>Texto</p><p>[fin]</p>';
    expect(applyDivClasses(input)).toContain('class="bua_definicion"');
  });

  it('acepta variante con tilde', () => {
    const input = '<p>[definición]</p><p>Texto</p><p>[fin]</p>';
    expect(applyDivClasses(input)).toContain('class="bua_definicion"');
  });

  it('maneja bookmark de Word dentro del marcador', () => {
    // Mammoth puede generar <a id="bk1"></a> dentro del corchete
    const input = '<p>[importan<a id="bk1"></a>te]</p><p>Texto</p><p>[fin]</p>';
    expect(applyDivClasses(input)).toContain('class="bua_importante"');
  });

  it('convierte [ejemplo]', () => {
    const input = '<p>[ejemplo]</p><p>Texto</p><p>[fin]</p>';
    expect(applyDivClasses(input)).toContain('class="bua_ejemplo"');
  });

  it('no afecta contenido sin marcadores', () => {
    const input = '<p>Texto normal</p>';
    expect(applyDivClasses(input)).toBe(input);
  });

  it('HTML sin marcadores pasa sin cambios', () => {
    const input = '<h1>Título</h1><p>Párrafo</p>';
    expect(applyDivClasses(input)).toBe(input);
  });
});

describe('applyTableClasses', () => {

  it('añade clase horizontal a la tabla siguiente', () => {
    const input = '<p>[horizontal]</p><table><tr><td>A</td></tr></table>';
    const result = applyTableClasses(input);
    expect(result).toContain('class="bua_tabla_horizontal"');
    expect(result).not.toContain('[horizontal]');
  });

  it('añade clase vertical a la tabla siguiente', () => {
    const input = '<p>[vertical]</p><table><tr><td>A</td></tr></table>';
    expect(applyTableClasses(input)).toContain('class="bua_tabla_vertical"');
  });

  it('no afecta tablas sin marcador previo', () => {
    const input = '<table><tr><td>A</td></tr></table>';
    const result = applyTableClasses(input);
    expect(result).not.toContain('class="bua_tabla');
  });
});
```

### 2.2 Test de `ThemeValidator`

**Archivo:** `src/core/__tests__/ThemeValidator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validateThemeBundle } from '../services/ThemeValidator';

const encoder = new TextEncoder();

describe('validateThemeBundle', () => {

  it('es válido con config.xml y style.css', () => {
    const files = {
      'config.xml': encoder.encode('<config/>'),
      'style.css': encoder.encode('body {}'),
    };
    expect(validateThemeBundle(files).valid).toBe(true);
  });

  it('es inválido sin config.xml', () => {
    const files = {
      'style.css': encoder.encode('body {}'),
    };
    const result = validateThemeBundle(files);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('config.xml'))).toBe(true);
  });

  it('es inválido sin style.css', () => {
    const files = {
      'config.xml': encoder.encode('<config/>'),
    };
    const result = validateThemeBundle(files);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('style.css'))).toBe(true);
  });

  it('es inválido con objeto vacío', () => {
    expect(validateThemeBundle({}).valid).toBe(false);
  });
});
```

### 2.3 Test de `escapeHtml` (función canónica)

**Archivo:** `src/core/__tests__/html.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../utils/html';

describe('escapeHtml', () => {
  it('escapa ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });
  it('escapa menor que', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });
  it('escapa comillas dobles', () => {
    expect(escapeHtml('"texto"')).toBe('&quot;texto&quot;');
  });
  it('escapa comillas simples', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });
  it('no modifica texto sin caracteres especiales', () => {
    expect(escapeHtml('Texto normal 123')).toBe('Texto normal 123');
  });
  it('maneja string vacío', () => {
    expect(escapeHtml('')).toBe('');
  });
});
```

### 2.4 Ejecutar los tests antes de continuar

```bash
npm test
# Todos deben pasar. Si alguno falla, revisar y corregir antes de continuar.
```

---

## Paso 3 — Consolidar `escHtml` en los renderers PDF

**Solo hacer este paso si todos los tests del Paso 2 pasan.**

### El problema exacto

Hay 3 copias locales en los renderers PDF, cada una con 4 sustituciones (sin escapar `'`):

| Archivo | Línea aprox. | Función |
|---|---|---|
| `src/core/renderers/html-print/semanticDocumentToPrintHtml.ts` | ~364 | `function escHtml(s: string)` |
| `src/core/renderers/html-print/renderTableOfContents.ts` | ~80 | `function escHtml(s: string)` |
| `src/core/renderers/html-print/renderCoverPage.ts` | ~132 | `function escHtml(s: string)` |

La función canónica en `src/core/utils/html.ts` tiene 5 sustituciones (incluye `'` → `&#39;`). La diferencia es irrelevante en los contextos donde se usa (contenido HTML de texto, no atributos), pero conviene unificar para tener una única fuente de verdad.

### Procedimiento (repetir en cada uno de los 3 archivos)

**a)** Añadir el import al inicio del archivo:
```typescript
import { escapeHtml } from '../../utils/html';
// La ruta relativa es la misma para los 3 archivos ya que están en html-print/
```

**b)** Renombrar cada llamada `escHtml(x)` → `escapeHtml(x)` (búsqueda global en el archivo).

**c)** Eliminar la función local `escHtml` completa de cada archivo.

**d)** Compilar:
```bash
npx tsc --noEmit
# Debe salir limpio
```

**e)** Ejecutar los tests:
```bash
npm test
# Todos deben seguir pasando
```

**f)** Prueba manual: generar un PDF con contenido que tenga `<`, `>`, `&` y `"` para verificar que el escaping sigue funcionando correctamente en el documento impreso.

---

## Paso 4 — Unificar `DocumentStructure`

**Solo hacer este paso si el Paso 3 está limpio.**

### El problema exacto

`DocumentStructure` se define en dos lugares:

**Definición A** — `src/core/models/SemanticDocument.ts` línea ~79 (sin `id` en los items):
```typescript
export interface DocumentStructure {
  h1Sections: Array<{
    title: string;
    level: 1 | 2 | 3;
    h2Items: Array<{
      text: string;
      option: 'html' | 'idevice-title' | 'accordion' | 'tabs';
    }>;
  }>;
}
```

**Definición B** — `src/types/index.ts` línea ~70 (la canónica, con interfaces nominales):
```typescript
export interface H2Item { id: string; text: string; option: H2StructureOption; }
export interface H1Section { id: string; title: string; level: 1|2|3; h2Items: H2Item[]; }
export interface DocumentStructure { h1Sections: H1Section[]; }
```

La diferencia es que la Definición B tiene `id: string` en `H2Item` y `H1Section`. TypeScript las acepta como compatibles (structural typing), pero son dos fuentes de verdad.

### Procedimiento

**a)** En `src/core/models/SemanticDocument.ts`, localizar y eliminar la `DocumentStructure` (Definición A completa).

**b)** Comprobar si `SemanticDocument.ts` la re-exporta hacia otros módulos. Si es así, sustituir por un re-export desde types:
```typescript
export type { DocumentStructure } from '../../types';
```

**c)** Compilar:
```bash
npx tsc --noEmit
```
Si TypeScript señala errores de tipo en algún archivo que usaba la Definición A (porque accede a propiedades sin `id`), añadir los `id` faltantes o marcarlos como opcionales (`id?: string`) en los lugares de creación del objeto.

**d)** Ejecutar los tests:
```bash
npm test
```

**e)** Prueba manual del flujo completo: subir un DOCX, configurar la estructura, convertir a ELPX, descargar y abrir en eXeLearning.

---

## Paso 5 — Commit final

Una vez que todo compila, los tests pasan y la prueba manual es correcta:

```bash
git add -A
git commit -m "test+refactor(fase-3): Vitest, consolidar escHtml, unificar DocumentStructure

- Añadir Vitest con entorno jsdom
- Tests para HtmlTransformer, ThemeValidator, escapeHtml
- Consolidar escHtml en renderers PDF usando utils/html.ts
- Eliminar DocumentStructure duplicada de SemanticDocument.ts

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main
```

---

## Criterios de éxito

- [ ] `npm test` ejecuta sin fallos
- [ ] `npx tsc --noEmit` sin errores
- [ ] Un PDF generado muestra correctamente caracteres especiales (`<`, `>`, `&`, `"`)
- [ ] Un DOCX con etiquetas `[importante]`, `[ejemplo]`, `[definición]` convierte correctamente al ELPX
- [ ] La app arranca y el flujo completo (subir → estructura → tema → descargar) funciona sin errores en consola

---

## Notas para quien ejecute este trabajo

- No modificar `HtmlTransformer.ts` más allá de lo descrito. Los regex de este archivo son frágiles por diseño (tratan HTML como strings, lo que es correcto dado el origen controlado del HTML de Mammoth).
- Si al unificar `DocumentStructure` aparece algún error de TypeScript inesperado, el enfoque más seguro es mantener las dos definiciones y marcar la de `SemanticDocument.ts` como `@deprecated`. No forzar la unificación si genera incertidumbre.
- Los tests de `HtmlTransformer` son la inversión más valiosa. Si hay tiempo limitado, hacer solo el Paso 2.1 y el Paso 2.4, y dejar los Pasos 3 y 4 para otra ocasión.
- Esta fase no debe hacerse en medio de un desarrollo de nueva funcionalidad. El momento ideal es justo antes de comenzar un cambio sustancial en el pipeline (nuevo tipo de bloque, nuevo formato de salida, etc.).
